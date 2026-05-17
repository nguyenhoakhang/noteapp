import { useEffect, useRef } from 'react'
import { localDB } from '../utils/localDB'
import api from '../api/axios'
import toast from 'react-hot-toast'

async function flushQueue() {
  const queue = await localDB.getQueue()
  if (!queue.length) return

  for (const item of queue) {
    try {
      const method = item.method.toLowerCase()
      if (method === 'post') await api.post(item.url, item.data)
      else if (method === 'put') await api.put(item.url, item.data)
      else if (method === 'patch') await api.patch(item.url, item.data)
      else if (method === 'delete') await api.delete(item.url)
      if (item.qid) await localDB.dequeue(item.qid)
    } catch (err) {
      // Dequeue on client errors (4xx), retry on server errors (5xx)
      if (!err.response || err.response.status < 500) {
        if (item.qid) await localDB.dequeue(item.qid)
      }
    }
  }
}

export function useOfflineSync() {
  const wasOffline = useRef(false)

  useEffect(() => {
    const handleOnline = async () => {
      if (!wasOffline.current) return
      wasOffline.current = false
      toast.loading('Back online — syncing…', { id: 'sync' })
      try {
        await flushQueue()
        toast.success('Synced!', { id: 'sync' })
      } catch {
        toast.error('Sync failed — will retry', { id: 'sync' })
      }
    }

    const handleOffline = () => {
      wasOffline.current = true
      toast('You are offline — changes saved locally', {
        icon: '📴', id: 'offline', duration: 5000,
      })
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
}
