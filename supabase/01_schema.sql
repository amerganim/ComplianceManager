-- =====================================================================
-- RMG Compliance Tool — schema (v1)
-- Paste into Supabase SQL editor. Run 01_schema.sql, then 02_rls.sql.
-- =====================================================================

-- FACTORIES (tenants) -------------------------------------------------
create table if not exists factories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  created_at timestamptz default now()
);

-- PROFILES (users, linked to auth.users) ------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  factory_id uuid references factories(id) not null,
  full_name  text,
  role       text not null check (role in ('owner','manager')),
  email      text,
  phone      text
);

-- COMPLIANCE ITEMS (the heart of everything) --------------------------
create table if not exists compliance_items (
  id                uuid primary key default gen_random_uuid(),
  factory_id        uuid references factories(id) not null,
  name              text not null,                    -- e.g. "Fire License"
  category          text not null check (category in ('license','certificate','recurring_task')),
  issuing_authority text,
  issue_date        date,
  expiry_date       date,                             -- for recurring_task = next due date
  recurrence_days   int,                              -- null for licenses; e.g. 90 for quarterly
  assigned_to       uuid references profiles(id),
  notes             text,
  document_url      text,                             -- nullable now; Phase 7 hook
  created_at        timestamptz default now()
);

create index if not exists compliance_items_factory_idx on compliance_items(factory_id);
create index if not exists compliance_items_expiry_idx  on compliance_items(expiry_date);

-- TASK COMPLETIONS (Phase 5 — auditors want proof it *happened*) ------
create table if not exists task_completions (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid references compliance_items(id) on delete cascade not null,
  completed_at  timestamptz default now(),
  completed_by  uuid references profiles(id),
  note          text
);

-- ALERT LOG (prevents duplicate sends) --------------------------------
create table if not exists alert_log (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid references compliance_items(id) on delete cascade not null,
  threshold  text not null,               -- '90' | '60' | '30' | '7' | 'expired'
  channel    text not null,               -- 'email' | 'whatsapp'
  recipient  text not null,
  sent_at    timestamptz default now(),
  unique (item_id, threshold, recipient)  -- belt-and-braces against duplicates
);

-- =====================================================================
-- Helper: the caller's factory_id.
-- SECURITY DEFINER so it can read `profiles` WITHOUT triggering the
-- profiles RLS policy (which itself calls this function -> would recurse).
-- =====================================================================
create or replace function current_factory_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select factory_id from profiles where id = auth.uid()
$$;

-- =====================================================================
-- Onboarding RPC: create a factory + the caller's owner profile in one
-- atomic call. SECURITY DEFINER because a brand-new user has no
-- factory_id yet, so the normal insert policy would reject them.
-- The app calls supabase.rpc('register_factory', { ... }) right after
-- sign-up. Refuses to run if the caller already has a profile.
-- =====================================================================
create or replace function register_factory(
  factory_name text,
  full_name    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_factory_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'profile already exists for this user';
  end if;

  insert into factories (name) values (factory_name)
  returning id into new_factory_id;

  insert into profiles (id, factory_id, full_name, role, email)
  values (auth.uid(), new_factory_id, full_name, 'owner',
          (select email from auth.users where id = auth.uid()));

  return new_factory_id;
end;
$$;
