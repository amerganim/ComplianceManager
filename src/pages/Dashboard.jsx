import { Link } from 'react-router-dom'
import { useItems } from '../lib/useItems'
import { useLang } from '../lib/i18n'
import { summarize, readinessScore, itemStatus, STATUS, daysLeft } from '../lib/status'
import StatusBadge from '../components/StatusBadge'

function Counter({ emoji, value, label, tone }) {
  return (
    <div className={`card flex items-center gap-4 ${tone}`}>
      <div className="text-3xl">{emoji}</div>
      <div>
        <div className="text-3xl font-bold leading-none text-slate-900">{value}</div>
        <div className="mt-1 text-sm text-slate-500">{label}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { items, loading } = useItems()
  const { t } = useLang()

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  const s = summarize(items)
  const score = readinessScore(items)

  // "What's expiring next": non-green items, soonest first.
  const upcoming = items
    .filter((it) => itemStatus(it) !== STATUS.VALID)
    .sort((a, b) => (daysLeft(a.expiry_date) ?? 1e9) - (daysLeft(b.expiry_date) ?? 1e9))
    .slice(0, 6)

  const scoreTone =
    score >= 80 ? 'text-valid' : score >= 50 ? 'text-expiring' : 'text-expired'

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">{t('dashboard')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Counter emoji="🟢" value={s.valid}    label={t('valid')}    />
        <Counter emoji="🟡" value={s.expiring} label={t('expiring')} />
        <Counter emoji="🔴" value={s.expired}  label={t('expired')}  />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card md:col-span-1">
          <div className="text-sm text-slate-500">{t('readiness')}</div>
          <div className={`mt-2 text-5xl font-bold ${scoreTone}`}>{score}%</div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${score >= 80 ? 'bg-valid' : score >= 50 ? 'bg-expiring' : 'bg-expired'}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        <div className="card md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">{t('expiring_next')}</div>
            <Link to="/items" className="text-xs text-slate-400 hover:text-slate-600">{t('items')} →</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('nothing_soon')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((it) => (
                <li key={it.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{it.name}</div>
                    <div className="text-xs text-slate-400">{t(it.category)} · {it.expiry_date}</div>
                  </div>
                  <StatusBadge item={it} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
