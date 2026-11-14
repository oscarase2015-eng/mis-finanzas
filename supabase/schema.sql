-- Mis Finanzas: base de datos en Supabase
-- Pega todo este archivo en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin problema.

create table if not exists public.records (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  tbl        text    not null,          -- accounts, categories, transactions, budgets, rates, settings…
  id         text    not null,
  data       jsonb   not null,
  updated_at bigint  not null,          -- hora de la edición en el dispositivo (ms)
  deleted    boolean not null default false,
  server_at  timestamptz not null default now(),
  primary key (user_id, tbl, id)
);

create index if not exists records_user_server_at on public.records (user_id, server_at);

alter table public.records enable row level security;
grant select, insert, update, delete on public.records to authenticated;

drop policy if exists "cada usuario ve sus datos" on public.records;
create policy "cada usuario ve sus datos" on public.records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Guarda un lote de registros. Si el mismo registro se editó en dos
-- dispositivos, gana la edición más reciente (updated_at mayor).
create or replace function public.push_records(items jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.records as r (user_id, tbl, id, data, updated_at, deleted, server_at)
  select auth.uid(), i->>'tbl', i->>'id', i->'data', (i->>'updated_at')::bigint,
         coalesce((i->>'deleted')::boolean, false), clock_timestamp()
  from jsonb_array_elements(items) as i
  on conflict (user_id, tbl, id) do update
    set data = excluded.data,
        updated_at = excluded.updated_at,
        deleted = excluded.deleted,
        server_at = clock_timestamp()
    where excluded.updated_at > r.updated_at;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.push_records(jsonb) to authenticated;
