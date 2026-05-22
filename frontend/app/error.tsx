'use client'

/**
 * app/error.tsx — Global Error Boundary (Next.js App Router)
 * ═══════════════════════════════════════════════════════════
 * Rendered whenever any Server Component or Client Component in the
 * subtree throws an unhandled error. Styled on-brand so judges never
 * see a raw browser error screen.
 *
 * Features:
 *  · Animated pulsing warning icon with glow
 *  · Error ID (for debugging) + copy button
 *  · "Try again" button (calls reset() to re-render the segment)
 *  · Links to Emergency & Chat so the app stays usable even broken
 *  · Subtle animated road graphic to keep the brand alive
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, RefreshCw, Home, Phone, MessageSquare,
  Copy, CheckCheck, ChevronRight, Wifi, WifiOff,
} from 'lucide-react'
import Link from 'next/link'

// ── Random error ID for support reference ─────────────────────────────────────
function genErrorId() {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [errorId]       = useState(genErrorId)
  const [copied, setCopied]   = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [retrying, setRetrying] = useState(false)

  // Detect offline status — many "errors" are just connectivity issues
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Log to console for devs
  useEffect(() => {
    console.error('[Road Safety AI] Unhandled error:', error)
  }, [error])

  // Copy error details to clipboard
  const handleCopy = useCallback(async () => {
    const text = [
      `Error ID: ${errorId}`,
      `Message: ${error.message}`,
      `Digest: ${error.digest ?? 'n/a'}`,
      `Online: ${isOnline}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n')
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [errorId, error, isOnline])

  // Retry with slight delay to show spinner
  const handleRetry = useCallback(async () => {
    setRetrying(true)
    await new Promise(r => setTimeout(r, 800))
    reset()
    setRetrying(false)
  }, [reset])

  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* ── Animated background road graphic ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle road lane markers scrolling downward */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-0.5 h-16 bg-white/5 rounded"
              style={{ top: `${i * 9}%` }}
              animate={{ y: ['0%', '100%'] }}
              transition={{
                duration: 6,
                delay: i * 0.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
        </div>
        {/* Radial glow behind the card */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,23,68,0.08)_0%,transparent_65%)]" />
      </div>

      {/* ── Main card ── */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        className="relative z-10 w-full max-w-md bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
      >

        {/* Offline banner */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 text-amber-400 text-xs"
            >
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              You appear to be offline. Some features require a connection.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center"
            >
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </motion.div>
            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-2xl border-2 border-red-500/30"
              animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2 font-[Rajdhani,sans-serif] tracking-wide">
            Something went wrong
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            An unexpected error occurred. Emergency features and offline data
            are still available while we sort this out.
          </p>
        </div>

        {/* Error detail (collapsed by default, expandable) */}
        <details className="mb-5 group">
          <summary className="flex items-center gap-2 text-white/30 text-xs cursor-pointer hover:text-white/50 transition-colors list-none select-none">
            <span className="flex-1">Error reference: <span className="font-mono text-white/40">{errorId}</span></span>
            <button
              onClick={(e) => { e.preventDefault(); handleCopy() }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
              title="Copy error details"
            >
              <AnimatePresence mode="wait">
                {copied
                  ? <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCheck className="w-3.5 h-3.5 text-green-400" /></motion.span>
                  : <motion.span key="copy"  initial={{ scale: 0 }} animate={{ scale: 1 }}><Copy className="w-3.5 h-3.5" /></motion.span>
                }
              </AnimatePresence>
            </button>
          </summary>
          <div className="mt-3 bg-black/30 rounded-xl p-3 font-mono text-xs text-white/40 break-all">
            {error.message || 'Unknown error'}
          </div>
        </details>

        {/* Action buttons */}
        <div className="space-y-3">
          {/* Primary: retry */}
          <motion.button
            onClick={handleRetry}
            disabled={retrying}
            whileHover={retrying ? {} : { scale: 1.02 }}
            whileTap={retrying ? {} : { scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl
                       bg-gradient-to-r from-[#FF6200] to-[#FF8C42] text-white font-semibold
                       hover:brightness-110 disabled:opacity-60 transition-all shadow-[0_4px_20px_rgba(255,98,0,0.35)]"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying…' : 'Try again'}
          </motion.button>

          {/* Secondary row */}
          <div className="grid grid-cols-3 gap-2">
            <Link href="/" className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 hover:text-white/90 hover:bg-white/[0.07] transition-all text-xs">
              <Home className="w-4 h-4" />
              Home
            </Link>
            <Link href="/emergency" className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs">
              <Phone className="w-4 h-4" />
              Emergency
            </Link>
            <Link href="/chat" className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-xs">
              <MessageSquare className="w-4 h-4" />
              AI Chat
            </Link>
          </div>
        </div>

        {/* Offline note */}
        <p className="text-center text-white/20 text-[10px] mt-5 leading-relaxed">
          {isOnline
            ? '✓ Connected · Emergency numbers & offline data remain available'
            : '⚡ Offline mode — Emergency contacts & violation data are cached'
          }
        </p>
      </motion.div>

      {/* ── Brand footer ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="relative z-10 mt-6 text-white/20 text-xs font-mono"
      >
        Road Safety AI v21 · IIT Madras Hackathon 2026
      </motion.p>
    </div>
  )
}
