import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCaps } from '../lib/useCap'
import { useLang } from '../lib/i18n'
import ImportCap from '../components/ImportCap'

function ProgressBar({ closed, total }) {
  const pct = total ? Math.round((closed / total) * 100) : 0
  return (
    <div className="w-40">
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>{closed}/{total} closed</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-valid" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Caps() {
  const { caps, loading, error, importCap, deleteCap } = useCaps()
  const { t } = useLang()
  const navigate = useNavigate()
  const [importing, setImporting] = useState(false)

  const handleImport = async (meta, findings) => {
    const id = await importCap(meta, findings)
    setImporting(false)
    navigate(`/caps/${id}`)
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm(t('cap_confirm_del'))) return
    await deleteCap(id)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">{t('caps')}</h1>
        <button className="btn-primary" onClick={() => setImporting(true)}>↑ {t('cap_import')}</button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-expired/10 px-3 py-2 text-sm text-expired">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : caps.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">{t('cap_none')}</div>
      ) : (
        <div className="space-y-3">
          {caps.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/caps/${c.id}`)}
              className="card flex cursor-pointer items-center justify-between hover:ring-slate-300"
            >
              <div>
                <div className="font-semibold text-slate-800">{c.title}</div>
                <div className="text-xs text-slate-400">
                  {[c.auditor, c.audit_date].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {c.open > 0 && (
                  <span className="rounded-full bg-expiring/10 px-2.5 py-1 text-xs font-medium text-expiring">
                    {c.open} {t('cap_open').toLowerCase()}
                  </span>
                )}
                <ProgressBar closed={c.closed} total={c.total} />
                <button
                  onClick={(e) => handleDelete(e, c.id)}
                  className="btn-ghost !py-1 !px-2 text-xs text-expired"
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {importing && <ImportCap onImport={handleImport} onClose={() => setImporting(false)} />}
    </div>
  )
}
