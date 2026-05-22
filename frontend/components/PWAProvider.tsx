'use client';

/**
 * components/PWAProvider.tsx
 * ═══════════════════════════════════════════════════════════════════
 * Client component that:
 *   1. Registers the service worker on mount
 *   2. Shows an update-available banner when a new SW is waiting
 *   3. Shows an install prompt (A2HS) for eligible browsers
 *   4. Tracks online/offline/slow status reactively (exposes via useNetworkStatus)
 *   5. Warms up the offline MiniLM classifier in the background (requestIdleCallback)
 *   6. Initialises the IndexedDB (seeds violations + emergency contacts)
 *   7. Toasts the count of synced reports on reconnect
 * ═══════════════════════════════════════════════════════════════════
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Zap } from 'lucide-react';
import { useToast } from '@/lib/hooks/useToast';
import {
  registerServiceWorker,
  activateNewWorker,
  watchNetworkStatus,
  getNetworkStatus,
  type NetworkStatus,
} from '@/lib/swRegistration';
import { initDatabase } from '@/lib/db';
import { warmUpClassifier } from '@/lib/offlineClassifier';

// ── Context ───────────────────────────────────────────────────────────────────

interface PWAContextValue {
  networkStatus: NetworkStatus;
  isInstallable: boolean;
  isUpdateAvailable: boolean;
  installApp: () => void;
  applyUpdate: () => void;
  dismissUpdate: () => void;
}

const PWAContext = createContext<PWAContextValue>({
  networkStatus:    'online',
  isInstallable:    false,
  isUpdateAvailable:false,
  installApp:       () => {},
  applyUpdate:      () => {},
  dismissUpdate:    () => {},
});

export function usePWA() {
  return useContext(PWAContext);
}

export function useNetworkStatus() {
  return useContext(PWAContext).networkStatus;
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface PWAProviderProps {
  children: ReactNode;
}

export default function PWAProvider({ children }: PWAProviderProps) {
  const { toast } = useToast()
  const [networkStatus, setNetworkStatus]         = useState<NetworkStatus>('online');
  const [isInstallable, setIsInstallable]         = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [deferredPrompt, setDeferredPrompt]       = useState<any>(null);

  useEffect(() => {
    // Set initial network status from snapshot
    setNetworkStatus(getNetworkStatus());

    // ── Service Worker ──────────────────────────────────────────────────────
    registerServiceWorker({
      onUpdate:  () => setIsUpdateAvailable(true),
      onSuccess: () => console.log('[PWA] App ready for offline use'),
    });

    // ── Network status watcher (reactive — includes connection.onchange) ────
    const cleanup = watchNetworkStatus({
      onOnline:  () => {
        setNetworkStatus('online');
        toast.success('Back online');
      },
      onOffline: () => {
        setNetworkStatus('offline');
        toast.warning('📡 Offline — using cached data');
      },
      // Reactive slow detection from navigator.connection.onchange
      onSlow: () => {
        setNetworkStatus('slow');
      },
      // Fired after background sync completes with synced report count
      onSynced: (count: number) => {
        toast.success(`✅ ${count} pending report${count !== 1 ? 's' : ''} synced`);
      },
    });

    // ── Install prompt (A2HS) ───────────────────────────────────────────────
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // ── DB init + classifier warmup via requestIdleCallback ─────────────────
    // Both DB init AND classifier warmup go through requestIdleCallback so neither
    // competes with page render. The classifier gets its own nested idle request
    // with a 4s deadline (previously setTimeout 3s — now consistent).
    const scheduleBackground = () => {
      initDatabase().catch(console.error);

      // Warm up classifier in its own idle slot with a 4s deadline
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(
          () => warmUpClassifier(),
          { timeout: 4000 }
        );
      } else {
        // Environments without requestIdleCallback (e.g. Safari < 16)
        setTimeout(() => warmUpClassifier(), 1000);
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(scheduleBackground, { timeout: 5000 });
    } else {
      setTimeout(scheduleBackground, 1000);
    }

    return () => {
      cleanup();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    setDeferredPrompt(null);
    setIsInstallable(false);
  }, [deferredPrompt]);

  const applyUpdate = useCallback(() => {
    activateNewWorker();
    setIsUpdateAvailable(false);
  }, []);

  const dismissUpdate = useCallback(() => {
    setIsUpdateAvailable(false);
  }, []);

  return (
    <PWAContext.Provider value={{ networkStatus, isInstallable, isUpdateAvailable, installApp, applyUpdate, dismissUpdate }}>
      {children}

      {/* ── Update Banner ───────────────────────────────────────────────────── */}
      {isUpdateAvailable && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-3
                     bg-[#0F1629] border border-[#FF6200]/40 rounded-2xl shadow-2xl shadow-black/60
                     text-sm font-medium text-white max-w-[calc(100vw-2rem)] w-max"
        >
          <span className="text-base">🔄</span>
          <span className="text-slate-200">New version available</span>
          <button
            onClick={applyUpdate}
            className="ml-1 px-3 py-1 bg-[#FF6200] text-white rounded-lg text-xs font-semibold
                       hover:bg-[#e05500] active:scale-95 transition-all"
          >
            Refresh
          </button>
          <button
            onClick={dismissUpdate}
            className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Offline pill — compact, bottom-center, pulse animation ─────────── */}
      {/* ── Slow banner — top full-width (less disruptive than offline pill) ── */}
      <AnimatePresence>
        {networkStatus === 'offline' && (
          <motion.div
            key="offline-pill"
            role="status"
            initial={{ y: 24, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{
              position: 'fixed',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9998,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 16px',
              background: 'rgba(245, 158, 11, 0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: 999,
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              color: '#1a1a1a',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {/* Pulse dot */}
            <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{
                position: 'absolute',
                width: 8, height: 8,
                borderRadius: '50%',
                background: '#1a1a1a',
                opacity: 0.4,
                animation: 'pwa-pulse 1.6s ease-in-out infinite',
              }} />
              <WifiOff size={14} style={{ position: 'relative' }} />
            </span>
            Offline — cached data active
            <style>{`
              @keyframes pwa-pulse {
                0%, 100% { transform: scale(1); opacity: 0.4; }
                50% { transform: scale(2.2); opacity: 0; }
              }
            `}</style>
          </motion.div>
        )}

        {networkStatus === 'slow' && (
          <motion.div
            key="slow-banner"
            role="status"
            initial={{ y: -52, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{    y: -52, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="fixed top-0 left-0 right-0 z-[9997] flex items-center gap-3
                       px-4 py-2 bg-amber-600/90 backdrop-blur-sm text-white text-sm font-medium"
          >
            <Zap className="w-4 h-4 shrink-0" />
            <span>Slow connection — Using cached data where possible</span>
          </motion.div>
        )}
      </AnimatePresence>
    </PWAContext.Provider>
  );
}

// ── Install Button (reusable) ─────────────────────────────────────────────────

export function PWAInstallButton({ className = '' }: { className?: string }) {
  const { isInstallable, installApp } = usePWA();
  if (!isInstallable) return null;

  return (
    <button
      onClick={installApp}
      className={`flex items-center gap-2 px-4 py-2 bg-[#FF6200] hover:bg-[#e05500]
                  text-white rounded-xl font-semibold text-sm transition-all active:scale-95 ${className}`}
    >
      <span>📲</span>
      Install App
    </button>
  );
}

// ── Offline-aware fetch wrapper ───────────────────────────────────────────────

export async function offlineAwareFetch<T>(
  url: string,
  options?: RequestInit,
  fallback?: T
): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}
