'use client'

/**
 * useToast.ts — Lightweight toast notification system
 * ════════════════════════════════════════════════════
 * Zero-dependency, SSR-safe. Works with the Toast component below.
 *
 * USAGE:
 *   const { toast } = useToast()
 *   toast.success('Pin reported successfully!')
 *   toast.error('Failed to fetch location')
 *   toast.warning('SLA breach detected')
 *   toast.info('Escalation triggered for RW-0047')
 *
 * SETUP:
 *   1. Wrap app in <ToastProvider> (see Toast.tsx)
 *   2. Call useToast() anywhere inside the tree
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'emergency'

export interface ToastItem {
  id:       string
  message:  string
  variant:  ToastVariant
  duration: number
  icon?:    string
}

export interface ToastContextValue {
  toasts:     ToastItem[]
  addToast:   (msg: string, variant: ToastVariant, opts?: { duration?: number; icon?: string }) => void
  removeToast:(id: string) => void
  toast: {
    success:   (msg: string, icon?: string) => void
    error:     (msg: string, icon?: string) => void
    warning:   (msg: string, icon?: string) => void
    info:      (msg: string, icon?: string) => void
    emergency: (msg: string, icon?: string) => void
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

// Non-nullable default so consumers don't need null-guards when used inside the tree.
// Throws a clear error outside the provider instead of silently doing nothing.
export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const removeToast = useCallback((id: string) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((
    message: string,
    variant: ToastVariant,
    opts: { duration?: number; icon?: string } = {}
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const duration = opts.duration ?? (variant === 'error' || variant === 'emergency' ? 6000 : 3500)

    setToasts(prev => {
      // Max 4 toasts visible at once — drop oldest
      return [...prev.slice(-3), { id, message, variant, duration, icon: opts.icon }]
    })

    timers.current[id] = setTimeout(() => removeToast(id), duration)
  }, [removeToast])

  // Cleanup all timers on unmount
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout) }, [])

  const toast: ToastContextValue['toast'] = {
    success:   (msg, icon) => addToast(msg, 'success',   { icon: icon ?? '✅' }),
    error:     (msg, icon) => addToast(msg, 'error',     { icon: icon ?? '❌' }),
    warning:   (msg, icon) => addToast(msg, 'warning',   { icon: icon ?? '⚠️' }),
    info:      (msg, icon) => addToast(msg, 'info',      { icon: icon ?? 'ℹ️' }),
    emergency: (msg, icon) => addToast(msg, 'emergency', { icon: icon ?? '🚨', duration: 8000 }),
  }

  const value: ToastContextValue = { toasts, addToast, removeToast, toast }

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  )
}
