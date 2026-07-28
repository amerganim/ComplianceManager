import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useLang } from '../lib/i18n'
import { workbookToFindings } from '../lib/cap'

// Modal: pick an auditor's .xlsx, auto-detect findings across all tabs,
// preview the counts, then import. Parsing is all client-side.
export default function ImportCap({ onImport, onClose }) {
  const { t } = useLang()
  const [meta, setMeta] = useState({ title: '', auditor: '', audit_date: '' })
  const [parsed, setParsed] = useState(null) // { findings, perSheet }
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setMeta((m) => ({ ...m, [k]: e.target.value }))

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const sheets = {}
      for (const name of wb.SheetNames) {
        sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
          header: 1, raw: true, defval: null, blankrows: false,
        })
      }
      const res = workbookToFindings(sheets)
      setParsed(res)
      // Default the title from the filename if empty.
      setMeta((m) => ({ ...m, title: m.title || file.name.replace(/\.[^.]+$/, '') }))
    } catch (err) {
      setError(err.message || 'Could not read that file')
      setParsed(null)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!parsed?.findings?.length) { setError(t('cap_no_rows')); return }
    setBusy(true)
    setError('')
    try {
      await onImport(meta, parsed.findings)
    } catch (err) {
      setError(err.message || 'Import failed')
      setBusy(false)
    }
  }

  const total = parsed?.findings?.length ?? 0
  const perSheet = parsed?.perSheet ?? {}

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-slate-900">{t('cap_import')}</h2>

        <div>
          <label className="label">{t('cap_choose_file')}</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
          />
          {fileName && <p className="mt-1 text-xs text-slate-400">{fileName}</p>}
        </div>

        {parsed && (
          <div className={`rounded-lg px-3 py-2 text-sm ${total ? 'bg-valid/10 text-valid' : 'bg-expired/10 text-expired'}`}>
            {total > 0 ? (
              <>
                <span className="font-semibold">{total}</span> {t('cap_detected')}
                <ul className="mt-1 text-xs text-slate-500">
                  {Object.entries(perSheet).map(([name, r]) => (
                    <li key={name}>· {name}: {r.findings.length}</li>
                  ))}
                </ul>
              </>
            ) : t('cap_no_rows')}
          </div>
        )}

        <div>
          <label className="label">{t('cap_title')}</label>
          <input className="input" value={meta.title} onChange={set('title')} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('cap_auditor')}</label>
            <input className="input" value={meta.auditor} onChange={set('auditor')} placeholder="BV / RSC / Intertek" />
          </div>
          <div>
            <label className="label">{t('cap_audit_date')}</label>
            <input type="date" className="input" value={meta.audit_date} onChange={set('audit_date')} />
          </div>
        </div>

        {error && <p className="rounded-lg bg-expired/10 px-3 py-2 text-sm text-expired">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">{t('cancel')}</button>
          <button className="btn-primary" disabled={busy || !total}>
            {busy ? '…' : t('cap_import_now')}
          </button>
        </div>
      </form>
    </div>
  )
}
