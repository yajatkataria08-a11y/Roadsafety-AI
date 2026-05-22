'use client'

/**
 * components/shared/CountryFlag.tsx
 * ══════════════════════════════════════════════════════════════════════
 * Inline SVG flags for all 7 BIMSTEC nations.
 *
 * WHY INLINE SVG:
 *  · Zero network requests — works 100% offline (PWA requirement)
 *  · No CORS issues, no broken-image fallbacks
 *  · Crisp at any DPI (retina, 4K, print)
 *  · Tiny — each flag is < 1 KB of SVG paths
 *
 * EXPORTS:
 *  <CountryFlag country="India" size={24} className="..." />
 *  <CountryFlagPicker value="India" onChange={setCountry} countries={BIMSTEC_COUNTRIES} />
 *
 * USAGE:
 *  import { CountryFlag, CountryFlagPicker, BIMSTEC_COUNTRIES } from '@/components/shared/CountryFlag'
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Country metadata ──────────────────────────────────────────────────────────

export type BIMSTECCountryName =
  | 'India' | 'Bangladesh' | 'Sri Lanka' | 'Nepal'
  | 'Thailand' | 'Myanmar' | 'Bhutan'

export interface CountryMeta {
  name:     BIMSTECCountryName
  code:     string           // ISO 3166-1 alpha-2
  currency: string
  dial:     string           // dialling prefix
  emergency: string          // primary emergency number
  ambulance: string
  police:    string
}

export const BIMSTEC_COUNTRIES: CountryMeta[] = [
  { name: 'India',      code: 'IN', currency: 'INR (₹)', dial: '+91',  emergency: '112', ambulance: '108', police: '100' },
  { name: 'Bangladesh', code: 'BD', currency: 'BDT (৳)',  dial: '+880', emergency: '999', ambulance: '199', police: '999' },
  { name: 'Sri Lanka',  code: 'LK', currency: 'LKR (₨)', dial: '+94',  emergency: '119', ambulance: '110', police: '118' },
  { name: 'Nepal',      code: 'NP', currency: 'NPR (₨)', dial: '+977', emergency: '100', ambulance: '102', police: '100' },
  { name: 'Thailand',   code: 'TH', currency: 'THB (฿)', dial: '+66',  emergency: '191', ambulance: '1669',police: '191' },
  { name: 'Myanmar',    code: 'MM', currency: 'MMK (K)', dial: '+95',  emergency: '199', ambulance: '192', police: '199' },
  { name: 'Bhutan',     code: 'BT', currency: 'BTN (Nu)',dial: '+975', emergency: '113', ambulance: '112', police: '113' },
]

// ══════════════════════════════════════════════════════════════════════════════
// SVG FLAG PATHS
// Each flag is a self-contained SVG drawn on a 36×24 viewport (3:2 ratio).
// Colours are taken from official Pantone / Wikipedia specifications.
// ══════════════════════════════════════════════════════════════════════════════

// ── India ─────────────────────────────────────────────────────────────────────
// Three equal horizontal bands: saffron / white / India green
// Ashoka Chakra (24-spoke wheel) in navy blue at centre
function FlagIndia({ size }: { size: number }) {
  const w = size * 1.5
  const h = size
  const cx = w / 2
  const cy = h / 2
  const r  = h * 0.28         // chakra radius
  const spokeR = r * 0.88

  // Generate 24 evenly-spaced spokes
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 360) / 24
    const rad = (angle * Math.PI) / 180
    const x2 = cx + Math.cos(rad) * spokeR
    const y2 = cy + Math.sin(rad) * spokeR
    return `M${cx},${cy} L${x2.toFixed(2)},${y2.toFixed(2)}`
  })

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" aria-label="India flag">
      {/* Bands */}
      <rect x={0} y={0}          width={w} height={h / 3}     fill="#FF9933" />
      <rect x={0} y={h / 3}      width={w} height={h / 3}     fill="#FFFFFF" />
      <rect x={0} y={(h / 3) * 2} width={w} height={h / 3}   fill="#138808" />
      {/* Chakra outer ring */}
      <circle cx={cx} cy={cy} r={r}  fill="none" stroke="#000080" strokeWidth={h * 0.025} />
      {/* Chakra hub */}
      <circle cx={cx} cy={cy} r={h * 0.03} fill="#000080" />
      {/* 24 spokes */}
      {spokes.map((d, i) => (
        <path key={i} d={d} stroke="#000080" strokeWidth={h * 0.018} />
      ))}
      {/* Rim dots between spokes at outer ring */}
      {Array.from({ length: 24 }, (_, i) => {
        const angle = ((i + 0.5) * 360) / 24
        const rad   = (angle * Math.PI) / 180
        const dx = cx + Math.cos(rad) * r
        const dy = cy + Math.sin(rad) * r
        return <circle key={`d${i}`} cx={dx.toFixed(2)} cy={dy.toFixed(2)} r={h * 0.012} fill="#000080" />
      })}
    </svg>
  )
}

