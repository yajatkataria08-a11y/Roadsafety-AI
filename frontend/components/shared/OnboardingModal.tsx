'use client'

/**
 * components/shared/OnboardingModal.tsx — 4-step first-run onboarding  (v21)
 * ════════════════════════════════════════════════════════════════════════════
 * Shown once on first visit (localStorage key 'rs_onboarded' absent).
 * Swipeable left/right (touch delta > 60px). Fully keyboard accessible.
 * Sets 'rs_onboarded' on completion or skip.
 * Re-triggerable from Settings → "Take Tour".
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ArrowRight } from 'lucide-react'

const STEPS = [
  {
    emoji:  '🚨',
    title:  'Emergency SOS',
    desc1:  'Shake your phone or tap the red button to activate Crash Mode instantly.',
    desc2:  'Golden Hour protocol launches automatically — finding the nearest hospital in 3 seconds.',
    color:  'from-red-500/20 to-red-900/5',
    accent: '#ef4444',
  },
  {
    emoji:  '⚖️',
    title:  'Know Your Rights',
    desc1:  'Ask about any traffic fine across 7 BIMSTEC nations in your language.',
    desc2:  'Get the exact law section, vehicle-specific penalty, and how to pay or contest it.',
    color:  'from-blue-500/20 to-blue-900/5',
    accent: '#3b82f6',
  },
  {
    emoji:  '🗺️',
    title:  'Report Road Issues',
    desc1:  'Photograph a pothole, broken signal, or flooding and submit in one tap.',
    desc2:  'Your complaint is routed to the right authority with a trackable ticket ID and SLA timer.',
    color:  'from-[#FF6200]/20 to-orange-900/5',
    accent: '#FF6200',
  },
  {
    emoji:  '📡',
    title:  'Works Offline',
    desc1:  'Road Safety AI works without internet — no signal, no problem.',
    desc2:  'Violations database, emergency numbers, and AI classifier are all cached on your device.',
    color:  'from-emerald-500/20 to-emerald-900/5',
    accent: '#10b981',
  },
]

interface OnboardingModalProps {
  isOpen:  boolean
  onClose: () => void
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [step, setStep]   = useState(0)
  const touchStartX       = useRef<number | null>(null)
  const isLast            = step === STEPS.length - 1

  useEffect(() => { if (isOpen) setStep(0) }, [isOpen])

  const complete = useCallback(() => {
    try { localStorage.setItem('rs_onboarded', '1') } catch {}
    onClose()
  }, [onClose])

  const handleNext = () => isLast ? complete() : setStep(s => s + 1)
  const handlePrev = () => setStep(s => Math.max(0, s - 1))

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta < -60) handleNext()
    else if (delta > 60) handlePrev()
    touchStartX.current = null
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft')  handlePrev()
      if (e.key === 'Escape')     complete()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [isOpen, step]) // eslint-disable-line react-hooks/exhaustive-deps

  const cur = STEPS[step]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            aria-hidden="true"
          />
          <motion.div
            role="dialog" aria-modal="true"
            aria-label={`Onboarding step ${step + 1} of ${STEPS.length}: ${cur.title}`}
            className="fixed inset-x-4 top-1/2 z-[61] -translate-y-1/2 max-w-sm mx-auto"
            initial={{ opacity: 0, scale: 0.92, y: '-48%' }}
            animate={{ opacity: 1, scale: 1,    y: '-50%' }}
            exit={{ opacity: 0, scale: 0.92,    y: '-48%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          >
            <div className="bg-[#0a1628] border border-white/[0.10] rounded-3xl shadow-2xl overflow-hidden">
              <div className="flex justify-end px-5 pt-5">
                <button onClick={complete} aria-label="Skip onboarding"
                  className="text-white/35 text-sm hover:text-white/60 transition-colors flex items-center gap-1">
                  Skip <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={step}
                  className={`mx-5 rounded-2xl bg-gradient-to-br ${cur.color} border border-white/[0.06] h-44 flex items-center justify-center`}
                  initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.22 }}
                >
                  <span className="text-7xl" role="img" aria-label={cur.title}>{cur.emoji}</span>
                </motion.div>
              </AnimatePresence>

              <div className="px-6 pt-6 pb-4">
                <AnimatePresence mode="wait">
                  <motion.div key={step}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}>
                    <h2 className="text-white font-display text-2xl font-bold mb-3">{cur.title}</h2>
                    <p className="text-white/65 text-sm leading-relaxed mb-1">{cur.desc1}</p>
                    <p className="text-white/50 text-sm leading-relaxed">{cur.desc2}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex justify-center gap-2 pb-4">
                {STEPS.map((_, i) => (
                  <button key={i} onClick={() => setStep(i)} aria-label={`Go to step ${i + 1}`}>
                    <div className="rounded-full transition-all duration-200"
                      style={{ width: i === step ? 20 : 6, height: 6, background: i === step ? cur.accent : 'rgba(255,255,255,0.2)' }} />
                  </button>
                ))}
              </div>

              <div className="px-6 pb-6">
                <button onClick={handleNext}
                  aria-label={isLast ? 'Get started' : 'Next step'}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: cur.accent }}
                >
                  {isLast ? (<>Get Started <ArrowRight className="w-4 h-4" /></>) : (<>Next <ChevronRight className="w-4 h-4" /></>)}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
