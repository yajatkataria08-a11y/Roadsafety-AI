'use client'

/**
 * components/shared/OfflineBanner.tsx
 * ══════════════════════════════════════════════════════════════════════
 * Slim animated banner that slides down from behind the Navbar when
 * the device is offline or on a slow connection.
 *
 * Features:
 *  · Amber (offline) or blue (slow) colour scheme
 *  · Pending-reports badge: "3 reports queued"
 *  · Retry button that calls triggerSync() + navigator.onLine check
 *  · Success flash when sync completes ("↑ 2 reports synced!")
 *  · Connection quality dot in Navbar (exported separately)
 *  · Animated entrance/exit via Framer Motion
 *  · Fully accessible (role="status", aria-live)
 *
 * USAGE in layout.tsx:
 *   import { OfflineBanner } from '@/components/shared/OfflineBanner'
 *   // ...inside <body> before {children}:
 *   <OfflineBanner />
 *
 * USAGE for Navbar connection dot:
 *   import { ConnectionDot } from '@/components/shared/OfflineBanner'
 *   <ConnectionDot />
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi, RefreshCw, CloudUpload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useNetworkStatus } from '@/lib/hooks/useNetworkStatus'

// ── OfflineBanner ─────────────────────────────────────────────────────────────

export function OfflineBanner() {
  const {
    status,
    pendingCount,
    lastSyncAt,
    lastSyncCount,
    triggerSync,
    isFirstLoad,
  } = useNetworkStatus()

  const [retrying, setRetrying] = useState(false)

  const handleRetry = useCallback(async () => {
    setRetrying(true)
    triggerSync()
    // Give SW a moment to respond, then force a page reload check
    await new Promise(r => setTimeout(r, 1200))
    // Only reload if we're actually back online
    if (navigator.onLine) {
      window.location.reload()
    }
    setRetrying(false)
  }, [triggerSync])

  // Don't render during SSR or when fully online with nothing pending
  if (isFirstLoad) return null
  if (status === 'online' && pendingCount === 0 && lastSyncCount === 0) return null

  const isOffline = status === 'offline'
  const isSlow    = status === 'slow'

  // Colour tokens per status
  const colors = isOffline
    ? { bg: 'bg-amber-500/90', border: 'border-amber-400/40', text: 'text-amber-950', icon: 'text-amber-800', btn: 'bg-amber-700/30 hover:bg-amber-700/50 text-amber-950 border-amber-800/30' }
    : isSlow
    ? { bg: 'bg-blue-600/90',  border: 'border-blue-400/40',  text: 'text-blue-50',   icon: 'text-blue-200',  btn: 'bg-blue-800/40 hover:bg-blue-800/60 text-blue-50 border-blue-300/20' }
    : { bg: 'bg-green-600/90', border: 'border-green-400/40', text: 'text-green-50',  icon: 'text-green-200', btn: 'bg-green-800/30 hover:bg-green-800/50 text-green-50 border-green-300/20' }

  return (
    <AnimatePresence>
      {/* Slide down from top — sits just below the fixed Navbar (top: 56px / 3.5rem) */}
      <motion.div
        key={status}
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0,   opacity: 1 }}
        exit={{ y: -48, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`
          fixed left-0 right-0 z-40
          ${colors.bg} ${colors.border} border-b
          backdrop-blur-sm
        `}
        style={{ top: '3.5rem' }} // below 56px Navbar
      >
        <div className="max-w-6xl mx-auto px-4 h-9 flex items-center justify-between gap-3">

          {/* Left: icon + message */}
          <div className={`flex items-center gap-2 text-xs font-medium ${colors.text} min-w-0`}>
            {/* Icon */}
            <span className={`shrink-0 ${colors.icon}`}>
              {isOffline
                ? <WifiOff className="w-3.5 h-3.5" />
                : isSlow
                ? <Wifi className="w-3.5 h-3.5 opacity-60" />
                : <CheckCircle2 className="w-3.5 h-3.5" />
              }
            </span>

            {/* Message */}
            <span className="truncate">
              {isOffline
                ? 'Offline — showing cached data'
                : isSlow
                ? 'Slow connection — some features may be delayed'
                : lastSyncCount > 0
                ? `↑ ${lastSyncCount} report${lastSyncCount !== 1 ? 's' : ''} synced successfully`
                : 'Back online'
              }
            </span>

            {/* Pending reports badge */}
            {pendingCount > 0 && (
              <span className={`
                shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full
                bg-black/15 text-[10px] font-bold
                ${colors.text}
              `}>
                <CloudUpload className="w-2.5 h-2.5" />
                {pendingCount} queued
              </span>
            )}
          </div>

          {/* Right: last sync time + retry button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Last synced timestamp */}
            {lastSyncAt && !isOffline && (
              <span className={`text-[10px] font-mono opacity-60 ${colors.text}`}>
                synced {lastSyncAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {/* Retry / sync button */}
            {(isOffline || pendingCount > 0) && (
              <motion.button
                onClick={handleRetry}
                disabled={retrying}
                whileTap={{ scale: 0.92 }}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-full border
                  text-[11px] font-semibold transition-all
                  ${colors.btn}
                  disabled:opacity-50
                `}
              >
                <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Retrying…' : pendingCount > 0 ? 'Sync now' : 'Retry'}
              </motion.button>
            )}
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── ConnectionDot ─────────────────────────────────────────────────────────────
//
// Tiny coloured dot for the Navbar — green/amber/red with tooltip.
// Drop it into Navbar.tsx next to the user avatar.

export function ConnectionDot({ className = '' }: { className?: string }) {
  const { status, pendingCount, isFirstLoad } = useNetworkStatus()
  const [showTip, setShowTip] = useState(false)

  if (isFirstLoad) return null

  const dot = {
    online:  { color: 'bg-green-400',  ring: 'ring-green-400/30', pulse: false },
    slow:    { color: 'bg-blue-400',   ring: 'ring-blue-400/30',  pulse: true  },
    offline: { color: 'bg-amber-400',  ring: 'ring-amber-400/30', pulse: true  },
  }[status]

  const label = {
    online:  'Online',
    slow:    'Slow connection',
    offline: 'Offline',
  }[status]

  return (
    <div
      className={`relative flex items-center ${className}`}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span
        className={`
          w-2 h-2 rounded-full ${dot.color} ring-2 ${dot.ring}
          ${dot.pulse ? 'animate-pulse' : ''}
        `}
      />

      {/* Pending badge */}
      {pendingCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-500
          flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {showTip && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full right-0 mt-2 z-50 whitespace-nowrap
              bg-[#1C2A45] border border-white/15 rounded-lg px-3 py-2
              pointer-events-none shadow-xl"
          >
            <p className="text-white/90 text-xs font-semibold">{label}</p>
            {pendingCount > 0 && (
              <p className="text-amber-400 text-[10px]">
                {pendingCount} report{pendingCount !== 1 ? 's' : ''} pending sync
              </p>
            )}
            <span className="absolute bottom-full right-3 border-4 border-transparent border-b-[#1C2A45]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── OfflineGuard ──────────────────────────────────────────────────────────────
//
// Wraps content that requires network access.
// Shows a helpful fallback card when offline instead of broken state.

interface OfflineGuardProps {
  children:     React.ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  /** Allow rendering children even offline (default: false) */
  passthrough?: boolean
}

export function OfflineGuard({
  children,
  fallbackTitle   = 'Feature unavailable offline',
  fallbackMessage = 'This feature requires an internet connection. Offline data may be available.',
  passthrough     = false,
}: OfflineGuardProps) {
  const { status, isFirstLoad } = useNetworkStatus()

  if (isFirstLoad || passthrough || status !== 'offline') {
    return <>{children}</>
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center
        bg-amber-500/5 border border-amber-500/15 rounded-2xl"
    >
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20
        flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
      </div>
      <div>
        <p className="text-white/80 text-sm font-semibold mb-1">{fallbackTitle}</p>
        <p className="text-white/40 text-xs max-w-xs">{fallbackMessage}</p>
      </div>
    </motion.div>
  )
}
