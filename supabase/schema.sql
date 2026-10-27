begin;

create table if not exists public.app_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 10485760),
  updated_at timestamptz not null default now()
);
alter table public.app_snapshots enable row level security;
revoke all on public.app_snapshots from anon;
grant select, insert, update, delete on public.app_snapshots to authenticated;
create policy "Own snapshots select" on public.app_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own snapshots insert" on public.app_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own snapshots update" on public.app_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own snapshots delete" on public.app_snapshots for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.asset_manifest (
  path text primary key,
  object_key text not null,
  source_url text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  content_type text not null,
  bytes bigint not null check (bytes >= 0),
  acquired_at timestamptz not null
);
alter table public.asset_manifest enable row level security;
grant select on public.asset_manifest to anon, authenticated;
create policy "Public asset inventory" on public.asset_manifest for select to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('simulator-assets', 'simulator-assets', true, 20971520),
       ('simulator-user-files', 'simulator-user-files', false, 20971520)
on conflict (id) do nothing;
create policy "Own files select" on storage.objects for select to authenticated
  using (bucket_id = 'simulator-user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'simulator-user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own files update" on storage.objects for update to authenticated
  using (bucket_id = 'simulator-user-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'simulator-user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'simulator-user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
