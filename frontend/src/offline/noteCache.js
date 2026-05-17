// src/offline/noteCache.js — Note-specific caching layer
// Handles merge logic, sync status tracking, and stale-while-revalidate
import { STORES, getAll, get, put, del, clear } from './db.js'

// ── Sync status constants ──
export const SYNC = {
  SYNCED:  'synced',
  DRAFT:   'draft',
  FAILED:  'failed',
  SYNCING: 'syncing',
}

// ── Cache notes from API (list endpoint) ──
// Preserves full content if already cached (mergeNotes logic)
export async function cacheNotes(notes) {
  for (const incoming of notes) {
    const existing = await get(STORES.NOTES, incoming.id)
    if (existing && existing.content && existing.content.length > 500) {
      // Merge: preserve full content, update metadata
      const merged = { ...existing }
      if (incoming.title !== undefined) merged.title = incoming.title
      if (incoming.color !== undefined) merged.color = incoming.color
      if (incoming.is_pinned !== undefined) merged.is_pinned = incoming.is_pinned
      if (incoming.pinned_at !== undefined) merged.pinned_at = incoming.pinned_at
      if (incoming.is_protected !== undefined) merged.is_protected = incoming.is_protected
      if (incoming.is_shared !== undefined) merged.is_shared = incoming.is_shared
      if (incoming.updated_at !== undefined) merged.updated_at = incoming.updated_at
      if (incoming.labels !== undefined) merged.labels = incoming.labels
      if (incoming.shares_count !== undefined) merged.shares_count = incoming.shares_count
      merged._syncStatus = SYNC.SYNCED
      await put(STORES.NOTES, merged)
    } else {
      await put(STORES.NOTES, { ...incoming, _syncStatus: SYNC.SYNCED })
    }
  }
}

// ── Cache a single note (from show/create/update endpoint) ──
export async function cacheNote(note) {
  await put(STORES.NOTES, { ...note, _syncStatus: SYNC.SYNCED })
}

// ── Get all cached notes ──
export async function getAllCached() {
  return getAll(STORES.NOTES)
}

// ── Get single cached note ──
export async function getCachedNote(id) {
  return get(STORES.NOTES, id)
}

// ── Save a local-only draft (offline) ──
export async function saveDraft(note) {
  await put(STORES.NOTES, { ...note, _syncStatus: SYNC.DRAFT })
}

// ── Mark note as syncing ──
export async function markSyncing(id) {
  const note = await get(STORES.NOTES, id)
  if (note) {
    note._syncStatus = SYNC.SYNCING
    await put(STORES.NOTES, note)
  }
}

// ── Mark note as failed ──
export async function markFailed(id) {
  const note = await get(STORES.NOTES, id)
  if (note) {
    note._syncStatus = SYNC.FAILED
    await put(STORES.NOTES, note)
  }
}

// ── Mark note as synced ──
export async function markSynced(id, serverNote) {
  if (serverNote) {
    await put(STORES.NOTES, { ...serverNote, _syncStatus: SYNC.SYNCED })
  } else {
    const note = await get(STORES.NOTES, id)
    if (note) {
      note._syncStatus = SYNC.SYNCED
      await put(STORES.NOTES, note)
    }
  }
}

// ── Remove note from cache ──
export async function removeCachedNote(id) {
  await del(STORES.NOTES, id)
}

// ── Get sync status for a note ──
export async function getSyncStatus(id) {
  const note = await get(STORES.NOTES, id)
  return note?._syncStatus || SYNC.SYNCED
}

// ── Get all notes with a specific sync status ──
export async function getBySyncStatus(status) {
  const all = await getAll(STORES.NOTES)
  return all.filter(n => n._syncStatus === status)
}

// ── Clear all cached notes ──
export async function clearCache() {
  await clear(STORES.NOTES)
}
