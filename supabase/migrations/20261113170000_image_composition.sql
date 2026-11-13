alter table public.image_rooms
add column created_by uuid references auth.users(id);

update public.image_rooms as r
set created_by = members.user_id
from (
  select distinct on (room_id) room_id, user_id
  from public.image_room_members
  order by room_id, joined_at asc
) as members
where members.room_id = r.id
  and r.created_by is null;

alter table public.image_rooms
alter column created_by set not null;

create or replace function public.create_image_room()
returns table (room_id uuid, room_code text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Accesso anonimo richiesto';
  end if;

  loop
    room_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
    begin
      insert into public.image_rooms (code, created_by)
      values (room_code, auth.uid())
      returning id into room_id;
      exit;
    exception when unique_violation then
      room_id := null;
    end;
  end loop;

  insert into public.image_room_members (room_id, user_id)
  values (room_id, auth.uid());

  return next;
end;
$$;

create or replace function public.is_image_room_master(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.image_rooms as r
    where r.id = p_room_id
      and r.created_by = auth.uid()
  );
$$;

grant execute on function public.is_image_room_master(uuid) to authenticated;

drop policy if exists "Room members can add shared image metadata"
on public.shared_images;

create policy "Only the room Master can add shared image metadata"
on public.shared_images
for insert
to authenticated
with check (
  public.is_image_room_master(room_id)
  and uploaded_by = auth.uid()
);

drop policy if exists "Room members can upload shared image files"
on storage.objects;

create policy "Only the room Master can upload shared image files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'session-images'
  and public.is_image_room_master(((storage.foldername(name))[1])::uuid)
);

alter table public.shared_images
add constraint shared_images_room_image_unique unique (room_id, id);

create table public.image_composition_items (
  room_id uuid not null references public.image_rooms(id) on delete cascade,
  image_id uuid not null unique,
  x numeric(5, 2) not null default 50 check (x between 0 and 100),
  y numeric(5, 2) not null default 50 check (y between 0 and 100),
  width numeric(5, 2) not null default 25 check (width between 10 and 65),
  z_index integer not null default 1 check (z_index > 0),
  foreign key (room_id, image_id)
    references public.shared_images(room_id, id)
    on delete cascade
);

alter table public.image_composition_items enable row level security;
grant select, insert, update, delete on public.image_composition_items to authenticated;

create policy "Room members can view image composition"
on public.image_composition_items
for select
to authenticated
using (public.is_image_room_member(room_id));

create policy "Only the room Master can add composition items"
on public.image_composition_items
for insert
to authenticated
with check (public.is_image_room_master(room_id));

create policy "Only the room Master can move composition items"
on public.image_composition_items
for update
to authenticated
using (public.is_image_room_master(room_id))
with check (public.is_image_room_master(room_id));

create policy "Only the room Master can remove composition items"
on public.image_composition_items
for delete
to authenticated
using (public.is_image_room_master(room_id));

with numbered_images as (
  select
    i.room_id,
    i.id as image_id,
    row_number() over (partition by i.room_id order by i.created_at, i.id) as position
  from public.shared_images as i
)
insert into public.image_composition_items (room_id, image_id, x, y, width, z_index)
select
  room_id,
  image_id,
  18 + (((position - 1) % 3) * 32),
  22 + ((((position - 1) / 3) % 3) * 28),
  25,
  position::integer
from numbered_images
on conflict (image_id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'image_composition_items'
  ) then
    execute 'alter publication supabase_realtime add table public.image_composition_items';
  end if;
end;
$$;
