'use client'

/**
 * components/challan/ChallanExplainerModal.tsx — AI Challan Explainer  (v21)
 * ════════════════════════════════════════════════════════════════════════════
 * Typewriter-streams a plain-language AI explanation of a challan fine.
 * POSTs to the existing /chat/ backend endpoint with a structured prompt.
 * 3 paragraph sections: why the law exists → consequences → how to contest.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Share2, Lightbulb, AlertTriangle, BookOpen, Gavel, CreditCard } from 'lucide-react'

const API_BASE    = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const TYPEWRITER_MS = 38

const SECTION_ICONS = [
  { Icon: BookOpen,   label: 'Why this law exists'            },
  { Icon: Gavel,      label: 'Consequences of non-payment'    },
  { Icon: CreditCard, label: 'How to contest or pay'          },
]

export interface ChallanExplainerModalProps {
  isOpen:      boolean
  onClose:     () => void
  violation:   string
  fine:        number
  currency:    string
  law_section: string
  country:     string
}

export function ChallanExplainerModal({
  isOpen, onClose, violation, fine, currency, law_section, country,
}: ChallanExplainerModalProps) {
  const [fullText,  setFullText]  = useState('')
  const [displayed, setDisplayed] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [copied,    setCopied]    = useState(false)
  const closeRef    = useRef<HTMLButtonElement>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const indexRef    = useRef(0)

  // ── Typewriter ──────────────────────────────────────────────────────────────
  const runTypewriter = useCallback((text: string) => {
    indexRef.current = 0
    setDisplayed('')
    const tick = () => {
      if (indexRef.current >= text.length) return
      const ch   = text[indexRef.current++]
      const next = text[indexRef.current]
      setDisplayed(prev => prev + ch)
      timerRef.current = setTimeout(tick, ch === '\n' && next === '\n' ? 8 : TYPEWRITER_MS)
    }
    tick()
  }, [])

  // ── Fetch explanation ───────────────────────────────────────────────────────
  const fetchExplanation = useCallback(async () => {
    if (!violation) return
    setIsLoading(true); setError(null); setFullText(''); setDisplayed('')
    const prompt = [
      `Explain in plain language: "${violation}" fine is ${fine} ${currency}`,
      `under ${law_section} in ${country}.`,
      `Answer in exactly 3 short paragraphs (no headers, no bullets):`,
      `1) Why does this law exist and what road safety problem does it solve?`,
      `2) What are the legal and practical consequences of not paying?`,
      `3) How can a citizen legally contest or pay it online?`,
      `Keep each paragraph to 2–3 sentences. Plain language, no jargon.`,
    ].join(' ')
    try {
      const res  = await fetch(`${API_BASE}/chat/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: prompt, country }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      const text: string = data.response ?? data.message ?? data.answer ?? ''
      setFullText(text)
      runTypewriter(text)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load explanation')
    } finally {
      setIsLoading(false)
    }
  }, [violation, fine, currency, law_section, country, runTypewriter])

  useEffect(() => {
    if (isOpen) {
      fetchExplanation()
      setTimeout(() => closeRef.current?.focus(), 120)
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      setDisplayed(''); setFullText(''); setError(null); setCopied(false)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [isOpen, onClose])

  const handleShare = async () => {
    const text = `${violation} — ${fine} ${currency}\n${law_section} (${country})\n\n${fullText || displayed}`
    if (navigator.share) {
      await navigator.share({ title: 'Challan Explanation', text })
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  const paragraphs = displayed.split(/\n\n+/).filter(Boolean)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} aria-hidden="true"
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Challan Explanation"
            className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 max-w-lg mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: '-48%' }}
            animate={{ opacity: 1, scale: 1,    y: '-50%' }}
            exit={  { opacity: 0, scale: 0.95, y: '-48%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="bg-[#0d1f3c] border border-white/[0.10] rounded-3xl shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-sm">Explain This Fine</h2>
                    <p className="text-white/40 text-xs truncate max-w-[200px]">{violation}</p>
                  </div>
                </div>
                <button ref={closeRef} onClick={onClose} aria-label="Close explanation"
                  className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </div>

              {/* Fine badge */}
              <div className="px-6 pt-4 pb-1 flex gap-3">
                <div className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-white/70 text-sm truncate">{violation}</span>
                  <span className="text-[#FF6200] font-bold text-sm ml-3 shrink-0">{currency}{fine.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <p className="px-6 pb-3 text-white/30 text-xs">{law_section} · {country}</p>

              {/* Body */}
              <div className="px-6 pb-4 min-h-[160px]">
                {isLoading && !displayed && (
                  <div className="space-y-3 animate-pulse">
                    {[1, 0.8, 0.65, 1, 0.75].map((w, i) => (
                      <div key={i} className="h-3 rounded bg-white/[0.08]" style={{ width: `${w * 100}%` }} />
                    ))}
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-red-300 text-sm font-medium">Could not load explanation</p>
                      <p className="text-red-400/70 text-xs mt-0.5">{error}</p>
                      <button onClick={fetchExplanation} className="mt-2 text-xs text-[#FF6200] hover:underline" aria-label="Retry">
                        Try again →
                      </button>
                    </div>
                  </div>
                )}

                {displayed && (
                  <div className="space-y-4">
                    {paragraphs.map((para, i) => (
                      <div key={i} className="flex gap-3">
                        {SECTION_ICONS[i] && (() => {
                          const { Icon } = SECTION_ICONS[i]
                          return (
                            <div className="mt-0.5 w-7 h-7 rounded-lg bg-[#FF6200]/10 border border-[#FF6200]/20 flex items-center justify-center shrink-0">
                              <Icon className="w-3.5 h-3.5 text-[#FF6200]" aria-hidden="true" />
                            </div>
                          )
                        })()}
                        <p className="text-white/80 text-sm leading-relaxed">
                          {para.trim()}
                          {i === paragraphs.length - 1 && displayed.length < fullText.length && (
                            <span className="inline-block w-0.5 h-3.5 bg-[#FF6200] ml-0.5 animate-pulse align-middle" />
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex gap-3">
                <button onClick={onClose} aria-label="Close"
                  className="flex-1 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/70 text-sm font-medium hover:bg-white/[0.10] transition-colors">
                  Close
                </button>
                <button onClick={handleShare} disabled={!displayed && !fullText} aria-label="Share explanation"
                  className="flex-1 py-3 rounded-xl bg-[#FF6200] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#e05600] transition-colors disabled:opacity-40">
                  <Share2 className="w-4 h-4" aria-hidden="true" />
                  {copied ? 'Copied!' : 'Share'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
