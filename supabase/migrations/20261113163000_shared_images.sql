create table if not exists public.image_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-F0-9]{16}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.image_room_members (
  room_id uuid not null references public.image_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.shared_images (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.image_rooms(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (length(file_name) between 1 and 255),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.image_rooms enable row level security;
alter table public.image_room_members enable row level security;
alter table public.shared_images enable row level security;

revoke all on public.image_rooms, public.image_room_members, public.shared_images from anon, authenticated;
grant select, insert, delete on public.shared_images to authenticated;

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
      insert into public.image_rooms (code)
      values (room_code)
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

create or replace function public.join_image_room(p_room_code text)
returns table (room_id uuid, room_code text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Accesso anonimo richiesto';
  end if;

  room_code := upper(regexp_replace(coalesce(p_room_code, ''), '[^A-Za-z0-9]', '', 'g'));
  select r.id into room_id
  from public.image_rooms as r
  where r.code = room_code;

  if room_id is null then
    raise exception 'Codice stanza non valido';
  end if;

  insert into public.image_room_members (room_id, user_id)
  values (room_id, auth.uid())
  on conflict (room_id, user_id) do nothing;

  return next;
end;
$$;

create or replace function public.is_image_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.image_room_members as m
    where m.room_id = p_room_id
      and m.user_id = auth.uid()
  );
$$;

grant execute on function public.create_image_room() to authenticated;
grant execute on function public.join_image_room(text) to authenticated;
grant execute on function public.is_image_room_member(uuid) to authenticated;

create policy "Room members can read shared image metadata"
on public.shared_images
for select
to authenticated
using (public.is_image_room_member(room_id));

create policy "Room members can add shared image metadata"
on public.shared_images
for insert
to authenticated
with check (
  public.is_image_room_member(room_id)
  and uploaded_by = auth.uid()
);

create policy "Room members can remove shared image metadata"
on public.shared_images
for delete
to authenticated
using (public.is_image_room_member(room_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-images',
  'session-images',
  false,
  20971520,
  array['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Room members can read shared image files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'session-images'
  and public.is_image_room_member(((storage.foldername(name))[1])::uuid)
);

create policy "Room members can upload shared image files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'session-images'
  and public.is_image_room_member(((storage.foldername(name))[1])::uuid)
);

create policy "Room members can remove shared image files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'session-images'
  and public.is_image_room_member(((storage.foldername(name))[1])::uuid)
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shared_images'
  ) then
    execute 'alter publication supabase_realtime add table public.shared_images';
  end if;
end;
$$;
