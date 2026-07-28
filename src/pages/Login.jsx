import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../lib/i18n'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const { t, lang, toggle } = useLang()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', factoryName: '', fullName: '' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(form.email.trim(), form.password)
      } else {
        const { session } = await signUp(
          form.email.trim(),
          form.password,
          form.factoryName.trim(),
          form.fullName.trim()
        )
        if (!session) {
          setInfo('Check your email to confirm your account, then sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl">🛡️</div>
          <h1 className="mt-2 text-xl font-bold text-slate-900">{t('app_name')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('tagline')}</p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="label">{t('factory_name')}</label>
                <input className="input" value={form.factoryName} onChange={set('factoryName')} required />
              </div>
              <div>
                <label className="label">{t('your_name')}</label>
                <input className="input" value={form.fullName} onChange={set('fullName')} required />
              </div>
            </>
          )}
          <div>
            <label className="label">{t('email')}</label>
            <input type="email" autoComplete="email" className="input" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="label">{t('password')}</label>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="input"
              value={form.password}
              onChange={set('password')}
              minLength={6}
              required
            />
          </div>

          {error && <p className="rounded-lg bg-expired/10 px-3 py-2 text-sm text-expired">{error}</p>}
          {info && <p className="rounded-lg bg-valid/10 px-3 py-2 text-sm text-valid">{info}</p>}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? '…' : mode === 'signin' ? t('sign_in') : t('sign_up')}
          </button>

          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
          >
            {mode === 'signin' ? t('need_account') : t('have_account')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={toggle} className="text-xs text-slate-400 hover:text-slate-600">
            {lang === 'en' ? 'বাংলায় দেখুন' : 'View in English'}
          </button>
        </div>
      </div>
    </div>
  )
}
