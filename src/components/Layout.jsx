import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../lib/i18n'

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const { t, lang, toggle } = useLang()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const link = ({ isActive }) =>
    `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4">
          {/* Top row: brand + account controls */}
          <div className="flex items-center gap-2 py-3">
            <span className="text-lg font-bold tracking-tight">🛡️ {t('app_name')}</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={toggle} className="btn-ghost !px-2.5 !py-1.5 text-xs" title="Toggle language">
                {lang === 'en' ? 'বাংলা' : 'EN'}
              </button>
              <div className="hidden text-right sm:block">
                <div className="text-xs font-semibold text-slate-700">{profile?.factories?.name ?? '—'}</div>
                <div className="text-[11px] text-slate-400">{profile?.full_name ?? profile?.email}</div>
              </div>
              <button onClick={handleSignOut} className="btn-ghost !py-1.5 text-xs">{t('sign_out')}</button>
            </div>
          </div>
          {/* Nav row: horizontally scrollable on small screens */}
          <nav className="-mb-px flex gap-1 overflow-x-auto pb-2">
            <NavLink to="/" end className={link}>{t('dashboard')}</NavLink>
            <NavLink to="/items" className={link}>{t('items')}</NavLink>
            <NavLink to="/caps" className={link}>{t('caps')}</NavLink>
            <NavLink to="/binder" className={link}>{t('binder')}</NavLink>
            <NavLink to="/settings" className={link}>{t('settings')}</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
