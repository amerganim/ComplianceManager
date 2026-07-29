// =====================================================================
// Pluggable alert layer — ONE sendAlert(channel, recipient, message).
// Wired to email now (Resend). Swap in WhatsApp later by adding a case
// here; nothing else in the codebase changes. (PLAN.md guiding rule +
// Phase 8.)
// =====================================================================

const CHANNELS = {
  email: sendEmail,
  whatsapp: sendWhatsApp,
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

// ---- WhatsApp via Meta Cloud API -----------------------------------
// Needs WHATSAPP_TOKEN + WHATSAPP_PHONE_ID (from a verified Meta Business
// / WhatsApp Business account). Outside the 24h customer-service window
// you must use an approved message *template*; set WHATSAPP_TEMPLATE to
// send template messages, otherwise a plain text body is sent (fine for
// testing inside the window). Dry-runs to the console without a token so
// the whole pipeline is testable before Meta is set up.
async function sendWhatsApp(recipient, message) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const body = `${message.subject}\n\n${message.text}`

  if (!token || !phoneId) {
    console.log(`[dry-run whatsapp] to=${recipient}\n  ${body.replace(/\n/g, '\n  ')}`)
    return { dryRun: true }
  }

  const to = String(recipient).replace(/[^\d]/g, '') // digits only, E.164
  const template = process.env.WHATSAPP_TEMPLATE
  const payload = template
    ? {
        messaging_product: 'whatsapp', to, type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: body.slice(0, 1000) }] }],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body } }

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WhatsApp failed (${res.status}): ${err}`)
  }
  return res.json()
}
