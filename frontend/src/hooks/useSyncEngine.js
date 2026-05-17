// src/hooks/useSyncEngine.js — Unified sync engine
// Replaces both useOfflineSync.js and useSyncQueue.js
// Handles queue processing, online/offline detection, and retry logic
import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/axios'
import { processQueue, getQueueLength } from '../offline/syncQueue.js'
import { cacheNote, markSynced, markFailed } from '../offline/noteCache.js'
import toast from 'react-hot-toast'

export default function useSyncEngine() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncStatus, setSyncStatus] = useState('idle') // idle | syncing | error
  const wasOffline = useRef(false)
  const syncingRef = useRef(false)
  const debounceTimer = useRef(null)

  // ── Update pending count ──
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getQueueLength()
      setPendingCount(count)
    } catch {}
  }, [])

  // ── Process the sync queue ──
  const syncAll = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncStatus('syncing')

    try {
      const result = await processQueue(api)
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} change${result.synced > 1 ? 's' : ''}`)
      }
      if (result.failed > 0 && result.synced === 0) {
        setSyncStatus('error')
      } else {
        setSyncStatus('idle')
      }
      await refreshPendingCount()
    } catch {
      setSyncStatus('error')
    } finally {
      syncingRef.current = false
    }
  }, [refreshPendingCount])

  // ── Online/offline listeners ──
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      wasOffline.current = true

      // Debounce: wait 2s after reconnect before syncing
      clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        toast.loading('Back online — syncing…', { id: 'sync' })
        syncAll().finally(() => {
          toast.dismiss('sync')
        })
      }, 2000)
    }

    const handleOffline = () => {
      setOnline(false)
      wasOffline.current = true
      toast('You are offline — changes saved locally', {
        icon: '📴',
        id: 'offline',
        duration: 5000,
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial pending count
    refreshPendingCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimeout(debounceTimer.current)
    }
  }, [syncAll, refreshPendingCount])

  // ── Force sync (can be called manually) ──
  const forceSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('You are offline')
      return
    }
    await syncAll()
  }, [syncAll])

  return { online, pendingCount, syncStatus, forceSync, refreshPendingCount }
}
