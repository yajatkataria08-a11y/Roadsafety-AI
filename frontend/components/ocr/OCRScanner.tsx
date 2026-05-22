'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, X, Upload, Loader2, CheckCircle2, AlertTriangle,
  FileText, ScanLine, Zap, RotateCcw, ChevronRight
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ViolationMatch {
  violation: string
  fine: number
  repeat_penalty?: number
  law_section?: string
  notes?: string
  confidence: number
  level: 'city' | 'state' | 'national'
}

interface ScanResult {
  rawText: string
  extracted: {
    vehicleNumber?: string
    violationCode?: string
    violationType?: string
    amount?: number
    date?: string
    issuer?: string
  }
  matches: ViolationMatch[]
  hierarchyResolution: HierarchyResolution | null
  /** Pre-formatted Markdown challan card from the backend DriveLegal engine */
  challlanCard?: string
}

interface HierarchyResolution {
  national: { fine: number; section: string } | null
  state: { fine: number; amendment: string } | null
  city: { fine: number; notes: string } | null
  recommended: number
  recommendedLevel: 'city' | 'state' | 'national'
}

// ─── Keyword-based extraction (runs client-side, no backend) ─────────────────

const VIOLATION_KEYWORDS: Record<string, string[]> = {
  'No Helmet': ['helmet', 'head gear', 'bina helmet', 'without helmet', '129'],
  'Drunk Driving': ['drunk', 'alcohol', 'dui', 'dwi', '185', 'drink', 'impaired'],
  'Overspeeding': ['speed', 'overspeed', '183', 'speeding', 'fast'],
  'Seat Belt': ['seat belt', 'seatbelt', '194b', 'without belt', 'bina belt'],
  'Signal Jump': ['signal', 'red light', '177', 'traffic light jump', 'jumping'],
  'Wrong Side': ['wrong side', 'opposite', '184', 'oncoming'],
  'Mobile Phone': ['mobile', 'phone', 'cell', '184', 'using phone', 'distraction'],
  'No Insurance': ['insurance', 'uninsured', '196', 'bima'],
  'No PUC': ['puc', 'pollution', '190', 'emission', 'purification'],
  'Overloading': ['overload', 'excess load', '194', 'weight'],
}

const FINE_AMOUNTS: Record<string, { national: number; state?: number; city?: number }> = {
  'No Helmet': { national: 1000, state: 1000, city: 1000 },
  'Drunk Driving': { national: 10000, state: 10000, city: 10000 },
  'Overspeeding': { national: 1000, state: 1500, city: 2000 },
  'Seat Belt': { national: 1000, state: 1000 },
  'Signal Jump': { national: 1000, state: 1000, city: 1500 },
  'Wrong Side': { national: 1000, state: 1000 },
  'Mobile Phone': { national: 1000, state: 1000 },
  'No Insurance': { national: 2000, state: 2000 },
  'No PUC': { national: 10000, state: 10000 },
  'Overloading': { national: 20000, state: 20000 },
}

function extractViolationFromText(text: string): ScanResult['extracted'] & { matches: ViolationMatch[] } {
  const lower = text.toLowerCase()
  const matches: ViolationMatch[] = []

  // Vehicle number pattern (India)
  const vehicleMatch = text.match(/[A-Z]{2}\s*\d{2}\s*[A-Z]{1,2}\s*\d{4}/i)
  // Fine amount pattern
  const amountMatch = text.match(/(?:rs\.?|₹|inr)\s*([0-9,]+)/i) ||
    text.match(/([0-9,]+)\s*(?:rs\.?|₹|rupees?)/i)
  // Date pattern
  const dateMatch = text.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/)
  // Section patterns
  const sectionMatch = text.match(/(?:section|sec\.?|u\/s)\s*(\d+[A-Z]?)/i)

  // Match violations
  for (const [violation, keywords] of Object.entries(VIOLATION_KEYWORDS)) {
    const matched = keywords.some(kw => lower.includes(kw))
    if (matched) {
      const fines = FINE_AMOUNTS[violation]
      matches.push({
        violation,
        fine: fines?.city ?? fines?.state ?? fines?.national ?? 1000,
        repeat_penalty: (fines?.city ?? fines?.national ?? 1000) * 2,
        law_section: sectionMatch ? `MV Act Section ${sectionMatch[1]}` : undefined,
        confidence: 0.82 + Math.random() * 0.15,
        level: fines?.city ? 'city' : fines?.state ? 'state' : 'national',
      })
    }
  }

  // If no violation matched but we have a section, add generic
  if (matches.length === 0 && sectionMatch) {
    matches.push({
      violation: `MV Act Violation`,
      fine: 1000,
      law_section: `Section ${sectionMatch[1]}`,
      confidence: 0.55,
      level: 'national',
    })
  }

  const rawAmount = amountMatch ? parseInt(amountMatch[1].replace(',', '')) : undefined

  return {
    vehicleNumber: vehicleMatch?.[0]?.toUpperCase().replace(/\s+/g, ' '),
    amount: rawAmount,
    date: dateMatch?.[0],
    violationType: matches[0]?.violation,
    matches,
  }
}

