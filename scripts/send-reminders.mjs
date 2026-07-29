// =====================================================================
// Daily reminder engine (Phase 4). Runs on a schedule (GitHub Actions
// or Supabase pg_cron). Uses the SERVICE ROLE key so it can read every
// factory's items — RLS is bypassed intentionally here, server-side only.
//
//   for each item with an expiry:
//     bucket = tightest crossed threshold (90/60/30/7) or 'expired'
//     if bucket set and no alert_log row for (item, bucket):
//         sendAlert -> assigned manager + factory owner(s); log each
//
// Because time only moves forward, the "tightest bucket" tightens
// monotonically, so each threshold fires exactly once. A freshly-added,
// already-urgent item gets one email (its tightest bucket), not four.
// =====================================================================
import { createClient } from '@supabase/supabase-js'
import { daysLeft } from '../src/lib/status.js'
import { sendAlert } from './lib/alerts.mjs'
import { resolveTargets } from './lib/targets.mjs'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

// Ascending so the FIRST match is the tightest applicable threshold.
const THRESHOLDS = [7, 30, 60, 90]

function bucketFor(days) {
  if (days === null) return null
  if (days < 0) return 'expired'
  for (const th of THRESHOLDS) if (days <= th) return String(th)
  return null // green — nothing to say
}

function buildMessage(factoryName, item, days, bucket) {
  const when =
    bucket === 'expired'
      ? `EXPIRED ${Math.abs(days)} day(s) ago`
      : `expires in ${days} day(s)`
  const subject = `⚠️ ${item.name} ${bucket === 'expired' ? 'has EXPIRED' : `expires in ${days} days`} — ${factoryName}`
  const text =
    `Compliance reminder for ${factoryName}\n\n` +
    `Item:     ${item.name}\n` +
    `Category: ${item.category}\n` +
    `Status:   ${when} (due ${item.expiry_date})\n` +
    (item.issuing_authority ? `Issuer:   ${item.issuing_authority}\n` : '') +
    `\nRenew it before the deadline to stay audit-ready.`
  return { subject, text }
}

