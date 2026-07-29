import { useMemo, useState } from 'react'
import { zipSync } from 'fflate'
import { useItems } from '../lib/useItems'
import { useCurrentDocs, downloadBytes } from '../lib/useDocuments'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../lib/i18n'
import { assembleBinder, sanitizeFilename } from '../lib/documents'
import { STATUS_META, itemStatus } from '../lib/status'

export default function AuditBinder() {
  const { items, loading: li } = useItems()
  const { byItem, loading: ld, refresh } = useCurrentDocs()
  const { profile } = useAuth()
  const { t } = useLang()
  const [zipping, setZipping] = useState(false)
  const [zipError, setZipError] = useState('')

  const binder = useMemo(() => assembleBinder(items, byItem), [items, byItem])
  const today = new Date().toISOString().slice(0, 10)
  const factory = profile?.factories?.name ?? 'Factory'

  const downloadZip = async () => {
    setZipping(true); setZipError('')
    try {
      const files = {}
      const manifest = [`Audit document pack — ${factory}`, `Prepared ${today}`, '']
      for (const row of binder.rows) {
        if (!row.doc) { manifest.push(`MISSING: ${row.item.name}`); continue }
        const bytes = await downloadBytes(row.doc.storage_path)
        // Prefix with a sortable index + item name so the pack is ordered.
        const ext = row.doc.file_name.includes('.') ? row.doc.file_name.split('.').pop() : 'bin'
        const key = `${sanitizeFilename(row.item.name)}.${ext}`
        files[key] = bytes
        manifest.push(`${row.item.name} (expires ${row.item.expiry_date ?? '—'}) -> ${key}`)
      }
      files['INDEX.txt'] = new TextEncoder().encode(manifest.join('\n'))
      const zipped = zipSync(files)
      const blob = new Blob([zipped], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitizeFilename(factory)}_audit_pack_${today}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setZipError(e.message || 'Could not build the pack')
    } finally {
      setZipping(false)
    }
  }

  if (li || ld) return <p className="text-sm text-slate-400">Loading…</p>

  return (
    <div className="space-y-5">
      {/* Actions (hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('binder')}</h1>
          <p className="text-sm text-slate-500">{t('binder_sub')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={downloadZip} disabled={zipping}>
            {zipping ? '…' : t('binder_zip')}
          </button>
          <button className="btn-primary" onClick={() => window.print()}>🖨 {t('binder_print')}</button>
        </div>
      </div>
      {zipError && <p className="no-print rounded-lg bg-expired/10 px-3 py-2 text-sm text-expired">{zipError}</p>}

      {/* The printable sheet */}
      <div className="binder-sheet card mx-auto max-w-3xl">
        {/* Cover header */}
        <div className="border-b border-slate-200 pb-4">
          <div className="text-2xl font-bold text-slate-900">{factory}</div>
          <div className="mt-1 text-sm text-slate-500">{t('binder')} · {t('prepared_on')} {today}</div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><b className="text-slate-800">{binder.total}</b> {t('items').toLowerCase()}</span>
            <span className="text-valid"><b>{binder.withDoc}</b> {t('binder_have')}</span>
            {binder.missing.length > 0 && (
              <span className="text-expired"><b>{binder.missing.length}</b> {t('binder_missing').toLowerCase()}</span>
            )}
          </div>
          {binder.complete && (
            <div className="mt-3 rounded-lg bg-valid/10 px-3 py-2 text-sm text-valid">✓ {t('binder_complete')}</div>
          )}
        </div>

        {/* Index of documents */}
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold text-slate-700">{t('binder_index')}</div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-2 w-8">#</th>
                <th className="py-2">{t('name')}</th>
                <th className="hidden py-2 sm:table-cell">{t('authority')}</th>
                <th className="py-2">{t('expiry_date')}</th>
                <th className="py-2">{t('doc')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {binder.rows.map((row, i) => {
                const meta = STATUS_META[itemStatus(row.item)]
                return (
                  <tr key={row.item.id}>
                    <td className="py-2 text-slate-400">{i + 1}</td>
                    <td className="py-2">
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${meta.dot}`} />
                      <span className="font-medium text-slate-800">{row.item.name}</span>
                    </td>
                    <td className="hidden py-2 text-slate-500 sm:table-cell">{row.item.issuing_authority ?? '—'}</td>
                    <td className="py-2 text-slate-500">{row.item.expiry_date ?? '—'}</td>
                    <td className="py-2">
                      {row.doc ? (
                        <span className="text-valid">✓ v{row.doc.version}</span>
                      ) : (
                        <span className="font-medium text-expired">{t('binder_missing')}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {binder.rows.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">{t('no_items')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
