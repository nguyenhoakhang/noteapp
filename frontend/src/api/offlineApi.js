// src/api/offlineApi.js — API layer with offline cache fallback
// Uses the new offline/ module for IndexedDB caching and sync queue
import api from './axios'
import {
  cacheNotes,
  cacheNote,
  getAllCached,
  getCachedNote,
  saveDraft,
  removeCachedNote,
} from '../offline/noteCache.js'
import { enqueue as queueMutation } from '../offline/syncQueue.js'
import { putMany, getAll, STORES } from '../offline/db.js'

// ── Fetch notes (list) ──
export async function fetchNotes(params = {}) {
  try {
    const res = await api.get('/notes', { params })
    const notes = res.data?.data ?? res.data ?? []
    // Cache in background (fire-and-forget)
    cacheNotes(notes).catch(() => {})
    return notes
  } catch {
    // Offline fallback: return cached notes
    const local = await getAllCached()
    if (params.search) {
      const q = params.search.toLowerCase()
      return local.filter(n =>
        n.title?.toLowerCase().includes(q) ||
        n.content?.toLowerCase().includes(q)
      )
    }
    if (params.label_id) {
      return local.filter(n => n.labels?.some(l => l.id === params.label_id))
    }
    return local.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned - a.is_pinned
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }
}

// ── Fetch single note (show) ──
export async function fetchNote(id, params = {}) {
  try {
    const res = await api.get(`/notes/${id}`, { params })
    const note = res.data?.data ?? res.data
    await cacheNote(note)
    return note
  } catch {
    return getCachedNote(id)
  }
}

// ── Fetch labels ──
export async function fetchLabels() {
  try {
    const { data } = await api.get('/labels')
    await putMany(STORES.LABELS, data)
    return data
  } catch {
    return getAll(STORES.LABELS)
  }
}

// ── Create note ──
export async function createNote(data) {
  try {
    const res = await api.post('/notes', data)
    const note = res.data?.data ?? res.data
    await cacheNote(note)
    return note
  } catch {
    // Offline: create temp note locally
    const tempNote = {
      ...data,
      id: `temp_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      labels: [],
      attachments: [],
      shares: [],
    }
    await saveDraft(tempNote)
    await queueMutation({ method: 'POST', url: '/notes', data, tempId: tempNote.id })
    return tempNote
  }
}

// ── Update note ──
export async function updateNote(id, data) {
  if (String(id).startsWith('temp_')) {
    // Temp note: update locally, queue for creation
    await saveDraft({ id, ...data })
    await queueMutation({ method: 'POST', url: '/notes', data, tempId: id })
    return { id, ...data }
  }

  try {
    const res = await api.put(`/notes/${id}`, data)
    const note = res.data?.data ?? res.data
    await cacheNote(note)
    return note
  } catch {
    // Offline: save locally, queue for sync
    await saveDraft({ id, ...data })
    await queueMutation({ method: 'PUT', url: `/notes/${id}`, data })
    return { id, ...data }
  }
}

// ── Delete note ──
export async function deleteNote(id) {
  // Remove from cache immediately (optimistic)
  await removeCachedNote(id)

  if (String(id).startsWith('temp_')) return // temp notes don't exist on server

  try {
    await api.delete(`/notes/${id}`)
  } catch {
    // Queue for deletion when back online
    await queueMutation({ method: 'DELETE', url: `/notes/${id}` })
  }
}

// ── Pin/unpin note ──
export async function pinNote(id) {
  try {
    const { data } = await api.post(`/notes/${id}/pin`)
    await cacheNote(data)
    return data
  } catch {
    await queueMutation({ method: 'POST', url: `/notes/${id}/pin`, data: {} })
    return null
  }
}
