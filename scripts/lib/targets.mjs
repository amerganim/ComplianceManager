// =====================================================================
// Pure channel/recipient resolution — decides WHO gets alerted on WHICH
// channel, given a factory's preference. No I/O, so it unit-tests alone.
//
// A "target" is { channel, recipient }: an email address for the email
// channel, an E.164 phone number for whatsapp.
// =====================================================================

export function channelsFor(pref) {
  if (pref === 'both') return ['email', 'whatsapp']
  if (pref === 'whatsapp') return ['whatsapp']
  return ['email'] // default / unknown -> email
}

/**
 * @param pref 'email' | 'whatsapp' | 'both'
 * @param contacts {
 *   ownerEmails: string[], ownerPhones: string[],
 *   assigneeEmail?: string|null, assigneePhone?: string|null
 * }
 * @returns Array<{channel, recipient}> deduped within each channel.
 */
export function resolveTargets(pref, contacts) {
  const targets = []
  for (const channel of channelsFor(pref)) {
    const set = new Set()
    if (channel === 'email') {
      for (const e of contacts.ownerEmails || []) if (e) set.add(e)
      if (contacts.assigneeEmail) set.add(contacts.assigneeEmail)
    } else {
      for (const p of contacts.ownerPhones || []) if (p) set.add(p)
      if (contacts.assigneePhone) set.add(contacts.assigneePhone)
    }
    for (const recipient of set) targets.push({ channel, recipient })
  }
  return targets
}
