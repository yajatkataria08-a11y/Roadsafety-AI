'use client'

/**
 * ShakeSOSModal.tsx — Shake-to-SOS confirmation modal
 * ══════════════════════════════════════════════════════
 * Appears dramatically after shake gesture is detected.
 * Auto-confirms after 4 seconds (with countdown) unless dismissed.
 * Activates CrashMode + GoldenHour + shares location on confirm.
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, Phone, Zap } from 'lucide-react'

interface ShakeSOSModalProps {
  isOpen: boolean
  onConfirm: () => void
  onDismiss: () => void
  autoConfirmMs?: number
}

export function ShakeSOSModal({
  isOpen,
  onConfirm,
  onDismiss,
  autoConfirmMs = 4000,
}: ShakeSOSModalProps) {
  const [countdown, setCountdown] = useState(Math.ceil(autoConfirmMs / 1000))

  useEffect(() => {
    if (!isOpen) { setCountdown(Math.ceil(autoConfirmMs / 1000)); return }

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); onConfirm(); return 0 }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, onConfirm, autoConfirmMs])

  const pct = ((autoConfirmMs / 1000 - countdown) / (autoConfirmMs / 1000)) * 100

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop — pulsing red */}
          <motion.div
            className="absolute inset-0 bg-red-950/80 backdrop-blur-md"
            animate={{ opacity: [0.7, 0.9, 0.7] }}
            transition={{ duration: 1, repeat: Infinity }}
          />

          {/* Modal card */}
          <motion.div
            className="relative w-full max-w-sm bg-[#0a0a0a] border border-red-500/50 rounded-3xl p-6 shadow-2xl"
            initial={{ scale: 0.8, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{ boxShadow: '0 0 60px rgba(239,68,68,0.35)' }}
          >
            {/* Dismiss */}
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/40"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon — animated */}
            <motion.div
              className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-4"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 0.7, repeat: Infinity }}
            >
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </motion.div>

            <h2 className="text-white font-bold text-xl text-center mb-1">
              🚨 SOS Detected!
            </h2>
            <p className="text-white/50 text-sm text-center mb-4">
              Shake gesture recognised — activating emergency protocol
            </p>

            {/* Countdown arc */}
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-5">
              <motion.div
                className="absolute inset-y-0 left-0 bg-red-500 rounded-full"
                style={{ width: `${pct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <p className="text-red-300/70 text-xs text-center mb-5">
              Auto-activating in <span className="font-bold text-red-300">{countdown}s</span> — tap dismiss to cancel
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onDismiss}
                className="flex-1 py-3 rounded-2xl border border-white/15 text-white/50 text-sm font-semibold hover:bg-white/5 transition-all"
              >
                Dismiss
              </button>
              <motion.button
                onClick={onConfirm}
                whileTap={{ scale: 0.96 }}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold
                           flex items-center justify-center gap-2 hover:bg-red-400 transition-all"
                style={{ boxShadow: '0 0 20px rgba(239,68,68,0.5)' }}
              >
                <Zap className="w-4 h-4" />
                Activate SOS
              </motion.button>
            </div>

            {/* Emergency numbers */}
            <div className="mt-4 pt-4 border-t border-white/[0.06] flex justify-center gap-4">
              {[['112', '🚨'], ['108', '🚑'], ['100', '👮']].map(([num, emoji]) => (
                <a key={num} href={`tel:${num}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10
                             text-white/60 text-xs font-mono hover:text-white hover:border-white/20 transition-all"
                >
                  <Phone className="w-3 h-3" />
                  {emoji} {num}
                </a>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
