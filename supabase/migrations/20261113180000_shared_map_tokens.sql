alter table public.image_room_members
add column if not exists player_name text;

create unique index if not exists image_room_members_unique_player_name
on public.image_room_members (room_id, lower(player_name))
where player_name is not null;

create or replace function public.claim_image_room_player(
  p_room_id uuid,
  p_player_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := btrim(coalesce(p_player_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Accesso anonimo richiesto';
  end if;
  if length(normalized_name) not between 1 and 80 or lower(normalized_name) = 'master' then
    raise exception 'Nome giocatore non valido';
  end if;
  if exists (
    select 1
    from public.image_rooms as r
    where r.id = p_room_id
      and r.created_by = auth.uid()
  ) then
    raise exception 'Il Master non può essere assegnato a un personaggio giocatore';
  end if;

  update public.image_room_members
  set player_name = normalized_name
  where room_id = p_room_id
    and user_id = auth.uid();
  if not found then
    raise exception 'Devi prima entrare nella stanza';
  end if;
  return normalized_name;
exception
  when unique_violation then
    raise exception 'Questo personaggio è già collegato a un altro partecipante';
end;
$$;

create or replace function public.get_image_room_player(p_room_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when r.created_by = auth.uid() then 'Master'
    else (
      select m.player_name
      from public.image_room_members as m
      where m.room_id = r.id
        and m.user_id = auth.uid()
    )
  end
  from public.image_rooms as r
  where r.id = p_room_id
    and public.is_image_room_member(r.id);
$$;

create or replace function public.is_valid_map_token_owner(
  p_room_id uuid,
  p_owner_user_id uuid,
  p_owner_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_image_room_member(p_room_id)
    and (
      (
        public.is_image_room_master(p_room_id)
        and (
          (p_owner_user_id = auth.uid() and p_owner_name = 'Master')
          or exists (
            select 1
            from public.image_room_members as m
            where m.room_id = p_room_id
              and m.user_id = p_owner_user_id
              and m.player_name = p_owner_name
          )
        )
      )
      or (
        p_owner_user_id = auth.uid()
        and exists (
        select 1
        from public.image_room_members as m
        where m.room_id = p_room_id
          and m.user_id = auth.uid()
          and m.player_name = p_owner_name
        )
      )
    );
$$;

create or replace function public.list_image_room_players(p_room_id uuid)
returns table (user_id uuid, player_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.player_name
  from public.image_room_members as m
  where m.room_id = p_room_id
    and m.player_name is not null
    and public.is_image_room_master(p_room_id);
$$;

grant execute on function public.claim_image_room_player(uuid, text) to authenticated;
grant execute on function public.get_image_room_player(uuid) to authenticated;
grant execute on function public.is_valid_map_token_owner(uuid, uuid, text) to authenticated;
grant execute on function public.list_image_room_players(uuid) to authenticated;

drop policy if exists "Room members can remove shared image metadata"
on public.shared_images;

create policy "Only the room Master can remove shared image metadata"
on public.shared_images
for delete
to authenticated
using (public.is_image_room_master(room_id));

drop policy if exists "Room members can remove shared image files"
on storage.objects;

create policy "Only the room Master can remove shared image files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'session-images'
  and public.is_image_room_master(((storage.foldername(name))[1])::uuid)
);

create table public.map_tokens (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.image_rooms(id) on delete cascade,
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  owner_name text not null check (length(owner_name) between 1 and 80),
  entity_id text not null check (length(entity_id) between 1 and 100),
  entity_kind text not null check (entity_kind in ('character', 'pokemon')),
  label text not null check (length(label) between 1 and 100),
  x numeric(5, 2) not null default 50 check (x between 0 and 100),
  y numeric(5, 2) not null default 50 check (y between 0 and 100),
  color text not null default '#397cc1' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (room_id, owner_user_id, entity_id)
);

alter table public.map_tokens enable row level security;
grant select, insert, update, delete on public.map_tokens to authenticated;

create policy "Room members can view map tokens"
on public.map_tokens
for select
to authenticated
using (public.is_image_room_member(room_id));

create policy "Players can add their own map tokens"
on public.map_tokens
for insert
to authenticated
with check (
  public.is_valid_map_token_owner(room_id, owner_user_id, owner_name)
);

create policy "Players and the Master can move map tokens"
on public.map_tokens
for update
to authenticated
using (
  public.is_image_room_member(room_id)
  and (owner_user_id = auth.uid() or public.is_image_room_master(room_id))
)
with check (
  public.is_image_room_member(room_id)
  and (
    public.is_image_room_master(room_id)
    or public.is_valid_map_token_owner(room_id, owner_user_id, owner_name)
  )
);

create policy "Players and the Master can remove map tokens"
on public.map_tokens
for delete
to authenticated
using (
  public.is_image_room_member(room_id)
  and (owner_user_id = auth.uid() or public.is_image_room_master(room_id))
);

create table public.image_room_maps (
  room_id uuid primary key references public.image_rooms(id) on delete cascade,
  storage_path text unique,
  source_url text,
  file_name text not null check (length(file_name) between 1 and 255),
  updated_by uuid not null default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(storage_path, source_url) = 1)
);

alter table public.image_room_maps enable row level security;
grant select, insert, update, delete on public.image_room_maps to authenticated;

create policy "Room members can view the shared map"
on public.image_room_maps
for select
to authenticated
using (public.is_image_room_member(room_id));

create policy "Only the Master can upload a shared map"
on public.image_room_maps
for insert
to authenticated
with check (
  public.is_image_room_master(room_id)
  and updated_by = auth.uid()
);

create policy "Only the Master can replace a shared map"
on public.image_room_maps
for update
to authenticated
using (public.is_image_room_master(room_id))
with check (
  public.is_image_room_master(room_id)
  and updated_by = auth.uid()
);

create policy "Only the Master can remove a shared map"
on public.image_room_maps
for delete
to authenticated
using (public.is_image_room_master(room_id));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'map_tokens'
  ) then
    execute 'alter publication supabase_realtime add table public.map_tokens';
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'image_room_maps'
  ) then
    execute 'alter publication supabase_realtime add table public.image_room_maps';
  end if;
end;
$$;
