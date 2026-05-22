'use client'

/**
 * app/not-found.tsx — 404 Not Found Page
 * ══════════════════════════════════════════
 * Rendered by Next.js when no route matches. Fully on-brand with
 * animated road number "404" and quick escape links.
 */

import { motion } from 'framer-motion'
import { Home, Map, MessageSquare, AlertTriangle, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const QUICK_LINKS = [
  { href: '/',          label: 'Home',      icon: Home,          color: 'text-white/60 border-white/10 hover:text-white/90 hover:border-white/20 hover:bg-white/5' },
  { href: '/map',       label: 'Map',       icon: Map,           color: 'text-blue-400  border-blue-500/20 hover:bg-blue-500/10' },
  { href: '/emergency', label: 'Emergency', icon: AlertTriangle, color: 'text-red-400   border-red-500/20  hover:bg-red-500/10' },
  { href: '/chat',      label: 'AI Chat',   icon: MessageSquare, color: 'text-violet-400 border-violet-500/20 hover:bg-violet-500/10' },
]

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* ── Decorative background ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_60%,rgba(30,144,255,0.07),transparent)]" />
        {/* Road dashes */}
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-2 w-12 rounded-full bg-white/5"
            style={{ left: `${10 + i * 15}%`, top: '75%' }}
            animate={{ x: [0, 20, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center max-w-lg w-full">

        {/* Giant 404 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 140, damping: 18 }}
          className="relative mb-8 select-none"
        >
          {/* Road sign shape behind the numbers */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-36 rounded-2xl border-4 border-amber-500/20 bg-amber-500/5" />
          </div>

          <div className="relative font-[Rajdhani,Impact,sans-serif] font-bold text-[9rem] leading-none tracking-tighter">
            <span className="bg-gradient-to-b from-white/80 to-white/20 bg-clip-text text-transparent">4</span>
            <motion.span
              className="inline-block text-[#FF6200]"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              0
            </motion.span>
            <span className="bg-gradient-to-b from-white/80 to-white/20 bg-clip-text text-transparent">4</span>
          </div>
        </motion.div>

        {/* Sign post pole */}
        <div className="w-1 h-12 bg-white/10 mx-auto mb-8 rounded-full" />

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-white mb-3 font-[Rajdhani,sans-serif]">
            Road Not Found
          </h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Emergency features are always available.
          </p>
        </motion.div>

        {/* Quick links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6"
        >
          {QUICK_LINKS.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm font-medium ${color}`}
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </Link>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-white/20 text-xs font-mono"
        >
          Road Safety AI v21 · IIT Madras Hackathon 2026
        </motion.p>
      </div>
    </div>
  )
}
