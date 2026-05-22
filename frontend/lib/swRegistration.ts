/**
 * lib/swRegistration.ts — Service Worker lifecycle manager
 * ══════════════════════════════════════════════════════════
 * Handles:
 *  - Registration of /sw.js
 *  - Update detection + user prompt for refresh
 *  - Online/offline event listeners
 *  - Reactive slow-connection detection via navigator.connection.onchange
 *  - Background Sync registration for pending reports
 *  - PostMessage handling (sync trigger from SW)
 */

export type NetworkStatus = 'online' | 'offline' | 'slow';

interface SWRegistrationOptions {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

let _registration: ServiceWorkerRegistration | null = null;

/** Register the service worker. Call this in a 'use client' component on mount. */
export async function registerServiceWorker(
  options: SWRegistrationOptions = {}
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported in this browser');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    _registration = reg;

    if (reg.waiting) {
      options.onUpdate?.(reg);
    }

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SW] New version available');
          options.onUpdate?.(reg);
        }
        if (newWorker.state === 'activated' && !navigator.serviceWorker.controller) {
          console.log('[SW] Content cached for offline use');
          options.onSuccess?.(reg);
        }
      });
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_REPORTS') {
        handleSyncReports();
      }
    });

    setInterval(() => reg.update(), 60 * 60 * 1000);

    console.log('[SW] Registered successfully, scope:', reg.scope);
    return reg;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}

/** Activate the waiting SW (triggers page reload) */
export function activateNewWorker(): void {
  _registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  }, { once: true });
}

/** Register a background sync tag for pending road reports.
 *  onSynced receives the count of successfully synced reports. */
export async function requestSync(
  tag = 'sync-road-reports',
  onSynced?: (count: number) => void
): Promise<void> {
  const reg = _registration || (await navigator.serviceWorker.ready);
  if ('sync' in reg) {
    try {
      await (reg as any).sync.register(tag);
      console.log('[SW] Background sync registered:', tag);
      const count = await handleSyncReports();
      if (count > 0) onSynced?.(count);
    } catch (err) {
      console.warn('[SW] Background sync failed, retrying inline:', err);
      const count = await handleSyncReports();
      if (count > 0) onSynced?.(count);
    }
  } else {
    const count = await handleSyncReports();
    if (count > 0) onSynced?.(count);
  }
}

/** Attempt to sync pending reports from IndexedDB. Returns synced count. */
async function handleSyncReports(): Promise<number> {
  let syncedCount = 0;
  try {
    const { getPendingReports, markReportSynced, markReportFailed } = await import('./db');
    const { API_BASE } = await import('./utils');
    const pending = await getPendingReports();

    for (const report of pending) {
      try {
        const res = await fetch(`${API_BASE}/report/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: report.description,
            category:    report.category,
            lat:         report.lat,
            lon:         report.lon,
          }),
        });
        if (res.ok) {
          await markReportSynced(report.id!);
          syncedCount++;
          console.log('[SW] Synced report:', report.ticketId);
        } else {
          await markReportFailed(report.id!);
        }
      } catch {
        await markReportFailed(report.id!);
      }
    }
  } catch (err) {
    console.error('[SW] Sync handler error:', err);
  }
  return syncedCount;
}

/** Listen for online/offline transitions and reactive slow-connection changes.
 *  Returns a cleanup function. */
export function watchNetworkStatus(callbacks: {
  onOnline?:  () => void;
  onOffline?: () => void;
  onSlow?:    () => void;
  onSynced?:  (count: number) => void;
}): () => void {
  const onOnline  = () => {
    callbacks.onOnline?.();
    requestSync('sync-road-reports', callbacks.onSynced);
  };
  const onOffline = () => { callbacks.onOffline?.(); };

  window.addEventListener('online',  onOnline);
  window.addEventListener('offline', onOffline);

  // ── Reactive slow-connection detection (Network Information API) ─────────
  const conn = (navigator as any).connection;
  let connectionCleanup: (() => void) | null = null;

  if (conn) {
    const slowTypes = ['slow-2g', '2g'];
    const handleConnectionChange = () => {
      if (slowTypes.includes(conn.effectiveType)) {
        callbacks.onSlow?.();
      } else if (navigator.onLine) {
        callbacks.onOnline?.();
      }
    };
    conn.addEventListener('change', handleConnectionChange);
    connectionCleanup = () => conn.removeEventListener('change', handleConnectionChange);
  }

  return () => {
    window.removeEventListener('online',  onOnline);
    window.removeEventListener('offline', onOffline);
    connectionCleanup?.();
  };
}

/** Returns current network status (snapshot) */
export function getNetworkStatus(): NetworkStatus {
  if (typeof navigator === 'undefined') return 'online';
  if (!navigator.onLine) return 'offline';

  const conn = (navigator as any).connection;
  if (conn) {
    const slowTypes = ['slow-2g', '2g'];
    if (slowTypes.includes(conn.effectiveType)) return 'slow';
  }
  return 'online';
}
