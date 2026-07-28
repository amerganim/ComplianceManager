// =====================================================================
// Pluggable alert layer — ONE sendAlert(channel, recipient, message).
// Wired to email now (Resend). Swap in WhatsApp later by adding a case
// here; nothing else in the codebase changes. (PLAN.md guiding rule +
// Phase 8.)
// =====================================================================

const CHANNELS = {
  email: sendEmail,
  // whatsapp: sendWhatsApp,   // Phase 8 — add behind this same interface
}

export async function sendAlert(channel, recipient, message) {
  const fn = CHANNELS[channel]
  if (!fn) throw new Error(`Unknown alert channel: ${channel}`)
  return fn(recipient, message)
}

// ---- Email via Resend (simplest free-tier transactional email) -------
async function sendEmail(recipient, message) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.ALERT_FROM_EMAIL || 'alerts@example.com'

  // Dry-run mode: without a key we log instead of send, so the whole
  // pipeline is testable end-to-end before any provider is set up.
  if (!key) {
    console.log(`[dry-run email] to=${recipient}\n  ${message.subject}\n  ${message.text}`)
    return { dryRun: true }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipient,
      subject: message.subject,
      text: message.text,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend failed (${res.status}): ${body}`)
  }
  return res.json()
}
