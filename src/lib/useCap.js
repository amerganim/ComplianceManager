import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

async function myFactoryId() {
  const { data: user } = await supabase.auth.getUser()
  const { data: prof } = await supabase
    .from('profiles').select('factory_id').eq('id', user.user.id).single()
  return prof.factory_id
}

// List of CAPs with a live open/closed rollup for the index page.
export function useCaps() {
  const [caps, setCaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    // Pull caps + just the status column of their findings for counts.
    const { data, error } = await supabase
      .from('caps')
      .select('id, auditor, title, audit_date, created_at, cap_findings(status)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setCaps(
      (data ?? []).map((c) => {
        const f = c.cap_findings ?? []
        return {
          ...c,
          total: f.length,
          closed: f.filter((x) => x.status === 'closed').length,
          open: f.filter((x) => x.status !== 'closed').length,
        }
      })
    )
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Create the CAP + bulk-insert its findings in one flow.
  const importCap = useCallback(async (meta, findings) => {
    const factory_id = await myFactoryId()
    const { data: user } = await supabase.auth.getUser()
    const { data: cap, error: capErr } = await supabase
      .from('caps')
      .insert({
        factory_id,
        auditor: meta.auditor || null,
        title: meta.title,
        audit_date: meta.audit_date || null,
        created_by: user.user.id,
      })
      .select('id')
      .single()
    if (capErr) throw capErr

    const rows = findings.map((f) => ({
      cap_id: cap.id,
      factory_id,
      sheet_name: f.sheet_name,
      ref: f.ref,
      category: f.category,
      severity: f.severity,
      description: f.description,
      corrective_action: f.corrective_action,
      root_cause: f.root_cause,
      deadline: f.deadline,
      status: f.status || 'open',
      raw: f.raw,
    }))
    // Insert in chunks so a large CAP doesn't hit payload limits.
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from('cap_findings').insert(rows.slice(i, i + 200))
      if (error) throw error
    }
    await refresh()
    return cap.id
  }, [refresh])

  const deleteCap = useCallback(async (id) => {
    const { error } = await supabase.from('caps').delete().eq('id', id)
    if (error) throw error
    await refresh()
  }, [refresh])

  return { caps, loading, error, refresh, importCap, deleteCap }
}

// One CAP with its findings, for the detail page.
export function useCapDetail(capId) {
  const [cap, setCap] = useState(null)
  const [findings, setFindings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!capId) return
    setLoading(true)
    const [{ data: capRow, error: e1 }, { data: fRows, error: e2 }] = await Promise.all([
      supabase.from('caps').select('*').eq('id', capId).maybeSingle(),
      supabase.from('cap_findings').select('*').eq('cap_id', capId)
        .order('severity', { ascending: true }).order('deadline', { ascending: true, nullsFirst: false }),
    ])
    if (e1 || e2) setError((e1 || e2).message)
    setCap(capRow ?? null)
    setFindings(fRows ?? [])
    setLoading(false)
  }, [capId])

  useEffect(() => { refresh() }, [refresh])

  const updateFinding = useCallback(async (id, patch) => {
    const next = { ...patch }
    // Stamp/clear closed_at when status crosses the closed line.
    if (patch.status === 'closed') next.closed_at = new Date().toISOString()
    if (patch.status && patch.status !== 'closed') next.closed_at = null
    const { error } = await supabase.from('cap_findings').update(next).eq('id', id)
    if (error) throw error
    // Optimistic local update so the table feels instant.
    setFindings((list) => list.map((f) => (f.id === id ? { ...f, ...next } : f)))
  }, [])

  return { cap, findings, loading, error, refresh, updateFinding }
}
