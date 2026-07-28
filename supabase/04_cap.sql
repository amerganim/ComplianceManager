-- =====================================================================
-- Phase 6 — CAP tracker (Corrective Action Plan)
-- Run AFTER 01_schema.sql + 02_rls.sql.
--
-- A CAP is one auditor's finding list (BV / RSC / Intertek / SMETA…).
-- We import the auditor's multi-tab Excel into cap_findings, track each
-- to closure, and export a status report back in the auditor's own
-- layout (that's why we keep the original row in `raw`).
-- =====================================================================

-- One imported audit / corrective-action plan.
create table if not exists caps (
  id         uuid primary key default gen_random_uuid(),
  factory_id uuid references factories(id) not null,
  auditor    text,                       -- 'BV' | 'RSC' | 'Intertek' | free text
  title      text not null,              -- e.g. "RSC Follow-up Mar 2026"
  audit_date date,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- One finding / non-conformity within a CAP.
create table if not exists cap_findings (
  id                uuid primary key default gen_random_uuid(),
  cap_id            uuid references caps(id) on delete cascade not null,
  factory_id        uuid references factories(id) not null,  -- denormalised for simple RLS
  sheet_name        text,                 -- which Excel tab it came from
  ref               text,                 -- clause / requirement / item no.
  category          text,                 -- e.g. "Fire Safety", "Wages"
  severity          text,                 -- 'critical' | 'major' | 'minor' | 'observation'
  description       text,                 -- the finding / non-conformity
  corrective_action text,                 -- required CAP action
  root_cause        text,
  deadline          date,                 -- target completion date
  assigned_to       uuid references profiles(id),
  status            text not null default 'open'
                      check (status in ('open','in_progress','closed')),
  proof_url         text,                 -- evidence link (Phase 7 = Storage upload)
  proof_note        text,
  closed_at         timestamptz,
  raw               jsonb,                -- original row {header: value} for faithful export
  created_at        timestamptz default now()
);

create index if not exists cap_findings_cap_idx      on cap_findings(cap_id);
create index if not exists cap_findings_factory_idx  on cap_findings(factory_id);
create index if not exists cap_findings_deadline_idx on cap_findings(deadline);

-- CAP alert log (separate from compliance-item alert_log; nudges assignees).
create table if not exists cap_alert_log (
  id         uuid primary key default gen_random_uuid(),
  finding_id uuid references cap_findings(id) on delete cascade not null,
  threshold  text not null,               -- '14' | '7' | '3' | 'overdue'
  channel    text not null,
  recipient  text not null,
  sent_at    timestamptz default now(),
  unique (finding_id, threshold, recipient)
);

-- --------------------------------------------------------------------
-- Row-Level Security — scoped to the caller's factory, same firewall.
-- --------------------------------------------------------------------
alter table caps          enable row level security;
alter table cap_findings  enable row level security;
alter table cap_alert_log enable row level security;

drop policy if exists "own factory caps" on caps;
create policy "own factory caps" on caps
  for all using (factory_id = current_factory_id())
           with check (factory_id = current_factory_id());

drop policy if exists "own factory findings" on cap_findings;
create policy "own factory findings" on cap_findings
  for all using (factory_id = current_factory_id())
           with check (factory_id = current_factory_id());

drop policy if exists "own factory cap alerts" on cap_alert_log;
create policy "own factory cap alerts" on cap_alert_log
  for all using (
    finding_id in (select id from cap_findings where factory_id = current_factory_id())
  ) with check (
    finding_id in (select id from cap_findings where factory_id = current_factory_id())
  );
