'use client'

/**
 * lib/hooks/useNetworkStatus.ts
 * ══════════════════════════════════════════════════════════════════════
 * Reactive hook that tracks:
 *  · online / offline / slow  connection state
 *  · number of pending offline reports queued in IndexedDB
 *  · last-sync timestamp
 *
 * Wires together:
 *  · navigator.onLine events  (immediate offline detection)
 *  · navigator.connection API (slow-2g / 2g → "slow" status)
 *  · swRegistration.watchNetworkStatus (SW background sync callbacks)
 *  · ServiceWorker postMessage  (SYNC_REPORTS message from sw.js)
 *  · Dexie pendingReports table (live count badge for OfflineBanner)
 *
 * USAGE:
 *   const { status, pendingCount, lastSyncAt, triggerSync } = useNetworkStatus()
 *
 *   status:        'online' | 'offline' | 'slow'
 *   pendingCount:  number of reports not yet synced
 *   lastSyncAt:    Date | null — when the last successful sync ran
 *   triggerSync(): manually request background sync (e.g. from Retry button)
 *   isFirstLoad:   true while we haven't determined status yet (SSR safe)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { watchNetworkStatus, getNetworkStatus, requestSync } from '@/lib/swRegistration'
import { getPendingReports } from '@/lib/db'

export type NetworkStatus = 'online' | 'offline' | 'slow'

export interface NetworkStatusResult {
  /** Current connection status */
  status:        NetworkStatus
  /** Reports queued in IndexedDB, not yet submitted */
  pendingCount:  number
  /** Timestamp of last successful background sync */
  lastSyncAt:    Date | null
  /** Number of reports synced in last run (resets after a moment) */
  lastSyncCount: number
  /** Manually kick a background sync */
  triggerSync:   () => void
  /** True on first render before browser APIs are available */
  isFirstLoad:   boolean
}

export function useNetworkStatus(): NetworkStatusResult {
  // ── State ──────────────────────────────────────────────────────────────────

  const [status,        setStatus]        = useState<NetworkStatus>('online')
  const [pendingCount,  setPendingCount]  = useState<number>(0)
  const [lastSyncAt,    setLastSyncAt]    = useState<Date | null>(null)
  const [lastSyncCount, setLastSyncCount] = useState<number>(0)
  const [isFirstLoad,   setIsFirstLoad]   = useState<boolean>(true)

  // Debounce timer for connection changes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Read pending reports from IndexedDB and update badge count */
  const refreshPendingCount = useCallback(async () => {
    try {
      const reports = await getPendingReports()
      setPendingCount(reports.length)
    } catch {
      // IndexedDB not available in some contexts — silently ignore
      setPendingCount(0)
    }
  }, [])

  /** Debounced status setter — avoids flickering on brief network drops */
  const debouncedSetStatus = useCallback(
    (next: NetworkStatus, delay = 600) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => setStatus(next), delay)
    },
    []
  )

  /** Kick a background sync and refresh counts */
  const triggerSync = useCallback(() => {
    requestSync('sync-road-reports', async (count) => {
      if (count > 0) {
        setLastSyncCount(count)
        setLastSyncAt(new Date())
        // Clear the "last sync count" badge after 5 s
        setTimeout(() => setLastSyncCount(0), 5000)
      }
      await refreshPendingCount()
    }).catch(() => {
      // Background sync API may not be available — no-op
    })
  }, [refreshPendingCount])

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    // Snapshot initial status from browser
    setStatus(getNetworkStatus())
    setIsFirstLoad(false)

    // Read pending count from IndexedDB immediately
    refreshPendingCount()

    // ── Wire up swRegistration watchers ──────────────────────────────────────
    const cleanup = watchNetworkStatus({
      onOnline() {
        debouncedSetStatus('online')
        // Coming back online → attempt to drain queue
        triggerSync()
      },
      onOffline() {
        // No debounce for offline — respond immediately
        if (debounceRef.current) clearTimeout(debounceRef.current)
        setStatus('offline')
      },
      onSlow() {
        debouncedSetStatus('slow', 0)
      },
      async onSynced(count) {
        if (count > 0) {
          setLastSyncCount(count)
          setLastSyncAt(new Date())
          setTimeout(() => setLastSyncCount(0), 5000)
        }
        await refreshPendingCount()
      },
    })

    // ── Listen for SW → client postMessage (e.g. SYNC_REPORTS from sw.js) ───
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_REPORTS') {
        refreshPendingCount()
      }
      if (event.data?.type === 'REPORT_SYNCED') {
        setLastSyncAt(new Date())
        refreshPendingCount()
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    // ── Poll pending count every 30 s (covers race conditions) ───────────────
    const pollInterval = setInterval(refreshPendingCount, 30_000)

    return () => {
      cleanup()
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
      clearInterval(pollInterval)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [debouncedSetStatus, refreshPendingCount, triggerSync])

  // ── Refresh pending count whenever the window regains focus ───────────────
  useEffect(() => {
    const onFocus = () => refreshPendingCount()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshPendingCount])

  return {
    status,
    pendingCount,
    lastSyncAt,
    lastSyncCount,
    triggerSync,
    isFirstLoad,
  }
}
