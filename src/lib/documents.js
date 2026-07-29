// =====================================================================
// Document + audit-binder helpers — PURE (no supabase, no React) so the
// path/version/binder logic unit-tests in isolation.
// =====================================================================
import { itemStatus, daysLeft } from './status.js'

/** Make a filename safe for a storage key: ASCII-ish, no spaces/slashes. */
export function sanitizeFilename(name) {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'file'
  const ext = (dot > 0 ? name.slice(dot + 1) : '').replace(/[^\w]+/g, '').toLowerCase()
  return ext ? `${base}.${ext}` : base
}

/** Storage key: <factory>/<item|_general>/<version>-<safe name>. */
export function buildStoragePath(factoryId, itemId, version, fileName) {
  const folder = itemId || '_general'
  return `${factoryId}/${folder}/${version}-${sanitizeFilename(fileName)}`
}

export function formatSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const isImage = (mime) => /^image\//i.test(mime || '')
export const isPdf = (mime) => /pdf/i.test(mime || '')

/** Next version = 1 + max existing version for that item. */
export function nextVersion(existingDocs) {
  if (!existingDocs?.length) return 1
  return Math.max(...existingDocs.map((d) => d.version || 0)) + 1
}

/**
 * Assemble the audit binder: only license/certificate items (the things
 * an auditor asks to see), each with its CURRENT document (if any),
 * sorted by status urgency (red first) then soonest expiry. Recurring
 * tasks are excluded — they're proven by completion records, not filed
 * certificates.
 */
export function assembleBinder(items, currentDocByItem, today = new Date()) {
  const rank = { expired: 0, expiring: 1, valid: 2 }
  const rows = items
    .filter((it) => it.category === 'license' || it.category === 'certificate')
    .map((it) => ({
      item: it,
      status: itemStatus(it, today),
      days: daysLeft(it.expiry_date, today),
      doc: currentDocByItem[it.id] || null,
    }))
    .sort((a, b) => {
      const r = rank[a.status] - rank[b.status]
      if (r !== 0) return r
      return (a.days ?? 1e9) - (b.days ?? 1e9)
    })

  const withDoc = rows.filter((r) => r.doc).length
  return {
    rows,
    total: rows.length,
    withDoc,
    missing: rows.filter((r) => !r.doc).map((r) => r.item.name),
    complete: rows.length > 0 && withDoc === rows.length,
  }
}
