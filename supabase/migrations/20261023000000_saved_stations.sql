drop table if exists public.saved_stations;

create table public.saved_stations (
  user_id uuid not null references auth.users (id) on delete cascade,
  station_id text not null,
  station jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, station_id)
);

alter table public.saved_stations enable row level security;

create policy "saved_stations_select_own" on public.saved_stations
  for select using (auth.uid() = user_id);

create policy "saved_stations_insert_own" on public.saved_stations
  for insert with check (auth.uid() = user_id);

create policy "saved_stations_delete_own" on public.saved_stations
  for delete using (auth.uid() = user_id);
