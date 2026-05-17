// src/offline/index.js — Barrel exports for the offline module
export { STORES, getAll, get, put, putMany, del, clear, count } from './db.js'
export {
  SYNC,
  cacheNotes,
  cacheNote,
  getAllCached,
  getCachedNote,
  saveDraft,
  markSyncing,
  markFailed,
  markSynced,
  removeCachedNote,
  getSyncStatus,
  getBySyncStatus,
  clearCache,
} from './noteCache.js'
export {
  enqueue as queueMutation,
  getQueue,
  dequeue as removeQueuedMutation,
  getQueueLength,
  clearQueue,
  processQueue,
} from './syncQueue.js'
export {
  isUnlocked,
  unlock,
  invalidate as invalidateSession,
  clearAll as clearAllSessions,
  getUnlockedIds,
} from './sessionStore.js'
