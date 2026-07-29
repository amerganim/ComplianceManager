import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../lib/i18n'

const CHANNELS = ['email', 'whatsapp', 'both']

export default function Settings() {
  const { profile, reloadProfile } = useAuth()
  const { t } = useLang()
  const [channel, setChannel] = useState(profile?.factories?.alert_channel || 'email')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setSaved(false); setError('')
    try {
      const [{ error: fErr }, { error: pErr }] = await Promise.all([
        supabase.from('factories').update({ alert_channel: channel }).eq('id', profile.factory_id),
        supabase.from('profiles').update({ phone: phone.trim() || null }).eq('id', profile.id),
      ])
      if (fErr || pErr) throw (fErr || pErr)
      await reloadProfile?.()
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const showWhatsappNote = channel !== 'email'

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-xl font-bold text-slate-900">{t('settings')}</h1>

      <form onSubmit={save} className="card space-y-5">
        <div>
          <label className="label">{t('alert_channel')}</label>
          <p className="mb-2 text-xs text-slate-400">{t('alert_channel_help')}</p>
          <div className="grid grid-cols-3 gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  channel === c
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t(`channel_${c}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">{t('my_phone')}</label>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="8801XXXXXXXXX"
            inputMode="tel"
          />
          <p className="mt-1 text-xs text-slate-400">{t('my_phone_help')}</p>
        </div>

        {showWhatsappNote && (
          <p className="rounded-lg bg-expiring/10 px-3 py-2 text-xs text-expiring">{t('whatsapp_note')}</p>
        )}
        {error && <p className="rounded-lg bg-expired/10 px-3 py-2 text-sm text-expired">{error}</p>}

        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={busy}>{busy ? '…' : t('save')}</button>
          {saved && <span className="text-sm text-valid">✓ {t('saved')}</span>}
        </div>
      </form>
    </div>
  )
}
