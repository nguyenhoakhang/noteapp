// src/offline/db.js — Low-level IndexedDB wrapper
// Uses the `idb` npm package for cleaner promises
import { openDB } from 'idb'

const DB_NAME    = 'noteapp'
const DB_VERSION = 3

export const STORES = {
  NOTES:      'notes',
  LABELS:     'labels',
  SYNC_QUEUE: 'sync_queue',
}

// Cache the promise itself to prevent concurrent openDB calls
let _dbPromise = null

function getDB() {
  if (_dbPromise) return _dbPromise

  _dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // ── Notes store ──
      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        const notes = db.createObjectStore(STORES.NOTES, { keyPath: 'id' })
        notes.createIndex('user_id', 'user_id')
        notes.createIndex('updated_at', 'updated_at')
        notes.createIndex('sync_status', '_syncStatus')
      }

      // ── Labels store ──
      if (!db.objectStoreNames.contains(STORES.LABELS)) {
        db.createObjectStore(STORES.LABELS, { keyPath: 'id' })
      }

      // ── Sync queue store ──
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const q = db.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'id',
          autoIncrement: true,
        })
        q.createIndex('created_at', 'created_at')
      }
    },
  })

  return _dbPromise
}

// ── Generic CRUD ──────────────────────────────────────────

export async function getAll(store) {
  const db = await getDB()
  return db.getAll(store)
}

export async function get(store, id) {
  const db = await getDB()
  return db.get(store, id)
}

export async function put(store, value) {
  const db = await getDB()
  await db.put(store, value)
}

export async function putMany(store, values) {
  const db = await getDB()
  const tx = db.transaction(store, 'readwrite')
  await Promise.all([...values.map(v => tx.store.put(v)), tx.done])
}

export async function del(store, id) {
  const db = await getDB()
  await db.delete(store, id)
}

export async function clear(store) {
  const db = await getDB()
  await db.clear(store)
}

export async function count(store) {
  const db = await getDB()
  return db.count(store)
}

export default { STORES, getAll, get, put, putMany, del, clear, count }
