import { itemStatus, STATUS_META, daysLeft } from '../lib/status'
import { useLang } from '../lib/i18n'

// Small coloured pill + day count. Pure presentation over the shared
// computed status, so it can never disagree with the dashboard.
export default function StatusBadge({ item }) {
  const { t } = useLang()
  const status = itemStatus(item)
  const meta = STATUS_META[status]
  const d = daysLeft(item.expiry_date)

  let label = ''
  if (d !== null) {
    label = d < 0 ? `${Math.abs(d)} ${t('days_overdue')}` : `${d} ${t('days_left')}`
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.bg} ${meta.text} ${meta.ring}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      {label || '—'}
    </span>
  )
}
