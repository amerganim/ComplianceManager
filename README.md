# RMG Compliance Tool

Keep your buyer, with less pain — never let a license expire, never fail an audit on avoidable paperwork.

Built for small-to-mid Bangladesh garment factories. Compliance manager uses it daily; owner/MD glances at the dashboard.

## Stack

- **Front:** React (Vite) + Tailwind
- **Back:** Supabase (Postgres + Auth + Row-Level Security + Storage)
- **Scheduler:** GitHub Actions daily workflow (free) — or Supabase `pg_cron`

## What's built (PLAN.md phases 1–5)

| Phase | Feature | Where |
|------|---------|-------|
| 1 | Secure multi-tenant auth + RLS | `supabase/`, `src/context/AuthContext.jsx` |
| 2 | Compliance-item CRUD + computed status | `src/pages/Items.jsx`, `src/lib/status.js` |
| 3 | Owner dashboard (counters, readiness, what's next) | `src/pages/Dashboard.jsx` |
| 4 | Reminder engine + email (90/60/30/7/expired) | `scripts/send-reminders.mjs`, `scripts/lib/alerts.mjs` |
| 5 | Recurring-task "mark done" + reset | `src/lib/useItems.js` (`markDone`) |
| 6 | CAP tracker: import auditor Excel → track findings → export status report | `src/lib/cap.js`, `src/pages/Caps.jsx`, `src/pages/CapDetail.jsx` |
| 7 | Document repo (versioned, Storage-backed) + one-click print-ready audit binder | `src/lib/documents.js`, `src/pages/AuditBinder.jsx`, `supabase/05_documents.sql` |
| 8 | WhatsApp alert channel + per-factory channel choice (email/WhatsApp/both) | `scripts/lib/alerts.mjs`, `scripts/lib/targets.mjs`, `src/pages/Settings.jsx`, `supabase/06_whatsapp.sql` |

Two guiding rules are load-bearing in the code:
- **Status is computed, never stored** — single source of truth in `src/lib/status.js`, reused by the list, dashboard, and reminder job.
- **One pluggable `sendAlert(channel, recipient, message)`** — `scripts/lib/alerts.mjs`, wired to email now; add WhatsApp later without touching callers.

## Setup

1. **Create a Supabase project** (free tier is fine).
2. In the SQL editor, run in order:
   - `supabase/01_schema.sql`
   - `supabase/02_rls.sql`
   - `supabase/04_cap.sql` (CAP tracker tables + RLS)
   - `supabase/05_documents.sql` (document repo + private Storage bucket + RLS)
   - `supabase/06_whatsapp.sql` (per-factory alert channel + factory update policy)
3. **Env:** copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from Supabase → Project Settings → API).
4. Install and run:

```bash
npm install
npm run dev
```

5. Open the app, click **Create factory account**, and you're in. (In Supabase → Auth, turning **off** "Confirm email" makes signup one-step for the pilot.)
6. *(Optional)* Seed demo data for a convincing dashboard: edit `supabase/03_seed_demo.sql` with your `factory_id` and run it.

## Multi-tenant isolation (verify this deliberately — Phase 1 exit criteria)

Create two factory accounts. Add items in each. Confirm a signed-in user of Factory A cannot see Factory B's rows. RLS enforces this at the database, not the UI.

## Reminder engine

Runs daily, emails the assigned manager + factory owner as each item crosses 90/60/30/7 days and on expiry, deduped via `alert_log`.

**Local dry-run** (logs emails instead of sending — no provider needed):

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run remind
```

**Production:** add repo secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ALERT_FROM_EMAIL` (and, for WhatsApp, `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID`); the `.github/workflows/daily-reminders.yml` workflow runs at 03:00 UTC (~09:00 BD) and is also runnable on demand.

**Channels (Phase 8):** each factory picks email / WhatsApp / both in Settings. The engine routes every alert through one `sendAlert(channel, recipient, message)` — email via Resend, WhatsApp via the Meta Cloud API — resolving recipients per channel (emails vs. E.164 phones) with recipient-level dedup. Without provider keys, each channel dry-runs to the console, so the whole pipeline is testable before any provider is connected.

## Next (let the first paying customer fund it)

Phase 6 CAP tracker → Phase 7 doc repo + audit binder → Phase 8 WhatsApp. See `../PLAN.md`.
