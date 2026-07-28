// =====================================================================
// CAP import/export logic — PURE (no xlsx, no React) so it unit-tests
// with plain arrays. The UI layer does XLSX.read -> array-of-arrays and
// hands it here; export builds arrays here and the UI writes the .xlsx.
//
// Real auditor CAP Excels vary wildly (BV / RSC / Intertek / SMETA each
// differ), so we detect the header row and fuzzy-map columns to fields
// instead of assuming fixed positions.
// =====================================================================

export const FINDING_FIELDS = [
  'ref', 'category', 'severity', 'description',
  'corrective_action', 'root_cause', 'deadline', 'assigned', 'status',
]

// Header keyword aliases. First field whose keyword is found in a header
// claims that column. Order matters: more specific fields go first.
const HEADER_ALIASES = {
  ref:               ['clause', 'requirement', 'ref', 'item no', 'item#', 'sl', 'serial', 'nc no', 'finding no', 's/n'],
  severity:          ['severity', 'rating', 'priority', 'criticality', 'risk level', 'zt', 'category of finding'],
  category:          ['category', 'area', 'section', 'topic', 'element', 'pillar'],
  root_cause:        ['root cause', 'cause'],
  corrective_action: ['corrective', 'corrective action', 'cap', 'action plan', 'action taken', 'remediation', 'action required'],
  description:       ['finding', 'non-conformity', 'non conformity', 'nonconformity', 'observation', 'issue', 'description', 'details', 'deviation', 'gap'],
  deadline:          ['deadline', 'due date', 'due', 'target date', 'target completion', 'completion date', 'timeline', 'by when'],
  assigned:          ['responsible', 'assigned', 'owner', 'person', 'accountable', 'by whom'],
  status:            ['status', 'state', 'progress', 'open/closed', 'closure'],
}

export function normHeader(v) {
  return String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Score a row by how many known header keywords it contains — used to
// find the real header row (auditors love title/logo rows up top).
function headerScore(row) {
  const cells = row.map(normHeader).filter(Boolean)
  let score = 0
  for (const cell of cells) {
    for (const aliases of Object.values(HEADER_ALIASES)) {
      if (aliases.some((a) => cell.includes(a))) { score += 1; break }
    }
  }
  return score
}

/** Index of the most header-like row within the first `scan` rows. */
export function findHeaderRow(aoa, scan = 15) {
  let best = -1, bestScore = 0
  const limit = Math.min(scan, aoa.length)
  for (let i = 0; i < limit; i++) {
    const s = headerScore(aoa[i] ?? [])
    if (s > bestScore) { bestScore = s; best = i }
  }
  return bestScore >= 2 ? best : -1 // need at least 2 known headers to trust it
}

/** Map each known field to a column index for the given header row. */
export function detectMapping(headerRow) {
  const headers = headerRow.map(normHeader)
  const mapping = {}
  const taken = new Set()
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (let col = 0; col < headers.length; col++) {
      if (taken.has(col) || !headers[col]) continue
      // Prefer exact-ish match, else substring.
      if (aliases.some((a) => headers[col] === a || headers[col].includes(a))) {
        mapping[field] = col
        taken.add(col)
        break
      }
    }
  }
  return mapping
}

const SEVERITY_MAP = [
  [/(zero\s*tol|zt|critical|imminent|major non|non-negotiable)/i, 'critical'],
  [/(major|high|serious)/i, 'major'],
  [/(minor|low|medium)/i, 'minor'],
  [/(observation|opportunity|ofi|recommendation|note)/i, 'observation'],
]

export function normalizeSeverity(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  for (const [re, out] of SEVERITY_MAP) if (re.test(s)) return out
  return 'major' // unknown-but-present findings default to major, not dropped
}

const STATUS_MAP = [
  [/(closed|done|complete|resolved|verified|ok\b)/i, 'closed'],
  [/(progress|ongoing|wip|partial|pending verification)/i, 'in_progress'],
  [/(open|pending|not started|outstanding)/i, 'open'],
]

export function normalizeStatus(v) {
  const s = String(v ?? '').trim()
  if (!s) return 'open'
  for (const [re, out] of STATUS_MAP) if (re.test(s)) return out
  return 'open'
}

