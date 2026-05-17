import { openDB } from 'idb'

const DB_NAME    = 'noteapp'
const DB_VERSION = 1

let _db = null

async function getDB() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Notes store
      if (!db.objectStoreNames.contains('notes')) {
        const notes = db.createObjectStore('notes', { keyPath: 'id' })
        notes.createIndex('user_id', 'user_id')
        notes.createIndex('updated_at', 'updated_at')
      }
      // Labels store
      if (!db.objectStoreNames.contains('labels')) {
        db.createObjectStore('labels', { keyPath: 'id' })
      }
      // Sync queue — offline mutations pending upload
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true })
      }
    },
  })
  return _db
}

// ── Notes ─────────────────────────────────────────────────

export async function localGetNotes() {
  const db = await getDB()
  return db.getAll('notes')
}

export async function localSaveNote(note) {
  const db = await getDB()
  await db.put('notes', { ...note, _synced: true })
}

export async function localSaveNotes(notes) {
  const db = await getDB()
  const tx = db.transaction('notes', 'readwrite')
  await Promise.all([...notes.map(n => tx.store.put({ ...n, _synced: true })), tx.done])
}

export async function localDeleteNote(id) {
  const db = await getDB()
  await db.delete('notes', id)
}

// ── Labels ────────────────────────────────────────────────

export async function localSaveLabels(labels) {
  const db = await getDB()
  const tx = db.transaction('labels', 'readwrite')
  await Promise.all([...labels.map(l => tx.store.put(l)), tx.done])
}

export async function localGetLabels() {
  const db = await getDB()
  return db.getAll('labels')
}

// ── Sync Queue ────────────────────────────────────────────

export async function queueMutation(mutation) {
  // mutation: { method, url, data, tempId }
  const db = await getDB()
  await db.add('sync_queue', { ...mutation, queuedAt: Date.now() })
}

export async function getQueuedMutations() {
  const db = await getDB()
  return db.getAll('sync_queue')
}

export async function removeQueuedMutation(id) {
  const db = await getDB()
  await db.delete('sync_queue', id)
}

export async function clearSyncQueue() {
  const db = await getDB()
  await db.clear('sync_queue')
}