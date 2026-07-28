import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

// Only build a real client when configured. createClient() throws on an
// empty URL, which would break the whole app at import time and hide the
// friendly "Setup needed" screen — so when unconfigured we log and export
// null instead. App gates on isConfigured before anything touches this.
if (!isConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = isConfigured ? createClient(url, anonKey) : null