/** Excel serial, Date, or string -> ISO yyyy-mm-dd (or null). */
export function parseDeadline(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30).
    const ms = Math.round((v - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return isNaN(d) ? null : d.toISOString().slice(0, 10)
  }
  const d = new Date(String(v))
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

function cell(row, mapping, field) {
  const col = mapping[field]
  if (col == null) return null
  const v = row[col]
  return v == null || v === '' ? null : v
}

/**
 * Turn one sheet (array-of-arrays incl. header rows) into findings.
 * Returns { headers, mapping, findings } — findings carry a `raw`
 * {header: value} snapshot for faithful re-export.
 */
export function sheetToFindings(sheetName, aoa) {
  const headerIdx = findHeaderRow(aoa)
  if (headerIdx < 0) return { headers: [], mapping: {}, findings: [] }
  const headerRow = aoa[headerIdx]
  const headers = headerRow.map((h) => String(h ?? '').trim())
  const mapping = detectMapping(headerRow)

  const findings = []
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? []
    // Skip fully empty rows.
    if (!row.some((c) => c != null && String(c).trim() !== '')) continue

    const description = cell(row, mapping, 'description')
    const action = cell(row, mapping, 'corrective_action')
    const severityCell = cell(row, mapping, 'severity')
    const deadlineCell = cell(row, mapping, 'deadline')
    // A row with neither a finding nor an action is noise (spacers).
    if (!description && !action) continue
    // Totals/summary rows: a lone description that reads like a total and
    // has no severity/action/deadline. Narrow enough not to drop real
    // findings (which almost always carry one of those fields).
    if (
      description && !action && !severityCell && !deadlineCell &&
      /^\s*(total|grand\s*total|sub-?total|summary)\b|findings?\s*:/i.test(String(description))
    ) continue

    const raw = {}
    headers.forEach((h, i) => { if (h) raw[h] = row[i] ?? null })

    findings.push({
      sheet_name: sheetName,
      ref: cell(row, mapping, 'ref') != null ? String(cell(row, mapping, 'ref')) : null,
      category: cell(row, mapping, 'category') != null ? String(cell(row, mapping, 'category')) : null,
      severity: normalizeSeverity(cell(row, mapping, 'severity')),
      description: description != null ? String(description) : null,
      corrective_action: action != null ? String(action) : null,
      root_cause: cell(row, mapping, 'root_cause') != null ? String(cell(row, mapping, 'root_cause')) : null,
      deadline: parseDeadline(cell(row, mapping, 'deadline')),
      status: normalizeStatus(cell(row, mapping, 'status')),
      assigned_name: cell(row, mapping, 'assigned') != null ? String(cell(row, mapping, 'assigned')) : null,
      raw,
    })
  }
  return { headers, mapping, findings }
}

/** Parse a whole workbook (given a {sheetName: aoa} map). */
export function workbookToFindings(sheets) {
  const all = []
  const perSheet = {}
  for (const [name, aoa] of Object.entries(sheets)) {
    const res = sheetToFindings(name, aoa)
    perSheet[name] = res
    all.push(...res.findings)
  }
  return { findings: all, perSheet }
}

const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' }

/**
 * Build export arrays-of-arrays, one per original sheet, preserving the
 * auditor's own columns and appending our tracking columns. The UI turns
 * these into worksheets. `findings` must carry `raw` + current tracking.
 */
export function findingsToExportSheets(findings) {
  const bySheet = {}
  for (const f of findings) {
    const s = f.sheet_name || 'CAP'
    ;(bySheet[s] ||= []).push(f)
  }

  const TRACK_COLS = ['EzPz Status', 'Evidence', 'Date Closed', 'Tracking Notes']
  const out = {}
  for (const [sheet, list] of Object.entries(bySheet)) {
    // Union of original headers, preserving first-seen order.
    const origHeaders = []
    const seen = new Set()
    for (const f of list) {
      for (const h of Object.keys(f.raw || {})) {
        if (!seen.has(h)) { seen.add(h); origHeaders.push(h) }
      }
    }
    const header = [...origHeaders, ...TRACK_COLS]
    const rows = [header]
    for (const f of list) {
      const row = origHeaders.map((h) => f.raw?.[h] ?? '')
      row.push(
        STATUS_LABEL[f.status] || f.status || '',
        f.proof_url || f.proof_note || '',
        f.closed_at ? String(f.closed_at).slice(0, 10) : '',
        '',
      )
      rows.push(row)
    }
    out[sheet] = rows
  }
  return out
}

/** {open, in_progress, closed, total} for a list of findings. */
export function capSummary(findings) {
  const acc = { open: 0, in_progress: 0, closed: 0, total: findings.length }
  for (const f of findings) acc[f.status] = (acc[f.status] ?? 0) + 1
  return acc
}

export const SEVERITY_META = {
  critical:    { label: 'Critical',    text: 'text-expired',  bg: 'bg-expired/10',  ring: 'ring-expired/30' },
  major:       { label: 'Major',       text: 'text-expiring', bg: 'bg-expiring/10', ring: 'ring-expiring/30' },
  minor:       { label: 'Minor',       text: 'text-slate-600', bg: 'bg-slate-100',  ring: 'ring-slate-200' },
  observation: { label: 'Observation', text: 'text-valid',    bg: 'bg-valid/10',    ring: 'ring-valid/30' },
}
