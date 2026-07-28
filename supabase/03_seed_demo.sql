-- =====================================================================
-- OPTIONAL demo seed — makes the dashboard "look alive" for a demo.
-- Run this AFTER you have signed up in the app (which creates your
-- factory + owner profile). Grab your factory_id:
--
--   select factory_id from profiles where email = 'you@example.com';
--
-- Paste it below, then run. Dates are relative to today so the
-- green/yellow/red spread stays realistic whenever you demo.
-- =====================================================================

do $$
declare
  f uuid := 'PASTE-YOUR-FACTORY-ID-HERE'::uuid;
begin
  insert into compliance_items
    (factory_id, name, category, issuing_authority, issue_date, expiry_date, recurrence_days, notes)
  values
    -- RED: expired / urgent
    (f, 'Fire Safety License',        'license',        'Bangladesh Fire Service', now()::date - 700, now()::date - 12,  null, 'Renew immediately'),
    (f, 'Boiler Certificate',         'certificate',    'Dept. of Boilers',        now()::date - 350, now()::date + 18,  null, 'Inspector visit booked'),
    -- YELLOW: expiring soon
    (f, 'Factory License',            'license',        'Dept. of Inspection',     now()::date - 320, now()::date + 45,  null, null),
    (f, 'Group Insurance',            'certificate',    'Insurer',                 now()::date - 300, now()::date + 80,  null, null),
    -- GREEN: comfortably valid
    (f, 'Environmental Clearance',    'certificate',    'Dept. of Environment',    now()::date - 100, now()::date + 240, null, null),
    (f, 'Trade License',              'license',        'City Corporation',        now()::date - 60,  now()::date + 300, null, null),
    -- Recurring tasks (next-due in expiry_date)
    (f, 'Quarterly Fire Drill',       'recurring_task', null,                      now()::date - 80,  now()::date + 10,  90,   'All floors'),
    (f, 'Monthly Water Testing',      'recurring_task', null,                      now()::date - 25,  now()::date + 5,   30,   'ETP outflow'),
    (f, 'Annual Machine Maintenance', 'recurring_task', null,                      now()::date - 200, now()::date + 165, 365,  null);
end $$;
