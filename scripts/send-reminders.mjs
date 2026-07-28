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

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

const CHANNEL = 'email' // swap/extend via the pluggable alert layer

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

  const [{ data: items, error: itemsErr }, { data: profiles }, { data: logs }] =
    await Promise.all([
      supabase.from('compliance_items').select('*'),
      supabase.from('profiles').select('id, factory_id, role, email'),
      supabase.from('alert_log').select('item_id, threshold'),
    ])
  if (itemsErr) throw itemsErr

  const factoryName = new Map()
  const { data: factories } = await supabase.from('factories').select('id, name')
  for (const f of factories ?? []) factoryName.set(f.id, f.name)

  // (item_id|threshold) already alerted -> skip.
  const alerted = new Set((logs ?? []).map((l) => `${l.item_id}|${l.threshold}`))

  // Fast lookups for recipients.
  const ownersByFactory = new Map() // factory_id -> [email]
  const profileEmail = new Map()    // profile_id -> email
  for (const p of profiles ?? []) {
    if (p.email) profileEmail.set(p.id, p.email)
    if (p.role === 'owner' && p.email) {
      if (!ownersByFactory.has(p.factory_id)) ownersByFactory.set(p.factory_id, [])
      ownersByFactory.get(p.factory_id).push(p.email)
    }
  }

  let sent = 0
  for (const item of items ?? []) {
    const days = daysLeft(item.expiry_date, today)
    const bucket = bucketFor(days)
    if (!bucket) continue
    if (alerted.has(`${item.id}|${bucket}`)) continue

    // Recipients: factory owner(s) + assigned manager, deduped.
    const recipients = new Set(ownersByFactory.get(item.factory_id) ?? [])
    if (item.assigned_to && profileEmail.has(item.assigned_to)) {
      recipients.add(profileEmail.get(item.assigned_to))
    }
    if (recipients.size === 0) {
      console.warn(`No recipient for item ${item.id} (${item.name}); skipping.`)
      continue
    }

    const message = buildMessage(factoryName.get(item.factory_id) ?? 'your factory', item, days, bucket)

    for (const to of recipients) {
      try {
        await sendAlert(CHANNEL, to, message)
        await supabase.from('alert_log').insert({
          item_id: item.id,
          threshold: bucket,
          channel: CHANNEL,
          recipient: to,
        })
        sent += 1
      } catch (err) {
        // One bad address must not sink the whole run.
        console.error(`Failed alert for ${item.name} -> ${to}: ${err.message}`)
      }
    }
  }

  // ------------------------------------------------------------------
  // CAP findings pass (Phase 6) — nudge on approaching/passed deadlines.
  // Same tightest-bucket-fires-once discipline, own log table.
  // ------------------------------------------------------------------
  sent += await remindCapFindings({ supabase, today, factoryName, ownersByFactory, profileEmail })

  console.log(`Reminder run complete. Alerts sent/logged: ${sent}.`)
}

const CAP_THRESHOLDS = [3, 7, 14]

function capBucketFor(days) {
  if (days === null) return null
  if (days < 0) return 'overdue'
  for (const th of CAP_THRESHOLDS) if (days <= th) return String(th)
  return null
}

async function remindCapFindings({ supabase, today, factoryName, ownersByFactory, profileEmail }) {
  const [{ data: findings }, { data: logs }] = await Promise.all([
    // Only findings still needing work can be nudged.
    supabase.from('cap_findings').select('*').neq('status', 'closed'),
    supabase.from('cap_alert_log').select('finding_id, threshold'),
  ])
  const alerted = new Set((logs ?? []).map((l) => `${l.finding_id}|${l.threshold}`))

  let sent = 0
  for (const f of findings ?? []) {
    const days = daysLeft(f.deadline, today)
    const bucket = capBucketFor(days)
    if (!bucket) continue
    if (alerted.has(`${f.id}|${bucket}`)) continue

    const recipients = new Set(ownersByFactory.get(f.factory_id) ?? [])
    if (f.assigned_to && profileEmail.has(f.assigned_to)) recipients.add(profileEmail.get(f.assigned_to))
    if (recipients.size === 0) continue

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

    for (const to of recipients) {
      try {
        await sendAlert(CHANNEL, to, message)
        await supabase.from('cap_alert_log').insert({
          finding_id: f.id, threshold: bucket, channel: CHANNEL, recipient: to,
        })
        sent += 1
      } catch (err) {
        console.error(`Failed CAP alert for ${f.id} -> ${to}: ${err.message}`)
      }
    }
  }
  return sent
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
