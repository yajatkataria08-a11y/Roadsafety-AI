'use client'

/**
 * /challan — Dedicated Smart Challan Calculator Page
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone UI so judges can discover the challan engine without having to
 * navigate the chat. Features:
 *   • Violation selector with autocomplete (from GET /challan/violations)
 *   • Country picker — all 7 BIMSTEC nations
 *   • State / city refinement for highest-precision fine
 *   • Vehicle type + repeat offence toggle
 *   • Live challan card rendered from POST /challan
 *   • Law hierarchy breakdown via HierarchyResolutionCard
 *   • Payment portal deep-links (from GET /challan/countries)
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calculator, ChevronDown, Lightbulb, Globe2, Car, RefreshCcw,
  AlertTriangle, CheckCircle2, Loader2, ExternalLink,
  Scale, Info, Search, ScanLine,
} from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/shared/Navbar'
import { ChallanExplainerModal } from '@/components/challan/ChallanExplainerModal'
import { addChallanRecord } from '@/lib/db'
import {
  CountryFlag,
  CountryFlagPicker,
  BIMSTEC_COUNTRIES,
  type BIMSTECCountryName,
} from '@/components/shared/CountryFlag'

const VEHICLE_TYPES = [
  { value: 'all',          label: 'All Vehicles' },
  { value: 'two_wheeler',  label: '2-Wheeler (Bike/Scooter)' },
  { value: 'lmv',          label: 'Light Motor Vehicle (Car/SUV)' },
  { value: 'hmv',          label: 'Heavy Motor Vehicle (Truck)' },
  { value: 'bus',          label: 'Bus / Maxi-cab' },
  { value: 'auto',         label: 'Auto Rickshaw / E-Rickshaw' },
]

const COMMON_VIOLATIONS = [
  'No Helmet', 'No Seat Belt', 'Drunk Driving', 'Overspeeding',
  'Signal Jumping', 'Wrong Side Driving', 'Mobile Phone Use',
  'No Insurance', 'No PUC Certificate', 'Overloading',
  'No Driving Licence', 'Rash Driving',
]

// ── API helpers ───────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function fetchViolations(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/challan/violations`)
    if (!res.ok) throw new Error()
    const data = await res.json()
    return data.violations ?? COMMON_VIOLATIONS
  } catch {
    return COMMON_VIOLATIONS
  }
}

async function fetchCountryPortals(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${API_BASE}/challan/countries`)
    if (!res.ok) throw new Error()
    const data = await res.json()
    const map: Record<string, string> = {}
    for (const c of data.countries ?? []) {
      map[c.name] = c.portal
    }
    return map
  } catch {
    return {
      India:      'https://echallan.parivahan.gov.in/',
      Bangladesh: 'https://brta.gov.bd/',
      'Sri Lanka':'https://www.motortraffic.gov.lk/',
      Nepal:      'https://dotm.gov.np/',
      Thailand:   'https://www.dlt.go.th/',
      Myanmar:    'https://www.mot.gov.mm/',
      Bhutan:     'https://www.rsta.gov.bt/',
    }
  }
}

interface ChallanResult {
  challan: string
  violation_input: string
  location: string
  vehicle_type: string
}

async function generateChallan(params: {
  violation: string
  country: string
  state?: string
  city?: string
  vehicle_type: string
  is_repeat: boolean
  repeat_count: number
}): Promise<ChallanResult> {
  const res = await fetch(`${API_BASE}/challan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Markdown → HTML (minimal, for challan card) ───────────────────────────────

function renderMarkdown(md: string): string {
  return md
    .replace(/^#{1,3} (.+)$/gm, '<h3 class="text-white font-bold text-base mt-3 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="text-brand-orange bg-white/5 px-1 rounded text-xs">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand-orange underline underline-offset-2">$1 ↗</a>')
    .replace(/^• (.+)$/gm, '<li class="ml-3 text-white/80 text-sm list-disc">$1</li>')
    .replace(/^─+$/gm, '<hr class="border-white/10 my-2"/>')
    .replace(/\n\n/g, '</p><p class="text-white/70 text-sm mb-1">')
    .replace(/\n/g, '<br/>')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChallanPage() {
  // Form state
  const [violation,   setViolation]   = useState('')
  const [country,     setCountry]     = useState('India')
  const [state,       setState]       = useState('')
  const [city,        setCity]        = useState('')
  const [vehicleType, setVehicleType] = useState('all')
  const [isRepeat,    setIsRepeat]    = useState(false)
  const [repeatCount, setRepeatCount] = useState(1)

  // UI state
  const [violations,    setViolations]    = useState<string[]>(COMMON_VIOLATIONS)
  const [portals,       setPortals]       = useState<Record<string, string>>({})
  const [searchQuery,   setSearchQuery]   = useState('')
  const [showDropdown,  setShowDropdown]  = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [result,        setResult]        = useState<ChallanResult | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [showExplainer, setShowExplainer] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch violation list + portals on mount
  useEffect(() => {
    fetchViolations().then(setViolations)
    fetchCountryPortals().then(setPortals)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredViolations = violations.filter(v =>
    v.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedCountry = BIMSTEC_COUNTRIES.find(c => c.name === country)

  const handleSubmit = async () => {
    if (!violation.trim()) {
      setError('Please select or enter a violation type.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await generateChallan({
        violation,
        country,
        state:        state || undefined,
        city:         city  || undefined,
        vehicle_type: vehicleType,
        is_repeat:    isRepeat,
        repeat_count: isRepeat ? Math.max(2, repeatCount) : 1,
      })
      setResult(data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate challan. Check the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setViolation('')
    setSearchQuery('')
    setResult(null)
    setError(null)
    setIsRepeat(false)
    setRepeatCount(1)
  }

  const portalUrl = portals[country] ?? '#'

  return (
    <div className="flex flex-col min-h-screen bg-brand-blue overflow-x-hidden">
      <Navbar />

      {/* Subtle road-stripe background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent, transparent 48px, rgba(255,255,255,0.5) 48px, rgba(255,255,255,0.5) 50px)',
        }}
      />

      <div className="flex-1 pt-20 pb-14 px-4 max-w-3xl mx-auto w-full">

        {/* ── Page header ── */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-brand-orange/10 border border-brand-orange/20 text-brand-orange text-xs font-semibold mb-4">
            <Scale className="w-3.5 h-3.5" />
            SMART CHALLAN CALCULATOR
          </div>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-white">
            🧾 Calculate Your Fine
          </h1>
          <p className="text-white/50 text-base mt-2 max-w-xl mx-auto font-body">
            Geo-fenced fine lookup across all 7 BIMSTEC nations.
            City-level → State amendment → National MV Act hierarchy.
          </p>

          {/* Quick OCR link */}
          <div className="mt-3">
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-brand-orange transition-colors"
            >
              <ScanLine className="w-3.5 h-3.5" />
              Have a challan photo? Use the OCR Scanner instead
            </Link>
          </div>
        </motion.div>

        {/* ── Main card ── */}
        <motion.div
          className="bg-brand-blue-mid border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,98,0,0.06)' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >

          {/* Form section */}
          <div className="p-6 space-y-5">

            {/* Violation picker */}
            <div>
              <label className="block text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
                Violation Type *
              </label>
              <div className="relative" ref={dropdownRef}>
                <div
                  onClick={() => setShowDropdown(v => !v)}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-xl
                    bg-white/[0.04] border border-white/[0.1] cursor-pointer
                    hover:border-white/20 transition-colors"
                >
                  <Calculator className="w-4 h-4 text-brand-orange shrink-0" />
                  <span className={`flex-1 text-sm font-body ${violation ? 'text-white' : 'text-white/30'}`}>
                    {violation || 'Select a violation…'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </div>

                <AnimatePresence>
                  {showDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute z-30 top-full mt-1 w-full rounded-xl
                        bg-[#1a2035] border border-white/[0.1] shadow-2xl overflow-hidden"
                    >
                      {/* Search inside dropdown */}
                      <div className="p-2 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04]">
                          <Search className="w-3.5 h-3.5 text-white/30" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search violations…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/25 font-body"
                          />
                        </div>
                      </div>
                      <ul className="max-h-52 overflow-y-auto py-1">
                        {filteredViolations.length === 0 ? (
                          <li className="px-4 py-3 text-white/30 text-sm font-body">No matches</li>
                        ) : filteredViolations.map(v => (
                          <li
                            key={v}
                            onClick={() => { setViolation(v); setShowDropdown(false); setSearchQuery('') }}
                            className="px-4 py-2.5 text-sm text-white/80 hover:bg-brand-orange/10
                              hover:text-white cursor-pointer transition-colors font-body"
                          >
                            {v}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Country + currency — SVG flag pill picker */}
            <div>
              <CountryFlagPicker
                label="Country (BIMSTEC)"
                value={country}
                onChange={(c) => setCountry(c as string)}
                flagSize={22}
                showCurrency
                layout="grid"
              />
            </div>

            {/* State + City row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
                  State / Province
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1]
                    text-white text-sm placeholder-white/25 outline-none font-body
                    focus:border-brand-orange/40 transition-colors"
                />
              </div>
              <div>
                <label className="block text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1]
                    text-white text-sm placeholder-white/25 outline-none font-body
                    focus:border-brand-orange/40 transition-colors"
                />
              </div>
            </div>

            {/* Vehicle type */}
            <div>
              <label className="block text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
                Vehicle Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {VEHICLE_TYPES.map(vt => (
                  <button
                    key={vt.value}
                    onClick={() => setVehicleType(vt.value)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-body text-left transition-all ${
                      vehicleType === vt.value
                        ? 'bg-brand-orange/15 border-brand-orange/50 text-white'
                        : 'bg-white/[0.03] border-white/[0.07] text-white/50 hover:border-white/20 hover:text-white/80'
                    }`}
                  >
                    <Car className="w-3.5 h-3.5 mb-1 text-brand-orange/70" />
                    {vt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Repeat offence */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div>
                <p className="text-white text-sm font-semibold font-body">Repeat Offence?</p>
                <p className="text-white/40 text-xs font-body mt-0.5">
                  Second+ offence attracts doubled fine under MV Act 2019
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isRepeat && (
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={repeatCount}
                    onChange={e => setRepeatCount(Number(e.target.value))}
                    className="w-14 px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1]
                      text-white text-sm text-center outline-none font-body focus:border-brand-orange/40"
                  />
                )}
                <button
                  onClick={() => setIsRepeat(v => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isRepeat ? 'bg-brand-orange' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      isRepeat ? 'left-[26px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-300 text-sm font-body">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit row */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl
                  bg-brand-orange text-white font-bold text-sm font-body
                  hover:bg-brand-orange-dark active:scale-[0.98] transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-orange/25"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Calculating…</>
                ) : (
                  <><Scale className="w-4 h-4" /> Calculate Fine</>
                )}
              </button>
              {result && (
                <button
                  onClick={handleReset}
                  className="px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.1]
                    text-white/60 hover:text-white hover:border-white/20 transition-colors"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ── Result card ── */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-white/[0.06]"
              >
                <div className="p-6 space-y-4">
                  {/* Success badge */}
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <span className="text-white font-semibold text-sm font-body">
                      Challan breakdown for{' '}
                      <span className="text-brand-orange">{result.violation_input}</span>
                      {result.location && (
                        <> — <span className="text-white/60">{result.location}</span></>
                      )}
                    </span>
                  </div>

                  {/* Markdown challan card */}
                  <div
                    className="prose-sm prose-invert max-w-none text-sm text-white/75 font-body
                      bg-white/[0.02] rounded-xl p-4 border border-white/[0.06] overflow-auto"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(result.challan) }}
                  />

                  {/* Pay portal button */}
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 rounded-xl
                      bg-brand-orange/10 border border-brand-orange/25
                      hover:bg-brand-orange/15 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Globe2 className="w-4 h-4 text-brand-orange" />
                      <span className="text-brand-orange text-sm font-semibold font-body flex items-center gap-1.5">
                        Pay Challan Online —&nbsp;
                        <CountryFlag country={country} size={14} />
                        {country}
                      </span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-brand-orange/60 group-hover:text-brand-orange transition-colors" />
                  </a>

                  {/* v21: Explain This Fine */}
              <button
                onClick={() => setShowExplainer(true)}
                aria-label="Open AI explanation of this fine"
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] text-amber-400 text-sm font-semibold hover:bg-amber-500/[0.15] transition-colors active:scale-95"
              >
                <Lightbulb className="w-4 h-4" aria-hidden="true" />
                💡 Explain This Fine
              </button>

              {/* Info note */}
                  <div className="flex items-start gap-2 text-white/30 text-xs font-body">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Fine amounts follow the Motor Vehicles (Amendment) Act, 2019 hierarchy:
                    City enforcement → State amendment → National baseline.
                    Repeat offences attract double fines.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Bottom cross-links ── */}
        <motion.div
          className="mt-6 grid grid-cols-2 gap-3 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Link
            href="/scan"
            className="flex items-center gap-2 px-4 py-3 rounded-xl
              bg-white/[0.03] border border-white/[0.07] text-white/50
              hover:border-white/15 hover:text-white/80 transition-colors font-body"
          >
            <ScanLine className="w-4 h-4 text-brand-orange" />
            OCR Challan Scanner
          </Link>
          <Link
            href="/chat"
            className="flex items-center gap-2 px-4 py-3 rounded-xl
              bg-white/[0.03] border border-white/[0.07] text-white/50
              hover:border-white/15 hover:text-white/80 transition-colors font-body"
          >
            <Calculator className="w-4 h-4 text-brand-orange" />
            Ask via Chat (DriveLegal)
          </Link>
        </motion.div>
      </div>
    </div>
      {result && (
        <ChallanExplainerModal
          isOpen={showExplainer}
          onClose={() => setShowExplainer(false)}
          violation={result.violation_input ?? ''}
          fine={result.total_fine ?? result.base_fine ?? 0}
          currency={result.currency ?? '₹'}
          law_section={result.law_section ?? ''}
          country={country}
        />
      )}
    </div>
  )
}
