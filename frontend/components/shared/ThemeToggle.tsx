'use client'

/**
 * components/shared/ThemeToggle.tsx
 * ════════════════════════════════════
 * Dark / Light mode toggle.
 * layout.tsx already sets className="dark" on <html>.
 * tailwind.config.ts has darkMode: 'class'.
 */

import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored) setDark(stored === 'dark')
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <motion.button
      onClick={() => setDark(d => !d)}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      className="p-2 rounded-xl glass border border-white/10 text-white/50 hover:text-white transition-colors"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      <motion.div
        key={dark ? 'moon' : 'sun'}
        initial={{ rotate: -30, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </motion.div>
    </motion.button>
  )
}