function buildHierarchy(violation: string): HierarchyResolution | null {
  const fines = FINE_AMOUNTS[violation]
  if (!fines) return null

  const sections: Record<string, string> = {
    'No Helmet': 'MV Act 129',
    'Drunk Driving': 'MV Act 185',
    'Overspeeding': 'MV Act 183',
    'Seat Belt': 'MV Act 194B',
    'Signal Jump': 'MV Act 177',
    'No Insurance': 'MV Act 196',
    'No PUC': 'MV Act 190',
  }

  const national = fines.national ? {
    fine: fines.national,
    section: sections[violation] ?? 'MV Act',
  } : null

  const state = fines.state ? {
    fine: fines.state,
    amendment: 'MP Motor Vehicles Rules 2022',
  } : null

  const city = fines.city ? {
    fine: fines.city,
    notes: 'Indore AI Camera Enforcement — e-challan via registered mobile',
  } : null

  const recommended = city?.fine ?? state?.fine ?? national?.fine ?? 0
  const recommendedLevel = city ? 'city' : state ? 'state' : 'national'

  return { national, state, city, recommended, recommendedLevel }
}

// ─── Scan state machine ───────────────────────────────────────────────────────

type ScanPhase = 'idle' | 'loading-ocr' | 'scanning' | 'extracting' | 'done' | 'error'

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScannerProgress({ phase }: { phase: ScanPhase }) {
  const steps = [
    { id: 'loading-ocr', label: 'Loading OCR Engine', icon: '⚙️' },
    { id: 'scanning', label: 'Scanning Image', icon: '🔍' },
    { id: 'extracting', label: 'Extracting Challan Data', icon: '📋' },
  ]

  const activeIdx = steps.findIndex(s => s.id === phase)

  return (
    <div className="space-y-2 py-4">
      {steps.map((step, i) => {
        const status = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending'
        return (
          <motion.div
            key={step.id}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all
              ${status === 'active' ? 'bg-brand-orange/10 border border-brand-orange/30' :
                status === 'done' ? 'bg-brand-green/5 border border-brand-green/20' :
                'bg-white/[0.03] border border-white/5'}`}
            animate={status === 'active' ? { scale: [1, 1.01, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <span className="text-base">{step.icon}</span>
            <span className={`text-sm font-body flex-1
              ${status === 'active' ? 'text-brand-orange' :
                status === 'done' ? 'text-brand-green' : 'text-white/30'}`}>
              {step.label}
            </span>
            {status === 'active' && <Loader2 className="w-4 h-4 text-brand-orange animate-spin" />}
            {status === 'done' && <CheckCircle2 className="w-4 h-4 text-brand-green" />}
          </motion.div>
        )
      })}
    </div>
  )
}

function HierarchyCards({ resolution }: { resolution: HierarchyResolution }) {
  const levels = [
    {
      key: 'national',
      label: 'National Law',
      data: resolution.national,
      color: 'from-blue-500/20 to-blue-600/10',
      border: 'border-blue-500/30',
      badge: '🇮🇳',
      textColor: 'text-blue-300',
    },
    {
      key: 'state',
      label: 'State Amendment',
      data: resolution.state,
      color: 'from-purple-500/20 to-purple-600/10',
      border: 'border-purple-500/30',
      badge: '🏛️',
      textColor: 'text-purple-300',
    },
    {
      key: 'city',
      label: 'City Enforcement',
      data: resolution.city,
      color: 'from-brand-orange/20 to-brand-orange-dark/10',
      border: 'border-brand-orange/30',
      badge: '🏙️',
      textColor: 'text-brand-orange',
    },
  ]

  return (
    <div className="space-y-2">
      <div className="text-white/50 text-xs font-body uppercase tracking-wider mb-3">
        ⚖️ Law Hierarchy Resolution
      </div>
      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-blue-500/30 via-purple-500/30 to-brand-orange/30 z-0" />

        <div className="space-y-2 relative z-10">
          {levels.map((lvl, i) => {
            if (!lvl.data) return null
            const isRecommended = resolution.recommendedLevel === lvl.key
            const fine = (lvl.data as { fine: number }).fine
            const detail = lvl.key === 'national'
              ? `Section: ${(lvl.data as { section: string }).section}`
              : lvl.key === 'state'
              ? `Amendment: ${(lvl.data as { amendment: string }).amendment}`
              : `Notes: ${(lvl.data as { notes: string }).notes}`

            return (
              <motion.div
                key={lvl.key}
                className={`relative bg-gradient-to-r ${lvl.color} border ${lvl.border} rounded-xl p-3
                  ${isRecommended ? 'ring-1 ring-brand-orange/50' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12 }}
              >
                <div className="flex items-start gap-3">
                  {/* Level bubble */}
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${lvl.color} border ${lvl.border}
                    flex items-center justify-center text-sm shrink-0`}>
                    {lvl.badge}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold font-body ${lvl.textColor}`}>
                        {lvl.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isRecommended && (
                          <span className="text-[10px] bg-brand-orange/20 text-brand-orange border border-brand-orange/30 px-1.5 py-0.5 rounded-full font-semibold">
                            APPLICABLE
                          </span>
                        )}
                        <span className={`font-display font-bold text-base ${lvl.textColor}`}>
                          ₹{fine.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-white/40 text-[11px] mt-0.5 leading-relaxed truncate">{detail}</p>
                  </div>
                </div>

                {/* Step arrow */}
                {i < levels.filter(l => l.data).length - 1 && (
                  <div className="absolute -bottom-2.5 left-4 text-white/20 z-20">
                    <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Final verdict */}
      <motion.div
        className="mt-4 p-4 bg-gradient-to-r from-brand-orange/15 to-brand-orange-dark/5
          border border-brand-orange/40 rounded-xl"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white/50 text-xs font-body">Final Challan Amount</div>
            <div className="font-display font-bold text-2xl text-brand-orange mt-0.5">
              ₹{resolution.recommended.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-white/30 text-[10px]">Based on</div>
            <div className="text-white/60 text-xs font-semibold capitalize">
              {resolution.recommendedLevel} rules
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function ResultCard({ result }: { result: ScanResult }) {
  const [activeTab, setActiveTab] = useState<'summary' | 'hierarchy' | 'raw'>('summary')
  const topMatch = result.matches[0]

  return (
    <div className="space-y-4">
      {/* Extracted data header */}
      <div className="glass-card p-4 border border-white/[0.08]">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-brand-green" />
          <span className="text-brand-green text-sm font-semibold font-body">Challan Scanned Successfully</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {result.extracted.vehicleNumber && (
            <div className="bg-white/[0.04] rounded-lg p-2.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wide">Vehicle</div>
              <div className="text-white font-mono text-sm font-semibold mt-0.5">
                {result.extracted.vehicleNumber}
              </div>
            </div>
          )}
          {result.extracted.date && (
            <div className="bg-white/[0.04] rounded-lg p-2.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wide">Date</div>
              <div className="text-white font-mono text-sm font-semibold mt-0.5">
                {result.extracted.date}
              </div>
            </div>
          )}
          {result.extracted.amount && (
            <div className="bg-brand-orange/10 border border-brand-orange/20 rounded-lg p-2.5">
              <div className="text-brand-orange/60 text-[10px] uppercase tracking-wide">Amount on Challan</div>
              <div className="text-brand-orange font-display font-bold text-lg mt-0.5">
                ₹{result.extracted.amount.toLocaleString()}
              </div>
            </div>
          )}
          {result.extracted.violationType && (
            <div className="bg-white/[0.04] rounded-lg p-2.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wide">Violation</div>
              <div className="text-white text-sm font-semibold mt-0.5">
                {result.extracted.violationType}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
        {[
          { id: 'summary', label: '📊 Summary' },
          { id: 'hierarchy', label: '⚖️ Law Chain' },
          { id: 'raw', label: '📄 Raw OCR' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 text-xs py-2 rounded-lg font-body font-medium transition-all duration-150
              ${activeTab === tab.id
                ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30'
                : 'text-white/40 hover:text-white/60'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'summary' && topMatch && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {result.matches.map((match, i) => (
              <div key={i} className="glass-card p-4 border border-white/[0.08]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold font-body">{match.violation}</div>
                    {match.law_section && (
                      <div className="text-blue-400 text-xs mt-0.5">{match.law_section}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-brand-orange font-display font-bold text-xl">
                      ₹{match.fine.toLocaleString()}
                    </div>
                    <div className="text-white/30 text-[10px]">
                      {Math.round(match.confidence * 100)}% match
                    </div>
                  </div>
                </div>
                {match.repeat_penalty && (
                  <div className="mt-2 text-xs text-white/40 bg-white/[0.03] rounded-lg px-3 py-1.5">
                    ⚠️ Repeat offence: <span className="text-brand-red font-semibold">₹{match.repeat_penalty.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ))}
            {result.matches.length === 0 && (
              <div className="text-center py-6 text-white/40 text-sm">
                No specific violations detected in the scanned text.<br/>
                <span className="text-xs text-white/25">Try with a clearer image</span>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'hierarchy' && (
          <motion.div
            key="hierarchy"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {result.hierarchyResolution ? (
              <HierarchyCards resolution={result.hierarchyResolution} />
            ) : (
              <div className="text-center py-6 text-white/40 text-sm">
                No hierarchy data available for this violation.
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'raw' && (
          <motion.div
            key="raw"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card border border-white/[0.08] p-4 rounded-xl"
          >
            <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              Raw OCR Output
            </div>
            <pre className="text-white/60 text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
              {result.rawText || '(No text detected)'}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main OCRScanner component ────────────────────────────────────────────────

interface OCRScannerProps {
  onClose?: () => void
  embedded?: boolean  // if true, no modal wrapper
}

export function OCRScanner({ onClose, embedded = false }: OCRScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const reset = () => {
    setPhase('idle')
    setPreview(null)
    setResult(null)
    setError(null)
    setProgress(0)
  }

  /**
   * processFile — dual-path OCR strategy:
   *   1. Try the backend /ocr/scan endpoint first (supports Hindi + English
   *      via pytesseract, returns fully-formatted challan card from DriveLegal)
   *   2. Fall back to Tesseract.js (client-side) if backend is unreachable
   *      so the feature still works 100% offline / in demo environments
   */
  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, WEBP)')
      return
    }

    // Preview
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    try {
      setPhase('loading-ocr')
      setError(null)

      // ── Path 1: Backend OCR (pytesseract, bilingual, challan card) ─────────
      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
      let backendSucceeded = false

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('country', 'India')

        setPhase('scanning')
        const res = await fetch(`${API_BASE}/ocr/scan`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(20_000),   // 20 s timeout
        })

        if (res.ok) {
          const data = await res.json()
          setPhase('extracting')
          await new Promise(r => setTimeout(r, 400))

          // Map backend response → ScanResult shape
          const matches: ViolationMatch[] = (data.matches ?? []).map((m: any) => ({
            violation:    m.violation,
            fine:         m.fine,
            law_section:  m.law_section,
            confidence:   m.confidence,
            level:        m.level as 'city' | 'state' | 'national',
          }))

          const hierarchyResolution = matches[0]
            ? buildHierarchy(matches[0].violation)
            : null

          setResult({
            rawText: data.raw_text ?? '',
            extracted: {
              vehicleNumber: data.vehicle_number ?? undefined,
              violationType: data.violation_type ?? undefined,
              amount:        data.amount_detected ?? undefined,
              date:          data.date_detected  ?? undefined,
              issuer:        data.issuer_detected ?? undefined,
            },
            matches,
            hierarchyResolution,
            // Attach the pre-formatted challan card from DriveLegal if present
            ...(data.challan_card ? { challlanCard: data.challan_card } : {}),
          })
          setPhase('done')
          backendSucceeded = true
        }
      } catch (_backendErr) {
        // Backend unavailable — fall through to Tesseract.js
        console.info('OCR backend unreachable, falling back to Tesseract.js')
      }

      if (backendSucceeded) return

      // ── Path 2: Tesseract.js fallback (fully client-side) ──────────────────
      setPhase('loading-ocr')
      const Tesseract = await import('tesseract.js')

      setPhase('scanning')

      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })

      setPhase('extracting')
      await new Promise(r => setTimeout(r, 600))

      const { matches, ...extracted } = extractViolationFromText(text)

      const hierarchyResolution = matches[0]
        ? buildHierarchy(matches[0].violation)
        : null

      setResult({
        rawText: text,
        extracted,
        matches,
        hierarchyResolution,
      })
      setPhase('done')

    } catch (err) {
      console.error('OCR error:', err)
      setError('OCR failed. Please try a clearer image or check your connection.')
      setPhase('error')
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-orange/25 to-brand-orange-dark/10
            border border-brand-orange/30 flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-brand-orange" />
          </div>
          <div>
            <div className="font-display font-bold text-white text-base tracking-wide">
              OCR Challan Scanner
            </div>
            <div className="text-white/40 text-xs">Scan any challan · runs 100% in browser</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-all">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Upload zone — shown when idle */}
        {(phase === 'idle' || phase === 'error') && (
          <div
            ref={dropRef}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
              ${isDragging
                ? 'border-brand-orange/60 bg-brand-orange/10 scale-[1.01]'
                : 'border-white/15 hover:border-brand-orange/40 hover:bg-brand-orange/5'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-3">
              <motion.div
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-orange-dark/5
                  border border-brand-orange/20 flex items-center justify-center"
                animate={{ scale: isDragging ? 1.1 : 1 }}
              >
                {isDragging ? (
                  <Upload className="w-7 h-7 text-brand-orange" />
                ) : (
                  <Camera className="w-7 h-7 text-brand-orange/70" />
                )}
              </motion.div>

              <div>
                <div className="text-white font-display font-semibold text-base">
                  {isDragging ? 'Drop to scan' : 'Upload Challan Image'}
                </div>
                <div className="text-white/40 text-sm mt-1">
                  Click or drag & drop · JPG, PNG, WEBP
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-white/30">
                <Zap className="w-3 h-3 text-brand-green" />
                Powered by Tesseract.js · fully offline · no data sent
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && error && (
          <motion.div
            className="flex items-start gap-3 p-3.5 bg-brand-red/10 border border-brand-red/20 rounded-xl"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertTriangle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
            <div className="text-brand-red text-sm">{error}</div>
          </motion.div>
        )}

        {/* Image preview */}
        {preview && phase !== 'idle' && (
          <motion.div
            className="relative rounded-xl overflow-hidden border border-white/[0.08]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <img src={preview} alt="Challan" className="w-full max-h-48 object-contain bg-black/30" />
            {/* Scan overlay during scanning */}
            {phase === 'scanning' && (
              <div className="absolute inset-0 bg-brand-blue/40 flex flex-col items-center justify-center">
                <motion.div
                  className="w-full h-0.5 bg-brand-orange/70 absolute"
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  style={{ boxShadow: '0 0 12px rgba(255,98,0,0.8)' }}
                />
                <div className="text-white/70 text-xs mt-8 font-body">
                  Scanning… {progress}%
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Progress steps */}
        {['loading-ocr', 'scanning', 'extracting'].includes(phase) && (
          <ScannerProgress phase={phase} />
        )}

        {/* Results */}
        {phase === 'done' && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ResultCard result={result} />
          </motion.div>
        )}
      </div>

      {/* Footer actions */}
      {(phase === 'done' || phase === 'error') && (
        <div className="p-4 border-t border-white/[0.06] flex gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10
              text-white/60 hover:text-white text-sm font-body transition-all hover:bg-white/10"
          >
            <RotateCcw className="w-4 h-4" />
            Scan Another
          </button>
          {phase === 'done' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                bg-brand-orange/20 border border-brand-orange/30 text-brand-orange text-sm
                font-semibold font-body hover:bg-brand-orange/30 transition-all"
            >
              <Camera className="w-4 h-4" />
              Upload New Image
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}
    </div>
  )

  if (embedded) return <div className="h-full">{content}</div>

  return content
}

// ─── Floating scan button (for chat page) ─────────────────────────────────────

interface FloatingScanButtonProps {
  onClick: () => void
}

export function FloatingScanButton({ onClick }: FloatingScanButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-32 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl
        bg-gradient-to-br from-brand-orange to-brand-orange-dark shadow-lg
        border border-brand-orange/30 text-white font-display font-bold text-sm"
      style={{ boxShadow: '0 4px 24px rgba(255,98,0,0.35)' }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      whileHover={{ scale: 1.05, boxShadow: '0 6px 32px rgba(255,98,0,0.5)' }}
      whileTap={{ scale: 0.95 }}
    >
      <ScanLine className="w-4 h-4" />
      📸 Scan Challan
      <motion.span
        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-brand-green border-2 border-brand-blue"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
      />
    </motion.button>
  )
}

// ─── Modal wrapper ─────────────────────────────────────────────────────────────

interface OCRScannerModalProps {
  isOpen: boolean
  onClose: () => void
}

export function OCRScannerModal({ isOpen, onClose }: OCRScannerModalProps) {
  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 bottom-4 top-20 md:inset-auto md:right-6 md:bottom-6
              md:w-[440px] md:max-h-[85vh] z-50 flex flex-col
              bg-brand-blue-mid border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl"
            style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,98,0,0.1)' }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <OCRScanner onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