// ── Bangladesh ────────────────────────────────────────────────────────────────
// Bottle-green field, red disc slightly left of centre
function FlagBangladesh({ size }: { size: number }) {
  const w = size * 1.5
  const h = size
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" aria-label="Bangladesh flag">
      <rect width={w} height={h} fill="#006A4E" />
      {/* Disc is offset ~5% to the left so it appears centred when flying */}
      <circle cx={w * 0.46} cy={h * 0.5} r={h * 0.30} fill="#F42A41" />
    </svg>
  )
}

// ── Sri Lanka ─────────────────────────────────────────────────────────────────
// Dark crimson / maroon field with golden lion + bo leaf corners
// Saffron and green vertical stripes on hoist
function FlagSriLanka({ size }: { size: number }) {
  const w = size * 1.5
  const h = size
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" aria-label="Sri Lanka flag">
      {/* Gold border */}
      <rect width={w} height={h} fill="#FFBE00" />
      {/* Saffron stripe */}
      <rect x={h * 0.07} y={h * 0.08} width={h * 0.18} height={h * 0.84} fill="#FF7300" />
      {/* Green stripe */}
      <rect x={h * 0.28} y={h * 0.08} width={h * 0.18} height={h * 0.84} fill="#006B3F" />
      {/* Maroon main field */}
      <rect x={h * 0.49} y={h * 0.08} width={w - h * 0.56} height={h * 0.84} fill="#8D153A" />
      {/* Simplified golden lion body */}
      <g fill="#FFBE00">
        {/* Body oval */}
        <ellipse cx={w * 0.73} cy={h * 0.52} rx={h * 0.18} ry={h * 0.14} />
        {/* Head */}
        <circle cx={w * 0.74} cy={h * 0.34} r={h * 0.1} />
        {/* Mane */}
        <circle cx={w * 0.74} cy={h * 0.34} r={h * 0.14} fill="none"
          stroke="#FFBE00" strokeWidth={h * 0.05} strokeDasharray={`${h * 0.06} ${h * 0.04}`} />
        {/* Tail */}
        <path d={`M${w*0.86},${h*0.5} Q${w*0.93},${h*0.3} ${w*0.88},${h*0.25}`}
          fill="none" stroke="#FFBE00" strokeWidth={h * 0.05} strokeLinecap="round" />
        {/* Front leg */}
        <rect x={w * 0.79} y={h * 0.57} width={h * 0.05} height={h * 0.2} rx={h*0.025} />
        {/* Sword (paw) */}
        <rect x={w * 0.78} y={h * 0.44} width={h * 0.11} height={h * 0.035} rx={h*0.015} />
        {/* Bo leaves at corners (simplified diamonds) */}
        {([[w*0.505,h*0.1],[w*0.505,h*0.85],[w*0.945,h*0.1],[w*0.945,h*0.85]] as [number,number][]).map(([bx,by],i)=>(
          <path key={i} d={`M${bx},${by-h*0.07} L${bx+h*0.045},${by} L${bx},${by+h*0.07} L${bx-h*0.045},${by} Z`} />
        ))}
      </g>
    </svg>
  )
}

