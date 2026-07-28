import { useState } from 'react'
import { useLang, CATEGORIES } from '../lib/i18n'

// Modal add/edit form. `item` present = edit, absent = add.
export default function ItemForm({ item, onSave, onClose }) {
  const { t } = useLang()
  const [form, setForm] = useState({
    name: item?.name ?? '',
    category: item?.category ?? 'license',
    issuing_authority: item?.issuing_authority ?? '',
    issue_date: item?.issue_date ?? '',
    expiry_date: item?.expiry_date ?? '',
    recurrence_days: item?.recurrence_days ?? '',
    notes: item?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isRecurring = form.category === 'recurring_task'

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave(
        {
          name: form.name.trim(),
          category: form.category,
          issuing_authority: form.issuing_authority.trim() || null,
          issue_date: form.issue_date || null,
          expiry_date: form.expiry_date || null,
          recurrence_days: isRecurring && form.recurrence_days ? Number(form.recurrence_days) : null,
          notes: form.notes.trim() || null,
        },
        item?.id
      )
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-slate-900">
          {item ? t('edit') : t('add_item')}
        </h2>

        <div>
          <label className="label">{t('name')}</label>
          <input className="input" value={form.name} onChange={set('name')} required autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('category')}</label>
            <select className="input" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('authority')}</label>
            <input className="input" value={form.issuing_authority} onChange={set('issuing_authority')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('issue_date')}</label>
            <input type="date" className="input" value={form.issue_date} onChange={set('issue_date')} />
          </div>
          <div>
            <label className="label">{t('expiry_date')}</label>
            <input type="date" className="input" value={form.expiry_date} onChange={set('expiry_date')} required />
          </div>
        </div>

        {isRecurring && (
          <div>
            <label className="label">{t('recurrence')}</label>
            <input
              type="number"
              min="1"
              className="input"
              value={form.recurrence_days}
              onChange={set('recurrence_days')}
              placeholder="90"
            />
          </div>
        )}

        <div>
          <label className="label">{t('notes')}</label>
          <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} />
        </div>

        {error && <p className="rounded-lg bg-expired/10 px-3 py-2 text-sm text-expired">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">{t('cancel')}</button>
          <button className="btn-primary" disabled={busy}>{busy ? '…' : t('save')}</button>
        </div>
      </form>
    </div>
  )
}
