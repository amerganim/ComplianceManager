import { useState } from 'react'
import { useItemDocuments, signedUrl } from '../lib/useDocuments'
import { formatSize } from '../lib/documents'
import { useLang } from '../lib/i18n'

// Version history + upload for one compliance item's documents.
export default function DocumentsModal({ item, onClose, onChanged }) {
  const { docs, loading, error, upload, setCurrent, remove } = useItemDocuments(item.id)
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  const wrap = (fn) => async (...args) => {
    setBusy(true); setLocalError('')
    try { await fn(...args); onChanged?.() }
    catch (e) { setLocalError(e.message || 'Failed') }
    finally { setBusy(false) }
  }

  const onFile = wrap(async (e) => {
    const file = e.target.files?.[0]
    if (file) await upload(file)
    e.target.value = ''
  })

  const view = async (doc) => {
    try { window.open(await signedUrl(doc.storage_path), '_blank', 'noopener') }
    catch (e) { setLocalError(e.message) }
  }

  const del = wrap(async (doc) => {
    if (!window.confirm(t('doc_confirm_del'))) return
    await remove(doc)
  })

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{t('docs')}</h2>
          <p className="text-sm text-slate-500">{item.name}</p>
        </div>

        <label className={`btn-primary w-full cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy ? '…' : `↑ ${t('doc_upload')}`}
          <input type="file" className="hidden" onChange={onFile} disabled={busy} />
        </label>

        {(error || localError) && (
          <p className="rounded-lg bg-expired/10 px-3 py-2 text-sm text-expired">{error || localError}</p>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">{t('doc_none')}</p>
        ) : (
          <ul className="max-h-72 divide-y divide-slate-100 overflow-auto">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{d.file_name}</span>
                    {d.is_current && (
                      <span className="rounded-full bg-valid/10 px-2 py-0.5 text-[11px] font-semibold text-valid">{t('doc_current')}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t('doc_version')} {d.version} · {formatSize(d.size_bytes)} · {String(d.uploaded_at).slice(0, 10)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => view(d)}>{t('doc_view')}</button>
                  {!d.is_current && (
                    <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => setCurrent(d).then(onChanged)}>{t('doc_make_current')}</button>
                  )}
                  <button className="btn-ghost !py-1 !px-2 text-xs text-expired" onClick={() => del(d)}>{t('delete')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-ghost">{t('cancel')}</button>
        </div>
      </div>
    </div>
  )
}
