-- =====================================================================
-- Phase 8 — WhatsApp alerts
-- Run AFTER 01/02. Adds a per-factory alert-channel preference and the
-- UPDATE policy a factory needs to change its own settings.
--
-- Recipients come from existing columns: profiles.email (email channel)
-- and profiles.phone (whatsapp channel). Phone numbers should be stored
-- in E.164 form (e.g. 8801XXXXXXXXX) for the Meta Cloud API.
-- =====================================================================

alter table factories
  add column if not exists alert_channel text not null default 'email'
    check (alert_channel in ('email', 'whatsapp', 'both'));

-- Factory members may change their own factory's settings (e.g. channel).
-- (The existing "see own factory" policy only covered SELECT.)
drop policy if exists "update own factory" on factories;
create policy "update own factory" on factories
  for update using (id = current_factory_id())
             with check (id = current_factory_id());

-- Let a user maintain their own phone number (for WhatsApp delivery).
-- profiles already has an UPDATE policy scoped to the factory (02_rls.sql),
-- so no extra policy is needed here — this comment is just a pointer.
