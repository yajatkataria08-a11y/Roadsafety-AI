'use client'

/**
 * Toast.tsx — Animated toast notification component
 * ══════════════════════════════════════════════════
 * Drop into app/layout.tsx:
 *   import { ToastProvider } from '@/lib/hooks/useToast'
 *   import { ToastContainer } from '@/components/shared/Toast'
 *
 *   // In layout:
 *   <ToastProvider>
 *     {children}
 *     <ToastContainer />
 *   </ToastProvider>
 *
 * Then anywhere in the app:
 *   const { toast } = useToast()
 *   toast.success('Issue reported!')
 *   toast.emergency('🚨 CrashMode activated — nearest hospital 2.1 km')
 */

import { useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle, Siren } from 'lucide-react'
import { ToastContext, type ToastVariant } from '@/lib/hooks/useToast'

const VARIANT_CONFIG: Record<ToastVariant, {
  bg: string; border: string; text: string; Icon: React.ElementType; progressColor: string
}> = {
  success:   { bg: 'bg-green-500/15',   border: 'border-green-500/30',   text: 'text-green-300',    Icon: CheckCircle2,    progressColor: '#22c55e' },
  error:     { bg: 'bg-red-500/15',     border: 'border-red-500/30',     text: 'text-red-300',      Icon: AlertCircle,     progressColor: '#ef4444' },
  warning:   { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-300',    Icon: AlertTriangle,   progressColor: '#f59e0b' },
  info:      { bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    text: 'text-blue-300',     Icon: Info,            progressColor: '#3b82f6' },
  emergency: { bg: 'bg-red-600/20',     border: 'border-red-500/50',     text: 'text-red-200',      Icon: Siren,           progressColor: '#ef4444' },
}

function Toast({
  id, message, variant, duration, icon, onClose,
}: {
  id: string; message: string; variant: ToastVariant
  duration: number; icon?: string; onClose: (id: string) => void
}) {
  const cfg = VARIANT_CONFIG[variant]
  const Icon = cfg.Icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{   opacity: 0, y: -8,  scale: 0.95, transition: { duration: 0.2 } }}
      className={`relative flex items-start gap-3 w-full max-w-sm rounded-2xl px-4 py-3 shadow-xl
        border backdrop-blur-xl overflow-hidden ${cfg.bg} ${cfg.border}`}
      style={{
        boxShadow: variant === 'emergency'
          ? '0 0 30px rgba(239,68,68,0.35), 0 4px 20px rgba(0,0,0,0.5)'
          : '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        {icon
          ? <span className="text-lg leading-none">{icon}</span>
          : <Icon className={`w-4 h-4 ${cfg.text}`} />
        }
      </div>

      {/* Message */}
      <p className={`flex-1 text-sm leading-snug ${cfg.text} font-medium`}>{message}</p>

      {/* Close */}
      <button
        onClick={() => onClose(id)}
        className="shrink-0 p-0.5 rounded-md opacity-40 hover:opacity-70 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5 text-white" />
      </button>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 rounded-full"
        style={{ background: cfg.progressColor + '80' }}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
      />

      {/* Emergency pulse ring */}
      {variant === 'emergency' && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ boxShadow: ['0 0 0 0 rgba(239,68,68,0.4)', '0 0 0 8px rgba(239,68,68,0)'] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
    </motion.div>
  )
}

export function ToastContainer() {
  const ctx = useContext(ToastContext)
  if (!ctx) return null
  const { toasts, removeToast } = ctx

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 w-full max-w-sm pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast {...t} onClose={removeToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default ToastContainer
