-- =====================================================================
-- Phase 7 — Document repository + audit binder
-- Run AFTER 01/02 (and 04 if using CAP). Adds a versioned document store
-- backed by Supabase Storage, scoped per factory.
--
-- Storage layout (path convention enforced by the RLS policies below):
--     <factory_id>/<item_id>/<version>-<sanitized-filename>
-- The first path folder is the factory_id, so a user can only touch
-- objects inside their own factory's folder.
-- =====================================================================

create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  factory_id   uuid references factories(id) not null,
  item_id      uuid references compliance_items(id) on delete cascade, -- null = general/factory doc
  file_name    text not null,
  storage_path text not null unique,      -- object key in the 'documents' bucket
  mime_type    text,
  size_bytes   bigint,
  version      int  not null default 1,
  is_current   boolean not null default true,
  uploaded_by  uuid references profiles(id),
  uploaded_at  timestamptz default now(),
  notes        text
);

create index if not exists documents_item_idx    on documents(item_id);
create index if not exists documents_factory_idx on documents(factory_id);

-- At most one current version per item (auditors reject outdated docs).
create unique index if not exists documents_one_current_per_item
  on documents(item_id) where is_current and item_id is not null;

alter table documents enable row level security;

drop policy if exists "own factory documents" on documents;
create policy "own factory documents" on documents
  for all using (factory_id = current_factory_id())
           with check (factory_id = current_factory_id());

-- --------------------------------------------------------------------
-- Storage bucket + object policies (private bucket, factory-scoped).
-- --------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Read/write only objects whose first path folder is your factory_id.
drop policy if exists "factory read own docs" on storage.objects;
create policy "factory read own docs" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_factory_id()::text
  );

drop policy if exists "factory upload own docs" on storage.objects;
create policy "factory upload own docs" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_factory_id()::text
  );

drop policy if exists "factory update own docs" on storage.objects;
create policy "factory update own docs" on storage.objects
  for update using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_factory_id()::text
  );

drop policy if exists "factory delete own docs" on storage.objects;
create policy "factory delete own docs" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = current_factory_id()::text
  );
