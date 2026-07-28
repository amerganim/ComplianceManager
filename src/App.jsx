import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { isConfigured } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
// CAP pages pull in the heavy xlsx library — load them only when visited.
const Caps = lazy(() => import('./pages/Caps'))
const CapDetail = lazy(() => import('./pages/CapDetail'))

function Spinner() {
  return (
    <div className="grid min-h-screen place-items-center text-slate-400">
      <div className="animate-pulse text-sm">Loading…</div>
    </div>
  )
}

function ConfigNotice() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card max-w-md">
        <h1 className="text-lg font-bold text-slate-800">Setup needed</h1>
        <p className="mt-2 text-sm text-slate-600">
          Supabase isn't configured yet. Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to{' '}
          <code className="rounded bg-slate-100 px-1">.env</code>, fill in your{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code>, then restart the dev server.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Also run <code className="rounded bg-slate-100 px-1">supabase/01_schema.sql</code> and{' '}
          <code className="rounded bg-slate-100 px-1">supabase/02_rls.sql</code> in the Supabase SQL editor.
        </p>
      </div>
    </div>
  )
}

function Protected({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  const { session, loading } = useAuth()
  if (!isConfigured) return <ConfigNotice />
  if (loading) return <Spinner />

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/items" element={<Protected><Items /></Protected>} />
      <Route path="/caps" element={<Protected><Suspense fallback={<Spinner />}><Caps /></Suspense></Protected>} />
      <Route path="/caps/:id" element={<Protected><Suspense fallback={<Spinner />}><CapDetail /></Suspense></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