// ── Nepal ─────────────────────────────────────────────────────────────────────
// Only non-rectangular national flag in the world — double pennant
// Top triangle: moon; bottom triangle (larger): sun
function FlagNepal({ size }: { size: number }) {
  const w  = size * 0.73    // Nepal flag is taller-than-wide: ~0.73:1 W:H
  const h  = size
  const bx = w * 0.12       // left edge of triangles (border inset)
  const midY = h * 0.40     // junction between two triangles

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" aria-label="Nepal flag">
      {/* White border shapes */}
      <polygon points={`${bx-2},2 ${w+2},${midY} ${bx-2},${midY}`} fill="white" />
      <polygon points={`${bx-2},${midY-2} ${w+2},${h+2} ${bx-2},${h+2}`} fill="white" />
      {/* Crimson upper pennant */}
      <polygon points={`${bx},4 ${w-2},${midY} ${bx},${midY}`} fill="#DC143C" />
      {/* Crimson lower pennant */}
      <polygon points={`${bx},${midY} ${w-2},${h-2} ${bx},${h-2}`} fill="#DC143C" />
      {/* White moon (upper) */}
      <g fill="white">
        <circle cx={w*0.27} cy={midY*0.42} r={h*0.065} />
        <circle cx={w*0.34} cy={midY*0.42} r={h*0.053} fill="#DC143C" />
        {/* Moon rays */}
        {Array.from({length:8},(_, i)=>{
          const a  = (i*45 - 90)*(Math.PI/180)
          const r1 = h*0.072, r2 = h*0.098
          const x1 = w*0.27 + Math.cos(a)*r1, y1 = midY*0.42 + Math.sin(a)*r1
          const x2 = w*0.27 + Math.cos(a)*r2, y2 = midY*0.42 + Math.sin(a)*r2
          return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="white" strokeWidth={h*0.02}/>
        })}
      </g>
      {/* White sun (lower) */}
      <g fill="white">
        {Array.from({length:12},(_, i)=>{
          const a  = (i*30)*(Math.PI/180)
          const r1 = h*0.08,  r2 = h*0.115
          const x1 = w*0.28 + Math.cos(a)*r1, y1 = h*0.73 + Math.sin(a)*r1
          const x2 = w*0.28 + Math.cos(a)*r2, y2 = h*0.73 + Math.sin(a)*r2
          return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="white" strokeWidth={h*0.022}/>
        })}
        <circle cx={w*0.28} cy={h*0.73} r={h*0.072} />
        <circle cx={w*0.28} cy={h*0.73} r={h*0.038} fill="#DC143C" />
      </g>
    </svg>
  )
}

// ── Thailand ──────────────────────────────────────────────────────────────────
// 5 horizontal stripes: red / white / navy blue (double) / white / red
// Ratio 2:1, stripe heights: 1/6 · 1/6 · 2/6 · 1/6 · 1/6
function FlagThailand({ size }: { size: number }) {
  const w = size * 1.5
  const h = size
  const unit = h / 6
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" aria-label="Thailand flag">
      <rect x={0} y={0}          width={w} height={unit}     fill="#A51931" />
      <rect x={0} y={unit}       width={w} height={unit}     fill="#F4F5F8" />
      <rect x={0} y={unit * 2}   width={w} height={unit * 2} fill="#2D2A4A" />
      <rect x={0} y={unit * 4}   width={w} height={unit}     fill="#F4F5F8" />
      <rect x={0} y={unit * 5}   width={w} height={unit}     fill="#A51931" />
    </svg>
  )
}

// ── Myanmar ───────────────────────────────────────────────────────────────────
// Three equal horizontal stripes: yellow / green / red
// Large white 5-pointed star at centre
function FlagMyanmar({ size }: { size: number }) {
  const w  = size * 1.5
  const h  = size
  const cx = w / 2
  const cy = h / 2

  // 5-pointed star path centred at (cx, cy) with outer radius r
  function starPath(r: number, cx: number, cy: number) {
    const pts: string[] = []
    for (let i = 0; i < 10; i++) {
      const angle = (i * 36 - 90) * (Math.PI / 180)
      const radius = i % 2 === 0 ? r : r * 0.4
      pts.push(`${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`)
    }
    return `M${pts.join('L')}Z`
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" aria-label="Myanmar flag">
      <rect x={0} y={0}          width={w} height={h / 3}     fill="#FECB00" />
      <rect x={0} y={h / 3}      width={w} height={h / 3}     fill="#34B233" />
      <rect x={0} y={(h / 3) * 2} width={w} height={h / 3}   fill="#EA2839" />
      <path d={starPath(h * 0.36, cx, cy)} fill="white" />
    </svg>
  )
}

