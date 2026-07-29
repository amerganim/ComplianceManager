import { useState } from 'react'
import { useItems } from '../lib/useItems'
import { useCurrentDocs } from '../lib/useDocuments'
import { useLang } from '../lib/i18n'
import StatusBadge from '../components/StatusBadge'
import ItemForm from '../components/ItemForm'
import DocumentsModal from '../components/DocumentsModal'

export default function Items() {
  const { items, loading, error, saveItem, deleteItem, markDone } = useItems()
  const { byItem: docsByItem, refresh: refreshDocs } = useCurrentDocs()
  const { t } = useLang()
  const [editing, setEditing] = useState(null) // item | 'new' | null
  const [docItem, setDocItem] = useState(null)

  const handleDelete = async (item) => {
    if (!window.confirm(t('confirm_delete'))) return
    await deleteItem(item.id)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">{t('items')}</h1>
        <button className="btn-primary" onClick={() => setEditing('new')}>+ {t('add_item')}</button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-expired/10 px-3 py-2 text-sm text-expired">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">{t('no_items')}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">{t('name')}</th>
                <th className="hidden px-4 py-3 sm:table-cell">{t('category')}</th>
                <th className="hidden px-4 py-3 md:table-cell">{t('expiry_date')}</th>
                <th className="px-4 py-3">{t('expiring')}</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800">
                      {item.name}
                      {docsByItem[item.id] && (
                        <span className="text-valid" title={t('doc_current')}>📎</span>
                      )}
                    </div>
                    {item.issuing_authority && (
                      <div className="text-xs text-slate-400">{item.issuing_authority}</div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{t(item.category)}</td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{item.expiry_date ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge item={item} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {item.category === 'recurring_task' && (
                        <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => markDone(item)}>
                          ✓ {t('mark_done')}
                        </button>
                      )}
                      <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => setDocItem(item)}>
                        📎 {t('doc')}
                      </button>
                      <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => setEditing(item)}>
                        {t('edit')}
                      </button>
                      <button className="btn-ghost !py-1 !px-2 text-xs text-expired" onClick={() => handleDelete(item)}>
                        {t('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ItemForm
          item={editing === 'new' ? null : editing}
          onSave={saveItem}
          onClose={() => setEditing(null)}
        />
      )}

      {docItem && (
        <DocumentsModal
          item={docItem}
          onChanged={refreshDocs}
          onClose={() => setDocItem(null)}
        />
      )}
    </div>
  )
}
