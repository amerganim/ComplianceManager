import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { buildStoragePath, nextVersion } from './documents'

const BUCKET = 'documents'

async function myFactoryId() {
  const { data: user } = await supabase.auth.getUser()
  const { data: prof } = await supabase
    .from('profiles').select('factory_id').eq('id', user.user.id).single()
  return { factoryId: prof.factory_id, userId: user.user.id }
}

// All CURRENT documents for the factory, keyed by item_id — powers the
// per-row doc indicator on Items and the audit binder.
export function useCurrentDocs() {
  const [byItem, setByItem] = useState({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('documents').select('*').eq('is_current', true)
    const map = {}
    for (const d of data ?? []) if (d.item_id) map[d.item_id] = d
    setByItem(map)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  return { byItem, loading, refresh }
}

// Version history + upload/set-current/delete for a single item.
export function useItemDocuments(itemId) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!itemId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('documents').select('*').eq('item_id', itemId)
      .order('version', { ascending: false })
    if (error) setError(error.message)
    setDocs(data ?? [])
    setLoading(false)
  }, [itemId])

  useEffect(() => { refresh() }, [refresh])

  const upload = useCallback(async (file) => {
    const { factoryId, userId } = await myFactoryId()
    const version = nextVersion(docs)
    const path = buildStoragePath(factoryId, itemId, version, file.name)

    const { error: upErr } = await supabase.storage
      .from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
    if (upErr) throw upErr

    // New upload becomes current: demote the previous current first so the
    // one-current-per-item unique index never collides.
    await supabase.from('documents')
      .update({ is_current: false }).eq('item_id', itemId).eq('is_current', true)

    const { error: insErr } = await supabase.from('documents').insert({
      factory_id: factoryId,
      item_id: itemId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size ?? null,
      version,
      is_current: true,
      uploaded_by: userId,
    })
    if (insErr) throw insErr
    await refresh()
  }, [docs, itemId, refresh])

  const setCurrent = useCallback(async (doc) => {
    await supabase.from('documents')
      .update({ is_current: false }).eq('item_id', itemId).eq('is_current', true)
    await supabase.from('documents').update({ is_current: true }).eq('id', doc.id)
    await refresh()
  }, [itemId, refresh])

  const remove = useCallback(async (doc) => {
    await supabase.storage.from(BUCKET).remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    await refresh()
  }, [refresh])

  return { docs, loading, error, refresh, upload, setCurrent, remove }
}

// Short-lived signed URL for viewing/downloading a private object.
export async function signedUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

// Fetch raw bytes for a document (used by the binder ZIP builder).
export async function downloadBytes(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  return new Uint8Array(await data.arrayBuffer())
}