// ── Bhutan ────────────────────────────────────────────────────────────────────
// Diagonal split: upper-left saffron / lower-right scarlet
// White Druk (Thunder Dragon) across the diagonal
function FlagBhutan({ size }: { size: number }) {
  const w = size * 1.5
  const h = size
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" aria-label="Bhutan flag">
      {/* Diagonal split via two triangles */}
      <polygon points={`0,0 ${w},0 ${w},${h}`}  fill="#FF8000" />   {/* Saffron */}
      <polygon points={`0,0 0,${h} ${w},${h}`}  fill="#B22222" />   {/* Scarlet */}

      {/* Simplified Druk dragon — stylised, recognisable at small sizes */}
      {/* Body: sinuous curve from lower-left to upper-right */}
      <g fill="white" stroke="white">
        {/* Main body segments */}
        <ellipse cx={w*0.38} cy={h*0.62} rx={w*0.13} ry={h*0.10} transform={`rotate(-38,${w*0.38},${h*0.62})`} />
        <ellipse cx={w*0.50} cy={h*0.50} rx={w*0.12} ry={h*0.09} transform={`rotate(-38,${w*0.50},${h*0.50})`} />
        <ellipse cx={w*0.62} cy={h*0.38} rx={w*0.11} ry={h*0.08} transform={`rotate(-38,${w*0.62},${h*0.38})`} />

        {/* Head — upper-right area */}
        <ellipse cx={w*0.73} cy={h*0.27} rx={w*0.095} ry={h*0.082} transform={`rotate(-20,${w*0.73},${h*0.27})`} />

        {/* Snout */}
        <ellipse cx={w*0.80} cy={h*0.21} rx={w*0.055} ry={h*0.042} transform={`rotate(-20,${w*0.80},${h*0.21})`} />

        {/* Eye */}
        <circle cx={w*0.755} cy={h*0.215} r={h*0.028} fill="#FF8000" />

        {/* Jewel / norbu it holds */}
        <circle cx={w*0.84} cy={h*0.16} r={h*0.055} fill="none" stroke="white" strokeWidth={h*0.025} />
        <circle cx={w*0.84} cy={h*0.16} r={h*0.022} />

        {/* Front claws */}
        {[[-0.03,0.09],[0.02,0.11],[0.07,0.10]].map(([dx,dy],i)=>(
          <ellipse key={i} cx={w*(0.47+dx)} cy={h*(0.62+dy)} rx={w*0.02} ry={h*0.045}
            transform={`rotate(${-50+i*15},${w*(0.47+dx)},${h*(0.62+dy)})`} />
        ))}

        {/* Rear claws */}
        {[[-0.04,0.07],[0.01,0.09],[0.06,0.08]].map(([dx,dy],i)=>(
          <ellipse key={i} cx={w*(0.31+dx)} cy={h*(0.70+dy)} rx={w*0.018} ry={h*0.038}
            transform={`rotate(${-50+i*15},${w*(0.31+dx)},${h*(0.70+dy)})`} />
        ))}

        {/* Tail curling down-left */}
        <path d={`M${w*0.28},${h*0.74} Q${w*0.18},${h*0.82} ${w*0.22},${h*0.90}`}
          fill="none" stroke="white" strokeWidth={h*0.06} strokeLinecap="round" />
        <path d={`M${w*0.22},${h*0.90} Q${w*0.15},${h*0.95} ${w*0.20},${h*0.98}`}
          fill="none" stroke="white" strokeWidth={h*0.035} strokeLinecap="round" />
      </g>
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

const FLAG_MAP: Record<BIMSTECCountryName, React.FC<{ size: number }>> = {
  India:      FlagIndia,
  Bangladesh: FlagBangladesh,
  'Sri Lanka': FlagSriLanka,
  Nepal:      FlagNepal,
  Thailand:   FlagThailand,
  Myanmar:    FlagMyanmar,
  Bhutan:     FlagBhutan,
}

// ── <CountryFlag /> ───────────────────────────────────────────────────────────

interface CountryFlagProps {
  /** Country name (must match BIMSTECCountryName union) */
  country:    BIMSTECCountryName | string
  /** Height in pixels (width auto-adjusts to preserve ratio) */
  size?:      number
  className?: string
  /** Show tooltip on hover */
  tooltip?:   boolean
  /** Show country name label beside flag */
  showName?:  boolean
  /** Name size class */
  nameClass?: string
}

export function CountryFlag({
  country,
  size      = 24,
  className = '',
  tooltip   = false,
  showName  = false,
  nameClass = 'text-sm text-white/80',
}: CountryFlagProps) {
  const FlagComponent = FLAG_MAP[country as BIMSTECCountryName]

  if (!FlagComponent) {
    // Graceful fallback for unknown countries
    return (
      <span
        className={`inline-flex items-center justify-center rounded text-xs font-bold bg-white/10 text-white/40 ${className}`}
        style={{ width: size * 1.5, height: size }}
        title={country}
      >
        {String(country).slice(0, 2).toUpperCase()}
      </span>
    )
  }

  const flag = (
    <span
      className={`inline-flex items-center shrink-0 overflow-hidden rounded-[2px] shadow-sm ${className}`}
      style={{ lineHeight: 0 }}
      title={tooltip ? country : undefined}
      aria-label={`${country} flag`}
    >
      <FlagComponent size={size} />
    </span>
  )

  if (!showName) return flag

  return (
    <span className="inline-flex items-center gap-2">
      {flag}
      <span className={nameClass}>{country}</span>
    </span>
  )
}

// ── <CountryFlagPicker /> ─────────────────────────────────────────────────────
//
// Replaces <select> dropdowns everywhere. Tap a flag pill to select.
// Selected state shows flag + name. Unselected shows flag + tooltip only.

interface CountryFlagPickerProps {
  /** Currently selected country name */
  value:     BIMSTECCountryName | string
  /** Called with the new country name */
  onChange:  (country: BIMSTECCountryName) => void
  /** Which countries to show — defaults to all 7 BIMSTEC */
  countries?: CountryMeta[]
  /** Size of each flag */
  flagSize?:  number
  /** Extra wrapper className */
  className?: string
  /** Show currency tag inside selected pill */
  showCurrency?: boolean
  /** Label above the picker */
  label?:    string
  /** Layout direction */
  layout?:   'grid' | 'wrap'
}

export function CountryFlagPicker({
  value,
  onChange,
  countries    = BIMSTEC_COUNTRIES,
  flagSize     = 22,
  className    = '',
  showCurrency = false,
  label,
  layout       = 'grid',
}: CountryFlagPickerProps) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)

  return (
    <div className={className}>
      {label && (
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2.5">
          {label}
        </p>
      )}

      <div
        className={
          layout === 'grid'
            ? 'grid grid-cols-4 sm:grid-cols-7 gap-1.5'
            : 'flex flex-wrap gap-1.5'
        }
      >
        {countries.map((c) => {
          const isSelected = c.name === value
          const isHovered  = hoveredCode === c.code

          return (
            <div key={c.code} className="relative">
              <motion.button
                onClick={() => onChange(c.name as BIMSTECCountryName)}
                onMouseEnter={() => setHoveredCode(c.code)}
                onMouseLeave={() => setHoveredCode(null)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className={`
                  relative flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border
                  w-full transition-colors duration-150
                  ${isSelected
                    ? 'bg-[#FF6200]/15 border-[#FF6200]/50 shadow-[0_0_12px_rgba(255,98,0,0.2)]'
                    : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/[0.15]'
                  }
                `}
                aria-pressed={isSelected}
                aria-label={`Select ${c.name}`}
              >
                {/* Flag */}
                <span className="rounded-[2px] overflow-hidden shadow-sm" style={{ lineHeight: 0 }}>
                  {FLAG_MAP[c.name as BIMSTECCountryName]?.({ size: flagSize })}
                </span>

                {/* Country name — always visible */}
                <span
                  className={`text-[10px] font-medium truncate w-full text-center leading-tight transition-colors ${
                    isSelected ? 'text-white' : 'text-white/45'
                  }`}
                >
                  {c.name === 'Sri Lanka' ? 'Sri Lanka' : c.name.split(' ')[0]}
                </span>

                {/* Currency tag — only on selected */}
                <AnimatePresence>
                  {isSelected && showCurrency && (
                    <motion.span
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[9px] text-[#FF6200]/80 font-mono leading-none"
                    >
                      {c.currency}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Selected ring animation */}
                {isSelected && (
                  <motion.span
                    layoutId="flag-selected-ring"
                    className="absolute inset-0 rounded-xl border-2 border-[#FF6200]/60 pointer-events-none"
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />
                )}
              </motion.button>

              {/* Tooltip — shown on hover for unselected */}
              <AnimatePresence>
                {isHovered && !isSelected && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.92 }}
                    transition={{ duration: 0.12 }}
                    className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2
                      bg-[#1C2A45] border border-white/15 rounded-lg px-2.5 py-1.5
                      pointer-events-none whitespace-nowrap shadow-xl"
                  >
                    <p className="text-white/90 text-xs font-semibold">{c.name}</p>
                    <p className="text-white/40 text-[10px]">
                      {c.currency} · {c.dial} · 🚨 {c.emergency}
                    </p>
                    {/* Arrow */}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1C2A45]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Convenience: compact inline flag+name for jurisdiction labels ─────────────

export function FlagChip({
  country,
  size = 16,
  className = '',
}: {
  country: BIMSTECCountryName | string
  size?:   number
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
        bg-white/[0.06] border border-white/[0.09] text-white/70 text-xs font-medium ${className}`}
    >
      <CountryFlag country={country} size={size} />
      <span>{country}</span>
    </span>
  )
}
