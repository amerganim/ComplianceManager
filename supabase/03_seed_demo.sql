-- =====================================================================
-- OPTIONAL demo seed — makes the dashboard "look alive" for a demo.
-- Run in the Supabase SQL editor (service role) AFTER a factory exists.
--
-- It resolves the target factory BY NAME, so there's no id to copy.
-- Change 'Factory B' below if you want to seed a different factory.
-- Dates are relative to today so the green/yellow/red spread stays
-- realistic whenever you demo.
-- =====================================================================

do $$
declare
  f uuid;
begin
  select id into f from factories
    where name = 'Factory B'
    order by created_at desc
    limit 1;

  if f is null then
    raise exception 'No factory named "Factory B" found. Check the factories table for the exact name.';
  end if;

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

  raise notice 'Seeded 9 demo items into factory %', f;
end $$;
