-- =====================================================================
-- RMG Compliance Tool — Row-Level Security (v1)
-- Run AFTER 01_schema.sql. This is the tenant firewall: Factory A must
-- NEVER see Factory B's rows. Every table below is locked to the
-- caller's factory_id via current_factory_id().
-- =====================================================================

alter table factories        enable row level security;
alter table profiles         enable row level security;
alter table compliance_items enable row level security;
alter table task_completions enable row level security;
alter table alert_log        enable row level security;

-- FACTORIES: a user may read only their own factory row ----------------
drop policy if exists "see own factory" on factories;
create policy "see own factory" on factories
  for select using (id = current_factory_id());

-- PROFILES: read/write only within your own factory -------------------
-- Split per-command so INSERT gets a WITH CHECK (a bare `for all using`
-- leaves INSERT with no check -> blocked).
drop policy if exists "own factory profiles select" on profiles;
create policy "own factory profiles select" on profiles
  for select using (factory_id = current_factory_id());

drop policy if exists "own factory profiles insert" on profiles;
create policy "own factory profiles insert" on profiles
  for insert with check (factory_id = current_factory_id());

drop policy if exists "own factory profiles update" on profiles;
create policy "own factory profiles update" on profiles
  for update using (factory_id = current_factory_id())
             with check (factory_id = current_factory_id());

-- COMPLIANCE ITEMS: full CRUD scoped to your factory ------------------
drop policy if exists "own factory items select" on compliance_items;
create policy "own factory items select" on compliance_items
  for select using (factory_id = current_factory_id());

drop policy if exists "own factory items insert" on compliance_items;
create policy "own factory items insert" on compliance_items
  for insert with check (factory_id = current_factory_id());

drop policy if exists "own factory items update" on compliance_items;
create policy "own factory items update" on compliance_items
  for update using (factory_id = current_factory_id())
             with check (factory_id = current_factory_id());

drop policy if exists "own factory items delete" on compliance_items;
create policy "own factory items delete" on compliance_items
  for delete using (factory_id = current_factory_id());

-- TASK COMPLETIONS: scoped through the parent item's factory ----------
drop policy if exists "own factory completions" on task_completions;
create policy "own factory completions" on task_completions
  for all using (
    item_id in (select id from compliance_items where factory_id = current_factory_id())
  ) with check (
    item_id in (select id from compliance_items where factory_id = current_factory_id())
  );

-- ALERT LOG: scoped through the parent item's factory -----------------
drop policy if exists "own factory alerts" on alert_log;
create policy "own factory alerts" on alert_log
  for all using (
    item_id in (select id from compliance_items where factory_id = current_factory_id())
  ) with check (
    item_id in (select id from compliance_items where factory_id = current_factory_id())
  );
