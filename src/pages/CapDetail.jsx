import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useCapDetail } from '../lib/useCap'
import { useLang } from '../lib/i18n'
import { capSummary, findingsToExportSheets, SEVERITY_META } from '../lib/cap'

const STATUS_ORDER = ['open', 'in_progress', 'closed']

function SeverityPill({ severity }) {
  const m = SEVERITY_META[severity]
  if (!m) return <span className="text-xs text-slate-300">—</span>
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m.bg} ${m.text} ${m.ring}`}>
      {m.label}
    </span>
  )
}

function deadlineTone(deadline, status) {
  if (status === 'closed' || !deadline) return 'text-slate-500'
  const days = Math.round((new Date(deadline) - new Date()) / 86400000)
  if (days < 0) return 'text-expired font-semibold'
  if (days <= 7) return 'text-expiring font-semibold'
  return 'text-slate-500'
}

export default function CapDetail() {
  const { id } = useParams()
  const { cap, findings, loading, updateFinding } = useCapDetail(id)
  const { t } = useLang()
  const [sevFilter, setSevFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const summary = useMemo(() => capSummary(findings), [findings])

  const visible = useMemo(
    () =>
      findings.filter(
        (f) =>
          (sevFilter === 'all' || f.severity === sevFilter) &&
          (statusFilter === 'all' || f.status === statusFilter)
      ),
    [findings, sevFilter, statusFilter]
  )

  const exportReport = () => {
    const sheets = findingsToExportSheets(findings)
    const wb = XLSX.utils.book_new()
    for (const [name, aoa] of Object.entries(sheets)) {
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)) // Excel tab-name limit
    }
    const safe = (cap?.title || 'CAP').replace(/[^\w\-]+/g, '_')
    XLSX.writeFile(wb, `${safe}_status_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!cap) return <p className="text-sm text-slate-400">Not found.</p>

  const pct = summary.total ? Math.round((summary.closed / summary.total) * 100) : 0

  return (
    <div className="space-y-5">
      <div>
        <Link to="/caps" className="text-xs text-slate-400 hover:text-slate-600">← {t('caps')}</Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{cap.title}</h1>
            <div className="text-xs text-slate-400">{[cap.auditor, cap.audit_date].filter(Boolean).join(' · ')}</div>
          </div>
          <button className="btn-ghost" onClick={exportReport}>↓ {t('cap_export')}</button>
        </div>
      </div>

      {/* Live open / closed rollup */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card"><div className="text-2xl font-bold text-expiring">{summary.open}</div><div className="text-xs text-slate-500">{t('cap_open')}</div></div>
        <div className="card"><div className="text-2xl font-bold text-slate-700">{summary.in_progress}</div><div className="text-xs text-slate-500">{t('cap_in_progress')}</div></div>
        <div className="card"><div className="text-2xl font-bold text-valid">{summary.closed}</div><div className="text-xs text-slate-500">{t('cap_closed')} · {pct}%</div></div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-sm">
        <select className="input !w-auto" value={sevFilter} onChange={(e) => setSevFilter(e.target.value)}>
          <option value="all">{t('cap_all')} · {t('cap_severity')}</option>
          {Object.entries(SEVERITY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <select className="input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{t('cap_all')} · {t('cap_status')}</option>
          <option value="open">{t('cap_open')}</option>
          <option value="in_progress">{t('cap_in_progress')}</option>
          <option value="closed">{t('cap_closed')}</option>
        </select>
        <span className="ml-auto self-center text-xs text-slate-400">{visible.length}/{summary.total}</span>
      </div>

      {/* Findings */}
      <div className="space-y-2">
        {visible.map((f) => (
          <div key={f.id} className="card !p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <SeverityPill severity={f.severity} />
                  {f.category && <span className="text-xs text-slate-400">{f.category}</span>}
                  {f.ref && <span className="text-xs text-slate-300">#{f.ref}</span>}
                </div>
                <p className="mt-1.5 text-sm text-slate-800">{f.description || '—'}</p>
                {f.corrective_action && (
                  <p className="mt-1 text-xs text-slate-500"><span className="font-medium">{t('cap_action')}:</span> {f.corrective_action}</p>
                )}
                {f.deadline && (
                  <p className={`mt-1 text-xs ${deadlineTone(f.deadline, f.status)}`}>{t('cap_deadline')}: {f.deadline}</p>
                )}
              </div>
              <select
                className="input !w-auto shrink-0 text-xs"
                value={f.status}
                onChange={(e) => updateFinding(f.id, { status: e.target.value })}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{t(`cap_${s}`)}</option>
                ))}
              </select>
            </div>
            <input
              className="input mt-3 text-xs"
              placeholder={t('cap_evidence')}
              defaultValue={f.proof_url || f.proof_note || ''}
              onBlur={(e) => {
                const v = e.target.value.trim()
                const isUrl = /^https?:\/\//i.test(v)
                updateFinding(f.id, { proof_url: isUrl ? v : null, proof_note: isUrl ? null : (v || null) })
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
