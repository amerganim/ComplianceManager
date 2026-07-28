import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Central data access for compliance_items. RLS scopes every query to
// the caller's factory automatically — no factory_id filter needed here.
export function useItems() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('compliance_items')
      .select('*')
      .order('expiry_date', { ascending: true, nullsFirst: false })
    if (error) setError(error.message)
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveItem = useCallback(async (values, id) => {
    const payload = { ...values }
    if (id) {
      const { error } = await supabase.from('compliance_items').update(payload).eq('id', id)
      if (error) throw error
    } else {
      // factory_id is required by the schema + RLS check; stamp it from
      // the caller's profile so the app never has to pass it around.
      const { data: prof } = await supabase
        .from('profiles')
        .select('factory_id')
        .eq('id', (await supabase.auth.getUser()).data.user.id)
        .single()
      const { error } = await supabase
        .from('compliance_items')
        .insert({ ...payload, factory_id: prof.factory_id })
      if (error) throw error
    }
    await refresh()
  }, [refresh])

  const deleteItem = useCallback(async (id) => {
    const { error } = await supabase.from('compliance_items').delete().eq('id', id)
    if (error) throw error
    await refresh()
  }, [refresh])

  // Phase 5: stamp completion + roll next-due forward by recurrence_days.
  const markDone = useCallback(async (item) => {
    const { data: user } = await supabase.auth.getUser()
    await supabase.from('task_completions').insert({
      item_id: item.id,
      completed_by: user.user.id,
      note: null,
    })
    if (item.recurrence_days) {
      const base = new Date()
      base.setDate(base.getDate() + item.recurrence_days)
      const next = base.toISOString().slice(0, 10)
      // Clear this item's alert_log rows so the next cycle can alert afresh.
      await supabase.from('alert_log').delete().eq('item_id', item.id)
      await supabase.from('compliance_items').update({ expiry_date: next }).eq('id', item.id)
    }
    await refresh()
  }, [refresh])

  return { items, loading, error, refresh, saveItem, deleteItem, markDone }
}