async function main() {
  const today = new Date()

  const [
    { data: items, error: itemsErr }, { data: profiles }, { data: logs },
    { data: findings }, { data: capLogs },
  ] = await Promise.all([
    supabase.from('compliance_items').select('*'),
    supabase.from('profiles').select('id, factory_id, role, email, phone'),
    supabase.from('alert_log').select('item_id, threshold, recipient'),
    supabase.from('cap_findings').select('*').neq('status', 'closed'),
    supabase.from('cap_alert_log').select('finding_id, threshold, recipient'),
  ])
  if (itemsErr) throw itemsErr

  const factoryName = new Map()
  const factoryChannel = new Map()  // factory_id -> 'email' | 'whatsapp' | 'both'
  const { data: factories } = await supabase.from('factories').select('id, name, alert_channel')
  for (const f of factories ?? []) {
    factoryName.set(f.id, f.name)
    factoryChannel.set(f.id, f.alert_channel || 'email')
  }

  // Recipient-level dedup so an item+threshold never re-alerts the same
  // address, yet 'both' channels (email + whatsapp) each get their send.
  // Shared across item + CAP passes (UUIDs don't collide between them).
  const alerted = new Set([
    ...(logs ?? []).map((l) => `${l.item_id}|${l.threshold}|${l.recipient}`),
    ...(capLogs ?? []).map((l) => `${l.finding_id}|${l.threshold}|${l.recipient}`),
  ])

  // Contact lookups, split by channel type.
  const ownerEmails = new Map()  // factory_id -> [email]
  const ownerPhones = new Map()  // factory_id -> [phone]
  const profileEmail = new Map() // profile_id -> email
  const profilePhone = new Map() // profile_id -> phone
  const push = (map, key, val) => { if (!val) return; if (!map.has(key)) map.set(key, []); map.get(key).push(val) }
  for (const p of profiles ?? []) {
    if (p.email) profileEmail.set(p.id, p.email)
    if (p.phone) profilePhone.set(p.id, p.phone)
    if (p.role === 'owner') { push(ownerEmails, p.factory_id, p.email); push(ownerPhones, p.factory_id, p.phone) }
  }

  const contactsFor = (factoryId, assignedTo) => ({
    ownerEmails: ownerEmails.get(factoryId) ?? [],
    ownerPhones: ownerPhones.get(factoryId) ?? [],
    assigneeEmail: assignedTo ? profileEmail.get(assignedTo) : null,
    assigneePhone: assignedTo ? profilePhone.get(assignedTo) : null,
  })

  // Send a message to every resolved target, deduped + logged. Shared by
  // both the item and CAP passes. `logRow(channel, recipient)` returns the
  // row to insert into the relevant *_alert_log table.
  const dispatch = async (idKey, bucket, factoryId, assignedTo, message, logTable, logRow) => {
    const pref = factoryChannel.get(factoryId) || 'email'
    const targets = resolveTargets(pref, contactsFor(factoryId, assignedTo))
    let n = 0
    for (const { channel, recipient } of targets) {
      if (alerted.has(`${idKey}|${bucket}|${recipient}`)) continue
      try {
        await sendAlert(channel, recipient, message)
        await supabase.from(logTable).insert(logRow(channel, recipient))
        alerted.add(`${idKey}|${bucket}|${recipient}`)
        n += 1
      } catch (err) {
        // One bad address/number must not sink the whole run.
        console.error(`Failed ${channel} alert (${idKey}) -> ${recipient}: ${err.message}`)
      }
    }
    return n
  }

  let sent = 0
  for (const item of items ?? []) {
    const days = daysLeft(item.expiry_date, today)
    const bucket = bucketFor(days)
    if (!bucket) continue

    const message = buildMessage(factoryName.get(item.factory_id) ?? 'your factory', item, days, bucket)
    sent += await dispatch(
      item.id, bucket, item.factory_id, item.assigned_to, message,
      'alert_log',
      (channel, recipient) => ({ item_id: item.id, threshold: bucket, channel, recipient })
    )
  }

  // ------------------------------------------------------------------
  // CAP findings pass (Phase 6) — nudge on approaching/passed deadlines,
  // through the same channel-aware dispatch. Own log table.
  // ------------------------------------------------------------------
  for (const f of findings ?? []) {
    const days = daysLeft(f.deadline, today)
    const bucket = capBucketFor(days)
    if (!bucket) continue

    const fname = factoryName.get(f.factory_id) ?? 'your factory'
    const when = bucket === 'overdue' ? `is OVERDUE by ${Math.abs(days)} day(s)` : `is due in ${days} day(s)`
    const message = {
      subject: `⚠️ CAP finding ${bucket === 'overdue' ? 'OVERDUE' : `due in ${days}d`} — ${fname}`,
      text:
        `Corrective action reminder for ${fname}\n\n` +
        `Finding:  ${f.description || '(no description)'}\n` +
        (f.corrective_action ? `Action:   ${f.corrective_action}\n` : '') +
        (f.severity ? `Severity: ${f.severity}\n` : '') +
        `Deadline: ${f.deadline} — ${when}\n\n` +
        `Close it out and attach evidence to stay audit-ready.`,
    }
    sent += await dispatch(
      f.id, bucket, f.factory_id, f.assigned_to, message,
      'cap_alert_log',
      (channel, recipient) => ({ finding_id: f.id, threshold: bucket, channel, recipient })
    )
  }

  console.log(`Reminder run complete. Alerts sent/logged: ${sent}.`)
}

const CAP_THRESHOLDS = [3, 7, 14]

function capBucketFor(days) {
  if (days === null) return null
  if (days < 0) return 'overdue'
  for (const th of CAP_THRESHOLDS) if (days <= th) return String(th)
  return null
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
