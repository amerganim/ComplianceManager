import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) return setProfile(null)
    const { data } = await supabase
      .from('profiles')
      .select('id, factory_id, full_name, role, email, phone, factories(name, alert_channel)')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data ?? null)
  }, [])

  useEffect(() => {
    // Without Supabase env there's no client; App shows the setup notice,
    // so just stop loading and don't touch the (null) client.
    if (!isConfigured) {
      setLoading(false)
      return
    }
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      loadProfile(s?.user?.id)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  // Sign in existing user.
  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  // Sign up a new factory: create the auth user, then atomically create
  // the factory + owner profile via the register_factory RPC.
  const signUp = useCallback(async (email, password, factoryName, fullName) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    // If email confirmation is off, we have a session immediately and can
    // create the factory now. If it's on, register_factory runs on first
    // sign-in instead (handled in ensureRegistered below).
    if (data.session) {
      const { error: rpcErr } = await supabase.rpc('register_factory', {
        factory_name: factoryName,
        full_name: fullName,
      })
      if (rpcErr) throw rpcErr
      await loadProfile(data.user.id)
    }
    return data
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = { session, profile, loading, signIn, signUp, signOut, reloadProfile: () => loadProfile(session?.user?.id) }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
