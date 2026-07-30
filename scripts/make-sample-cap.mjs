// Generates a realistic, messy multi-tab auditor CAP workbook for testing
// the CAP import (BV-style + RSC-style tabs, title rows, varied headers,
// mixed severities, some overdue deadlines). Writes sample-cap.xlsx and
// prints what the real importer detects.  Run: npm run sample
import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { workbookToFindings } from '../src/lib/cap.js'

const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d }

// --- Tab 1: Bureau Veritas style (title rows, then the table) ---------
const bv = XLSX.utils.aoa_to_sheet([
  ['BUREAU VERITAS — Social Audit Corrective Action Plan', null, null, null, null, null],
  ['Factory: (demo)', 'Audit date: ' + day(-20).toISOString().slice(0, 10), null, null, null, null],
  [],
  ['SL', 'Non-Conformity', 'Severity', 'Corrective Action', 'Responsible', 'Target Date'],
  [1, 'Blocked fire exit on 3rd floor (sewing)', 'Critical', 'Clear obstruction; keep exit paths marked and free', 'Admin Manager', day(-3)],
  [2, 'Some workers without valid appointment letters', 'Major', 'Issue appointment letters to all workers', 'HR Manager', day(9)],
  [3, 'Fire extinguishers past inspection date', 'Major', 'Service all extinguishers; log next due dates', 'Safety Officer', day(5)],
  [4, 'Housekeeping in chemical store below standard', 'Minor', 'Introduce daily 5S checklist for store', 'Store In-charge', day(25)],
  [5, 'First-aid box missing items on Floor 2', 'Minor', 'Restock and assign monthly check', 'Nurse', day(14)],
  [6, 'Consider posting evacuation maps in Bangla', 'Observation', 'Print and post bilingual evacuation maps', 'Admin', day(40)],
  [null, 'Total non-conformities: 5', null, null, null, null], // summary row -> ignored
])

// --- Tab 2: RSC style (different columns entirely) --------------------
const rsc = XLSX.utils.aoa_to_sheet([
  ['Requirement', 'Observation', 'Risk Level', 'Root Cause', 'Due Date', 'Status'],
  ['ELEC-04', 'Exposed wiring near finishing section', 'Zero Tolerance', 'Deferred maintenance', day(-1), 'Open'],
  ['WAGE-02', 'Overtime not always paid at correct rate', 'High', 'Payroll formula error', day(12), 'In Progress'],
  ['WATER-01', 'No monthly ETP water test records', 'Medium', 'No assigned owner', day(6), 'Open'],
  ['DOC-07', 'Machine maintenance log not maintained', 'Low', 'Awareness gap', day(30), 'Open'],
])

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, bv, 'BV Findings')
XLSX.utils.book_append_sheet(wb, rsc, 'RSC CAP')

const out = new URL('../sample-cap.xlsx', import.meta.url)
writeFileSync(out, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

// Prove what the real importer sees.
const sheets = {}
for (const name of wb.SheetNames) {
  sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false })
}
const { findings, perSheet } = workbookToFindings(sheets)
console.log(`Wrote sample-cap.xlsx`)
console.log(`Detected ${findings.length} findings:`)
for (const [name, r] of Object.entries(perSheet)) {
  console.log(`  ${name}: ${r.findings.length}`)
  for (const f of r.findings) console.log(`    - [${f.severity}] ${f.description} (due ${f.deadline})`)
}
