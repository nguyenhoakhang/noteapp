// src/offline/syncQueue.js — Offline mutation queue
// Queues pending creates/updates/deletes for when connectivity returns
import { STORES, getAll, get, put, del, count, clear } from './db.js'

// ── Enqueue a mutation ──
// item: { method: 'POST'|'PUT'|'DELETE', url: string, data?: object, tempId?: string }
export async function enqueue(item) {
  await put(STORES.SYNC_QUEUE, {
    ...item,
    created_at: Date.now(),
    retries: 0,
  })
}

// ── Get all queued mutations, ordered by creation time ──
export async function getQueue() {
  const items = await getAll(STORES.SYNC_QUEUE)
  return items.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
}

// ── Remove a processed mutation ──
export async function dequeue(id) {
  if (!id) return
  await del(STORES.SYNC_QUEUE, id)
}

// ── Increment retry count ──
export async function incrementRetry(id) {
  const item = await get(STORES.SYNC_QUEUE, id)
  if (item) {
    item.retries = (item.retries || 0) + 1
    await put(STORES.SYNC_QUEUE, item)
  }
}

// ── Get queue length ──
export async function getQueueLength() {
  return count(STORES.SYNC_QUEUE)
}

// ── Clear entire queue ──
export async function clearQueue() {
  await clear(STORES.SYNC_QUEUE)
}

// ── Process all queued mutations ──
// Returns { synced: number, failed: number }
export async function processQueue(apiClient) {
  const queue = await getQueue()
  if (!queue.length) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const item of queue) {
    try {
      const method = item.method.toLowerCase()
      let response

      if (method === 'post') {
        response = await apiClient.post(item.url, item.data)
      } else if (method === 'put') {
        response = await apiClient.put(item.url, item.data)
      } else if (method === 'patch') {
        response = await apiClient.patch(item.url, item.data)
      } else if (method === 'delete') {
        response = await apiClient.delete(item.url)
      }

      // Success — remove from queue
      await dequeue(item.id)
      synced++

      // If this was a temp note creation, return the server response
      // so the caller can update the temp ID mapping
      if (item.tempId && response?.data?.data?.id) {
        // The caller should handle temp ID replacement
      }
    } catch (err) {
      // Dequeue on client errors (4xx) — these won't succeed on retry
      // Keep on server errors (5xx) — retry later
      if (!err.response || err.response.status < 500) {
        await dequeue(item.id)
        failed++
      } else {
        await incrementRetry(item.id)
        failed++
      }
    }
  }

  return { synced, failed }
}
