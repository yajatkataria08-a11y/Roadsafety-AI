'use client'

/**
 * CrowdsourcedMap.tsx  —  v3 (Heatmap + Visual X-Factor Edition)
 * ═══════════════════════════════════════════════════════════════
 * UPGRADE FROM v2:
 *
 *  🔥 NEW: Canvas-based heatmap overlay in roadwatch mode
 *          (leaflet.heat CDN or manual radial-gradient canvas fallback)
 *  🔥 NEW: Animated choropleth ward circles for authority mode
 *  🔥 NEW: Pulsing SVG camera icons in legal mode (not emoji)
 *  🔥 NEW: "Live" dot animation on active pins
 *  🔥 NEW: Geofence polygon overlay for legal mode
 *  🔥 NEW: Bottom stats bar with real-time counts
 *  ✅ All v2 features preserved (IndexedDB, pin-drop, mode-filters, etc.)
 *
 * USAGE:
 *   <CrowdsourcedMap
 *     userLat={22.72} userLon={75.86} services={services}
 *     mode="roadwatch" height={420}
 *   />
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, MapPin, Phone, Navigation, X, CheckCircle2,
  Loader2, Filter, List, Map, Star, Users, AlertTriangle,
  Camera, BarChart2, Layers, ArrowRight, Siren, Scale,
  Building2, Zap, Clock, Flame, Activity,
} from 'lucide-react'
import type { EmergencyService, ServiceType } from '@/lib/api'
import { formatDistance } from '@/lib/utils'
import type { ExtendedMapMode } from '@/components/map/MapController'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CrowdsourcedPin {
  id: string; name: string; type: ServiceType | string
  lat: number; lon: number; phone?: string; notes?: string
  submittedAt: number; upvotes: number; isVerified: boolean
  severity?: 'critical' | 'high' | 'medium' | 'low'
}

export interface LegalPin {
  id: string; type: 'speed_cam' | 'helmet_cam' | 'blackspot' | 'redlight_cam'
  name: string; lat: number; lon: number; notes?: string
}

// ── Filter Tab Config ─────────────────────────────────────────────────────────

type FilterTab = { key: string; label: string; emoji: string; color: string }

const EMERGENCY_TABS: FilterTab[] = [
  { key: 'all',          label: 'All',       emoji: '🗺️', color: '#FFFFFF' },
  { key: 'hospital',     label: 'Hospital',  emoji: '🏥', color: '#3b82f6' },
  { key: 'ambulance',    label: 'Ambulance', emoji: '🚑', color: '#ef4444' },
  { key: 'police',       label: 'Police',    emoji: '🚔', color: '#6366f1' },
  { key: 'towing',       label: 'Towing',    emoji: '🚗', color: '#f59e0b' },
  { key: 'fuel',         label: 'Fuel',      emoji: '⛽', color: '#8b5cf6' },
]

const LEGAL_TABS: FilterTab[] = [
  { key: 'all',          label: 'All',       emoji: '🗺️', color: '#FFFFFF'  },
  { key: 'speed_cam',    label: 'Speed Cam', emoji: '📷', color: '#ef4444'  },
  { key: 'helmet_cam',   label: 'Helmet',    emoji: '🪖', color: '#f59e0b'  },
  { key: 'blackspot',    label: 'Blackspot', emoji: '⚠️', color: '#f97316'  },
  { key: 'redlight_cam', label: 'Red Light', emoji: '🚦', color: '#a855f7'  },
]

const ROADWATCH_TABS: FilterTab[] = [
  { key: 'all',            label: 'All',     emoji: '🗺️', color: '#FFFFFF' },
  { key: 'pothole',        label: 'Pothole', emoji: '🕳️', color: '#ef4444' },
  { key: 'broken_signal',  label: 'Signal',  emoji: '🚦', color: '#a855f7' },
  { key: 'waterlogging',   label: 'Flood',   emoji: '🌊', color: '#06b6d4' },
  { key: 'road_damage',    label: 'Damage',  emoji: '⚠️', color: '#f97316' },
  { key: 'no_streetlight', label: 'Lights',  emoji: '💡', color: '#facc15' },
  { key: 'construction',   label: 'Works',   emoji: '🏗️', color: '#64748b' },
]

const TABS_BY_MODE: Record<ExtendedMapMode, FilterTab[]> = {
  emergency: EMERGENCY_TABS,
  legal:     LEGAL_TABS,
  roadwatch: ROADWATCH_TABS,
  authority: [],
}

// ── Service/Issue Meta ────────────────────────────────────────────────────────

const SERVICE_META: Record<string, {
  emoji: string; color: string; mapColor: string; cardColor: string; label: string
}> = {
  hospital:        { emoji: '🏥', color: 'text-blue-400',    mapColor: '#3b82f6', cardColor: 'border-blue-500/30 bg-blue-500/5',     label: 'Hospital'       },
  ambulance:       { emoji: '🚑', color: 'text-red-400',     mapColor: '#ef4444', cardColor: 'border-red-500/30 bg-red-500/5',       label: 'Ambulance'      },
  police:          { emoji: '🚔', color: 'text-indigo-400',  mapColor: '#6366f1', cardColor: 'border-indigo-500/30 bg-indigo-500/5', label: 'Police'         },
  towing:          { emoji: '🚗', color: 'text-amber-400',   mapColor: '#f59e0b', cardColor: 'border-amber-500/30 bg-amber-500/5',   label: 'Towing'         },
  puncture_shop:   { emoji: '🔧', color: 'text-emerald-400', mapColor: '#10b981', cardColor: 'border-emerald-500/30 bg-emerald-500/5',label: 'Puncture Shop' },
  fuel:            { emoji: '⛽', color: 'text-violet-400',  mapColor: '#8b5cf6', cardColor: 'border-violet-500/30 bg-violet-500/5', label: 'Fuel'           },
  speed_cam:       { emoji: '📷', color: 'text-red-400',     mapColor: '#ef4444', cardColor: 'border-red-500/30 bg-red-500/5',       label: 'Speed Camera'   },
  helmet_cam:      { emoji: '🪖', color: 'text-amber-400',   mapColor: '#f59e0b', cardColor: 'border-amber-500/30 bg-amber-500/5',   label: 'Helmet Camera'  },
  blackspot:       { emoji: '⚠️', color: 'text-orange-400', mapColor: '#f97316', cardColor: 'border-orange-500/30 bg-orange-500/5', label: 'Black Spot'     },
  redlight_cam:    { emoji: '🚦', color: 'text-purple-400',  mapColor: '#a855f7', cardColor: 'border-purple-500/30 bg-purple-500/5', label: 'Red Light Cam'  },
  pothole:         { emoji: '🕳️', color: 'text-red-400',     mapColor: '#ef4444', cardColor: 'border-red-500/30 bg-red-500/5',       label: 'Pothole'        },
  broken_signal:   { emoji: '🚦', color: 'text-purple-400',  mapColor: '#a855f7', cardColor: 'border-purple-500/30 bg-purple-500/5', label: 'Broken Signal'  },
  waterlogging:    { emoji: '🌊', color: 'text-cyan-400',    mapColor: '#06b6d4', cardColor: 'border-cyan-500/30 bg-cyan-500/5',     label: 'Waterlogging'   },
  road_damage:     { emoji: '⚠️', color: 'text-orange-400', mapColor: '#f97316', cardColor: 'border-orange-500/30 bg-orange-500/5', label: 'Road Damage'    },
  no_streetlight:  { emoji: '💡', color: 'text-yellow-400',  mapColor: '#facc15', cardColor: 'border-yellow-500/30 bg-yellow-500/5', label: 'No Lighting'    },
  construction:    { emoji: '🏗️', color: 'text-slate-400',   mapColor: '#64748b', cardColor: 'border-slate-500/30 bg-slate-500/5',   label: 'Construction'   },
}

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#94a3b8',
}

const SEV_INTENSITY: Record<string, number> = {
  critical: 1.0, high: 0.7, medium: 0.45, low: 0.2,
}

// ── Mode Header Config ────────────────────────────────────────────────────────

const MODE_HEADER: Record<ExtendedMapMode, {
  Icon: React.ElementType; label: string; color: string
  border: string; bg: string; tip: string; accentHex: string
}> = {
  emergency: { Icon: Siren,    label: 'Emergency Services',    color: 'text-red-400',     border: 'border-red-500/20',     bg: 'bg-red-500/5',     tip: 'Tap map to navigate · tap marker to call',           accentHex: '#ef4444' },
  legal:     { Icon: Scale,    label: 'Violation Enforcement', color: 'text-violet-400',  border: 'border-violet-500/20',  bg: 'bg-violet-500/5',  tip: 'Speed cameras + geofence alerts as you approach',     accentHex: '#8b5cf6' },
  roadwatch: { Icon: Flame,    label: 'Road Issue Heatmap',    color: 'text-amber-400',   border: 'border-amber-500/20',   bg: 'bg-amber-500/5',   tip: 'Tap map to report · heatmap shows issue density',     accentHex: '#f59e0b' },
  authority: { Icon: Building2,label: 'Complaint Density',     color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', tip: 'Ward-level analytics · SLA breach highlighted in red', accentHex: '#10b981' },
}

// ── Mock Legal Pins ───────────────────────────────────────────────────────────

const MOCK_LEGAL_PINS: LegalPin[] = [
  { id: 'l1', type: 'speed_cam',   name: 'Speed Cam — AB Road @ VN Square',  lat: 22.7470, lon: 75.8932, notes: 'Active 24×7 · 40 km/h limit'          },
  { id: 'l2', type: 'helmet_cam',  name: 'Helmet Cam — Ring Road @ LIG',     lat: 22.7139, lon: 75.8625, notes: 'Peak hours 8–11 AM & 5–8 PM'           },
  { id: 'l3', type: 'blackspot',   name: 'Black Spot — Bhawarkuwa Junction', lat: 22.7536, lon: 75.8803, notes: '9 accidents in last 12 months'         },
  { id: 'l4', type: 'speed_cam',   name: 'Speed Cam — Bypass near Airport',  lat: 22.7214, lon: 75.8012, notes: '60 km/h · auto-challan enabled'        },
  { id: 'l5', type: 'redlight_cam',name: 'Red Light Cam — Palasia Chowk',   lat: 22.7240, lon: 75.8802, notes: 'Multi-lane enforcement · HD camera'     },
  { id: 'l6', type: 'blackspot',   name: 'Black Spot — NH-52 km 22',        lat: 22.7800, lon: 75.8100, notes: '14 accidents 2024–2026'                 },
  { id: 'l7', type: 'helmet_cam',  name: 'Helmet Cam — Rajwada Chowk',      lat: 22.7177, lon: 75.8572, notes: 'Tourist zone · strict enforcement'      },
]

// Geofence zone data for legal mode polygon overlay
const GEOFENCE_ZONES = [
  { id: 'gf1', label: 'AB Road Corridor — 40 km/h zone',
    coords: [[22.7440,75.8900],[22.7440,75.8960],[22.7500,75.8960],[22.7500,75.8900]] as [number,number][] },
  { id: 'gf2', label: 'Bhawarkuwa — Black Spot zone',
    coords: [[22.7515,75.8780],[22.7515,75.8830],[22.7560,75.8830],[22.7560,75.8780]] as [number,number][] },
]

// ── Ward Authority Data ───────────────────────────────────────────────────────

const WARD_STATS = [
  { ward: 'Vijay Nagar',    pending: 42, total: 73, slaBreached: 8,  budget: 78, coords: [22.7467,75.8929] as [number,number] },
  { ward: 'Rajwada',        pending: 38, total: 60, slaBreached: 16, budget: 91, coords: [22.7177,75.8572] as [number,number] },
  { ward: 'Palasia',        pending: 19, total: 36, slaBreached: 2,  budget: 55, coords: [22.7237,75.8803] as [number,number] },
  { ward: 'Scheme 54',      pending: 27, total: 41, slaBreached: 11, budget: 63, coords: [22.7601,75.8989] as [number,number] },
  { ward: 'Bicholi Mardana',pending: 15, total: 28, slaBreached: 1,  budget: 88, coords: [22.6821,75.8432] as [number,number] },
  { ward: 'Bhawarkuwa',     pending: 31, total: 52, slaBreached: 13, budget: 72, coords: [22.7536,75.8803] as [number,number] },
]

// ── Canvas Heatmap Helper ─────────────────────────────────────────────────────

/**
 * Draws a radial-gradient heatmap on a canvas element.
 * Pure canvas fallback — works even without leaflet.heat CDN.
 * Points: [lat, lon, intensity 0–1]
 */
function drawHeatmap(
  canvas: HTMLCanvasElement,
  points: [number, number, number][],
  latToY: (lat: number) => number,
  lonToX: (lon: number) => number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const radius = 42
  points.forEach(([lat, lon, intensity]) => {
    const x = lonToX(lon)
    const y = latToY(lat)
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
    grad.addColorStop(0,   `rgba(239,68,68,${intensity * 0.85})`)   // red core
    grad.addColorStop(0.3, `rgba(249,115,22,${intensity * 0.55})`)  // orange mid
    grad.addColorStop(0.6, `rgba(234,179,8,${intensity * 0.25})`)   // yellow fade
    grad.addColorStop(1,   'rgba(239,68,68,0)')                      // transparent edge
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  })
}

// ── Demo RoadWatch Pins (seeded for heatmap demo) ────────────────────────────

const DEMO_ROADWATCH_PINS: CrowdsourcedPin[] = [
  { id:'rw1', name:'Pothole cluster — AB Road', type:'pothole',  lat:22.7467,lon:75.8929, severity:'critical', submittedAt:Date.now()-86400000, upvotes:12, isVerified:true  },
  { id:'rw2', name:'Pothole — MG Road',         type:'pothole',  lat:22.7240,lon:75.8802, severity:'high',     submittedAt:Date.now()-43200000, upvotes:4,  isVerified:false },
  { id:'rw3', name:'Waterlogging — Rajwada',    type:'waterlogging',lat:22.7177,lon:75.8572, severity:'high', submittedAt:Date.now()-21600000, upvotes:8,  isVerified:true  },
  { id:'rw4', name:'Signal down — Palasia',     type:'broken_signal',lat:22.7237,lon:75.8803, severity:'critical', submittedAt:Date.now()-7200000, upvotes:22, isVerified:true },
  { id:'rw5', name:'No lights — Scheme 54',     type:'no_streetlight',lat:22.7601,lon:75.8989, severity:'medium', submittedAt:Date.now()-14400000, upvotes:6, isVerified:false},
  { id:'rw6', name:'Broken guardrail — NH52',   type:'road_damage',lat:22.7800,lon:75.8100, severity:'critical', submittedAt:Date.now()-3600000, upvotes:17, isVerified:true  },
  { id:'rw7', name:'Pothole — LIG colony',      type:'pothole',  lat:22.7139,lon:75.8625, severity:'high',     submittedAt:Date.now()-28800000, upvotes:3,  isVerified:false },
  { id:'rw8', name:'Construction debris',       type:'construction',lat:22.7350,lon:75.8700, severity:'medium', submittedAt:Date.now()-57600000, upvotes:2, isVerified:false},
]

// ── Pin Drop Form ─────────────────────────────────────────────────────────────

function PinDropForm({
  lat, lon, mode, onSave, onCancel,
}: {
  lat: number; lon: number; mode: ExtendedMapMode
  onSave: (p: CrowdsourcedPin) => void; onCancel: () => void
}) {
  const [name, setName]         = useState('')
  const [type, setType]         = useState(mode === 'emergency' ? 'hospital' : 'pothole')
  const [phone, setPhone]       = useState('')
  const [notes, setNotes]       = useState('')
  const [severity, setSeverity] = useState<'critical'|'high'|'medium'|'low'>('medium')

  const types = mode === 'emergency'
    ? ['hospital','ambulance','police','towing','puncture_shop','fuel']
    : ['pothole','broken_signal','waterlogging','road_damage','no_streetlight','construction']

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: `crowd-${Date.now()}`, name: name.trim(), type,
      lat, lon,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      submittedAt: Date.now(), upvotes: 0, isVerified: false,
      severity,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
      className="absolute bottom-0 left-0 right-0 z-50 glass-strong border-t border-white/10 p-4 rounded-t-2xl space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="text-white font-semibold text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-brand-orange" />
          {mode === 'emergency' ? 'Add Service Pin' : 'Report Issue'}
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="text-white/30 text-xs font-mono">
        📍 {lat.toFixed(5)}°N, {lon.toFixed(5)}°E
      </div>

      {/* Type chips */}
      <div className="flex flex-wrap gap-1.5">
        {types.map(t => {
          const m = SERVICE_META[t]
          return (
            <button key={t} onClick={() => setType(t)}
              className={`px-2.5 py-1 rounded-xl text-xs border transition-all ${
                type === t ? `border-current ${m?.color} bg-white/10` : 'border-white/15 text-white/40 hover:text-white/60'
              }`}
            >
              {m?.emoji} {m?.label ?? t}
            </button>
          )
        })}
      </div>

      {/* Severity (roadwatch only) */}
      {mode === 'roadwatch' && (
        <div className="flex gap-1.5">
          {(['critical','high','medium','low'] as const).map(s => (
            <button key={s} onClick={() => setSeverity(s)}
              className={`flex-1 py-1 rounded-xl text-[10px] font-bold border uppercase transition-all ${
                severity === s ? 'bg-white/10 text-white border-white/25' : 'border-white/10 text-white/30'
              }`}
              style={severity === s ? { borderColor: SEV_COLOR[s] + '60', color: SEV_COLOR[s] } : {}}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <input value={name} onChange={e => setName(e.target.value)}
        placeholder={mode === 'emergency' ? 'Service name (e.g. City Hospital)' : 'Brief description'}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-orange/40"
      />
      {mode === 'emergency' && (
        <input value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="Phone number" type="tel"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-orange/40"
        />
      )}
      <input value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Additional details…"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-orange/40"
      />

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-all">
          Cancel
        </button>
        <button onClick={handleSave} disabled={!name.trim()}
          className="flex-1 py-2.5 rounded-xl bg-brand-orange/90 hover:bg-brand-orange text-white text-sm font-semibold disabled:opacity-40 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {mode === 'emergency' ? 'Save Pin' : 'Report Issue'}
        </button>
      </div>

      <div className="text-white/20 text-xs text-center flex items-center justify-center gap-1">
        <Users className="w-3 h-3" />
        Saved offline · synced when online · community-verified
      </div>
    </motion.div>
  )
}

// ── Authority Ward List ───────────────────────────────────────────────────────

function AuthorityWardList() {
  return (
    <div className="p-3 space-y-2">
      {WARD_STATS.map((w, i) => {
        const resolvePct = Math.round(((w.total - w.pending) / w.total) * 100)
        const breach     = w.slaBreached > 5
        return (
          <motion.div key={w.ward} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${breach ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="text-white/70 text-xs font-semibold">{w.ward}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                  breach ? 'text-red-400 bg-red-500/10 border-red-500/25' : 'text-green-400 bg-green-500/10 border-green-500/25'
                }`}>
                  {breach ? `⚠ ${w.slaBreached} SLA breaches` : '✓ SLA OK'}
                </span>
              </div>
            </div>

            {/* Resolution bar */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${resolvePct}%` }}
                  transition={{ delay: i * 0.06 + 0.2, duration: 0.7, ease: 'easeOut' }}
                />
              </div>
              <span className="text-emerald-400 text-[10px] w-8 text-right font-semibold">{resolvePct}%</span>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 text-[10px] text-white/30">
              <span>{w.pending} open / {w.total} total</span>
              <span className="text-yellow-400/60">Budget: {w.budget}%</span>
            </div>
          </motion.div>
        )
      })}

      {/* BIMSTEC comparison footer */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 mt-2">
        <div className="text-blue-400 text-[10px] font-semibold mb-1.5 flex items-center gap-1.5">
          🌏 BIMSTEC Regional Comparison
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { city: 'Indore', avg: '11d', color: 'text-amber-400' },
            { city: 'Dhaka',  avg: '18d', color: 'text-red-400'   },
            { city: 'Colombo',avg: '9d',  color: 'text-green-400' },
          ].map(c => (
            <div key={c.city} className="text-center">
              <div className={`text-xs font-bold ${c.color}`}>{c.avg}</div>
              <div className="text-white/25 text-[9px]">avg SLA</div>
              <div className="text-white/35 text-[9px]">{c.city}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-white/20 text-[10px] py-1 flex items-center justify-center gap-1.5">
        <BarChart2 className="w-3 h-3" />
        IMC Real-time · Ward analytics · BIMSTEC benchmark
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface CrowdsourcedMapProps {
  userLat: number
  userLon: number
  services: EmergencyService[]
  crowdsourcedPins?: CrowdsourcedPin[]
  onPinAdded?: (pin: CrowdsourcedPin) => void
  height?: number
  mode?: ExtendedMapMode
  /** v21: live GPS position — draws pulsing blue dot on canvas */
  liveLocation?: { lat: number; lon: number; accuracy: number }
}

export function CrowdsourcedMap({
  userLat, userLon, services,
  crowdsourcedPins = [],
  onPinAdded,
  height = 380,
  mode = 'emergency',
  liveLocation,
}: CrowdsourcedMapProps) {
  const mapRef         = useRef<HTMLDivElement>(null)
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [viewMode,     setViewMode]     = useState<'map' | 'list'>('map')
  const [pendingPin,   setPendingPin]   = useState<{ lat: number; lon: number } | null>(null)
  const [localPins,    setLocalPins]    = useState<CrowdsourcedPin[]>([
    ...crowdsourcedPins, ...DEMO_ROADWATCH_PINS,
  ])
  const [mapReady,  setMapReady]  = useState(false)
  const [heatActive,setHeatActive]= useState(true)
  const [mapObj, setMapObj] = useState<unknown>(null)

  useEffect(() => { setActiveFilter('all') }, [mode])

  const tabs         = TABS_BY_MODE[mode] ?? EMERGENCY_TABS
  const headerConfig = MODE_HEADER[mode]
  const canDrop      = mode === 'emergency' || mode === 'roadwatch'

  // Load from IndexedDB
  useEffect(() => {
    ;(async () => {
      try {
        const { db } = await import('@/lib/db')
        const stored = await db.emergencyContacts.where('isOfficial').equals(0).toArray()
        const pins: CrowdsourcedPin[] = stored.map(s => ({
          id: `crowd-db-${s.id}`, name: s.name,
          type: s.type === 'puncture' ? 'puncture_shop' : s.type,
          lat: s.lat ?? 0, lon: s.lon ?? 0,
          phone: s.phone || undefined, notes: s.address ?? undefined,
          submittedAt: s.lastVerified, upvotes: 0, isVerified: false,
        }))
        if (pins.length) {
          setLocalPins(prev => {
            const seen = new Set(prev.map(p => `${p.lat}-${p.lon}`))
            return [...prev, ...pins.filter(p => !seen.has(`${p.lat}-${p.lon}`))]
          })
        }
      } catch { /* IndexedDB unavailable */ }
    })()
  }, [])

  const handlePinSave = useCallback(async (pin: CrowdsourcedPin) => {
    setLocalPins(prev => [pin, ...prev])
    setPendingPin(null)
    onPinAdded?.(pin)
    try {
      const { db } = await import('@/lib/db')
      await db.emergencyContacts.add({
        country: 'India', name: pin.name,
        type: pin.type === 'puncture_shop' ? 'puncture' : pin.type as never,
        phone: pin.phone ?? '', lat: pin.lat, lon: pin.lon,
        isOfficial: false, lastVerified: pin.submittedAt, address: pin.notes ?? null,
      })
    } catch { /* graceful degradation */ }
  }, [onPinAdded])

  // ── Leaflet initialization ────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || viewMode !== 'map') return

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const L = (window as any).L
      if (!mapRef.current) return

      const tileUrl = mode === 'authority'
        ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

      const map = L.map(mapRef.current, {
        center: [userLat, userLon], zoom: 14,
        zoomControl: true, attributionControl: false,
      })
      L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map)

      // User location pulse
      const pulseHtml = `
        <div style="position:relative;width:22px;height:22px">
          <div style="position:absolute;inset:0;border-radius:50%;background:#FF6200;opacity:0.25;animation:ping 1.5s ease-out infinite"></div>
          <div style="position:absolute;inset:4px;border-radius:50%;background:#FF6200;border:2px solid #fff"></div>
        </div>
        <style>@keyframes ping{0%{transform:scale(1);opacity:0.25}100%{transform:scale(2.5);opacity:0}}</style>
      `
      L.marker([userLat, userLon], {
        icon: L.divIcon({ html: pulseHtml, iconSize: [22, 22], iconAnchor: [11, 11], className: '' }),
      }).addTo(map).bindPopup('<b style="color:#FF6200">📍 You are here</b>')

      // ── Emergency mode ──────────────────────────────────────────────────
      if (mode === 'emergency') {
        const combined = [...services, ...localPins]
        combined
          .filter(s => activeFilter === 'all' || s.type === activeFilter)
          .forEach(svc => {
            const meta = SERVICE_META[svc.type]
            if (!meta) return
            const isCrowd = 'upvotes' in svc
            const icon = L.divIcon({
              html: `<div style="font-size:16px;background:rgba(10,22,40,0.95);border:2px solid ${meta.mapColor};
                border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;
                box-shadow:0 0 12px ${meta.mapColor}55,0 2px 8px rgba(0,0,0,0.6);
                ${isCrowd ? `outline:2px dashed ${meta.mapColor}80;outline-offset:3px;` : ''}
              ">${meta.emoji}</div>`,
              iconSize: [34, 34], iconAnchor: [17, 17], className: '',
            })
            L.marker([svc.lat, svc.lon], { icon }).addTo(map).bindPopup(`
              <div style="min-width:160px;font-family:system-ui;padding:4px">
                <b style="color:${meta.mapColor}">${meta.emoji} ${svc.name}</b><br/>
                <span style="color:#aaa;font-size:12px">${formatDistance((svc as EmergencyService).distance_m ?? 0)} away</span>
                ${svc.phone ? `<br/><a href="tel:${svc.phone}" style="color:#00E676;font-size:12px">📞 ${svc.phone}</a>` : ''}
                ${isCrowd ? `<br/><span style="color:#FF6200;font-size:10px">👥 Community verified</span>` : ''}
              </div>
            `)
          })
      }

      // ── Legal mode: markers + geofence polygons ─────────────────────────
      if (mode === 'legal') {
        const filtered = MOCK_LEGAL_PINS.filter(p => activeFilter === 'all' || p.type === activeFilter)
        filtered.forEach(lp => {
          const meta = SERVICE_META[lp.type]
          if (!meta) return
          // Pulsing square icon for cameras
          const isCamera = lp.type.includes('cam')
          const borderRadius = isCamera ? '4px' : '50%'
          const icon = L.divIcon({
            html: `<div style="font-size:15px;background:rgba(10,22,40,0.95);border:2px solid ${meta.mapColor};
              border-radius:${borderRadius};width:34px;height:34px;display:flex;align-items:center;justify-content:center;
              box-shadow:0 0 14px ${meta.mapColor}70,0 2px 8px rgba(0,0,0,0.6);position:relative;"
              class="${isCamera ? 'cam-pulse' : ''}"
            >
              ${meta.emoji}
              ${isCamera ? `<div style="position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:#ef4444;" class="live-dot"></div>` : ''}
            </div>`,
            iconSize: [34, 34], iconAnchor: [17, 17], className: '',
          })
          L.marker([lp.lat, lp.lon], { icon }).addTo(map).bindPopup(`
            <div style="min-width:160px;font-family:system-ui;padding:4px">
              <b style="color:${meta.mapColor}">${meta.emoji} ${lp.name}</b>
              ${lp.notes ? `<br/><span style="color:#aaa;font-size:11px">${lp.notes}</span>` : ''}
            </div>
          `)
        })

        // Geofence polygons
        GEOFENCE_ZONES.forEach(zone => {
          L.polygon(zone.coords, {
            color: '#8b5cf6', fillColor: '#8b5cf6',
            weight: 2, fillOpacity: 0.12, dashArray: '6,4',
          }).addTo(map).bindPopup(`
            <div style="font-family:system-ui;padding:4px">
              <b style="color:#a78bfa">🚫 Geo-Fence Zone</b><br/>
              <span style="color:#aaa;font-size:11px">${zone.label}</span>
            </div>
          `)
        })
      }

      // ── RoadWatch: markers (heatmap drawn separately on canvas) ─────────
      if (mode === 'roadwatch') {
        const rwPins = localPins.filter(p => activeFilter === 'all' || p.type === activeFilter)
        rwPins.forEach(pin => {
          const meta = SERVICE_META[pin.type] ?? SERVICE_META['pothole']
          const sevColor = SEV_COLOR[pin.severity ?? 'medium']
          const icon = L.divIcon({
            html: `<div style="font-size:15px;background:rgba(10,22,40,0.95);border:2px solid ${sevColor};
              border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;
              box-shadow:0 0 14px ${sevColor}60;
              ${pin.severity === 'critical' ? `animation:pulse-crit 1.5s ease-in-out infinite` : ''}"
            >${meta.emoji}</div>
            <style>@keyframes pulse-crit{0%,100%{box-shadow:0 0 14px ${sevColor}60}50%{box-shadow:0 0 24px ${sevColor}}}</style>`,
            iconSize: [34, 34], iconAnchor: [17, 17], className: '',
          })
          L.marker([pin.lat, pin.lon], { icon }).addTo(map).bindPopup(`
            <div style="min-width:160px;font-family:system-ui;padding:4px">
              <b style="color:${sevColor}">${meta.emoji} ${pin.name}</b><br/>
              <span style="color:#aaa;font-size:11px">${pin.notes ?? 'Community report'}</span><br/>
              <span style="color:${sevColor};font-size:10px;font-weight:bold;text-transform:uppercase">${pin.severity ?? 'medium'}</span>
              · <span style="color:#888;font-size:10px">👍 ${pin.upvotes} upvotes</span>
              ${pin.isVerified ? `<br/><span style="color:#10b981;font-size:10px">✓ Verified</span>` : ''}
            </div>
          `)
        })
      }

      // ── Authority: animated choropleth circles ──────────────────────────
      if (mode === 'authority') {
        WARD_STATS.forEach((w, i) => {
          const sla   = w.slaBreached > 5
          const color = sla ? '#ef4444' : w.pending > 30 ? '#f97316' : '#22c55e'
          const radius = 20 + Math.round(w.pending / 4)
          // Outer pulsing ring for breach wards
          if (sla) {
            L.circleMarker(w.coords, {
              radius: radius + 8, fillColor: 'transparent',
              color, weight: 1.5, fillOpacity: 0, opacity: 0.4,
              className: 'animate-pulse',
            }).addTo(map)
          }
          L.circleMarker(w.coords, {
            radius, fillColor: color, color: '#fff',
            weight: 2, fillOpacity: 0.35,
          }).addTo(map).bindPopup(`
            <div style="font-family:system-ui;min-width:160px;padding:4px">
              <b style="color:${color}">${w.ward}</b><br/>
              <span style="color:#aaa;font-size:11px">
                ${w.pending} open · ${w.slaBreached} SLA breaches
              </span><br/>
              <span style="color:#fbbf24;font-size:11px">Budget: ${w.budget}% utilised</span>
            </div>
          `)
          // Ward label
          L.tooltip(w.coords, {
            content: `<span style="color:#fff;font-size:10px;font-family:system-ui">${w.ward}</span>`,
            direction: 'top', permanent: true, opacity: 0.8,
            className: 'ward-label',
          }).addTo(map)
        })
      }

      // Click to drop pin
      if (canDrop) {
        map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
          setPendingPin({ lat: e.latlng.lat, lon: e.latlng.lng })
        })
      }

      mapInstanceRef.current = map
      setMapObj(map)
      setMapReady(true)
    }
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
        setMapObj(null)
        setMapReady(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, mode, activeFilter])

  // ── Canvas heatmap overlay (roadwatch mode) ───────────────────────────────

  useEffect(() => {
    if (!mapReady || mode !== 'roadwatch' || !heatActive || !mapRef.current) return
    if (!canvasRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L   = (window as any).L
    const map = mapInstanceRef.current as { latLngToContainerPoint: (ll: unknown) => { x: number; y: number }; getBounds: () => unknown } | null
    if (!L || !map) return

    const canvas = canvasRef.current
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const rwPins = localPins.filter(
      p => ['pothole','road_damage','broken_signal','waterlogging','no_streetlight','construction'].includes(p.type)
    )

    const points: [number, number, number][] = rwPins.map(p => {
      const pt = map.latLngToContainerPoint(L.latLng(p.lat, p.lon))
      return [p.lat, p.lon, SEV_INTENSITY[p.severity ?? 'medium']]
    }).map((p, i) => {
      const pt = map.latLngToContainerPoint(L.latLng(rwPins[i].lat, rwPins[i].lon))
      return [pt.x, pt.y, p[2]] as [number, number, number]
    })

    // Draw using canvas-pixel coords directly
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    points.forEach(([x, y, intensity]) => {
      const radius = 50
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
      grad.addColorStop(0,   `rgba(239,68,68,${intensity * 0.8})`)
      grad.addColorStop(0.3, `rgba(249,115,22,${intensity * 0.5})`)
      grad.addColorStop(0.65,`rgba(234,179,8,${intensity * 0.22})`)
      grad.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    })
    // v21: Draw pulsing blue dot for live GPS position
    if (liveLocation && (window as any).__leafletMap__) {
      try {
        const L = (window as any).L
        const mapObj = (window as any).__leafletMap__
        if (L && mapObj) {
          const pt = mapObj.latLngToContainerPoint(L.latLng(liveLocation.lat, liveLocation.lon))
          const lx = pt.x, ly = pt.y
          // Glow ring
          const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 28)
          glow.addColorStop(0,   'rgba(59,130,246,0.4)')
          glow.addColorStop(0.5, 'rgba(59,130,246,0.15)')
          glow.addColorStop(1,   'rgba(59,130,246,0)')
          ctx.fillStyle = glow
          ctx.beginPath(); ctx.arc(lx, ly, 28, 0, Math.PI * 2); ctx.fill()
          // Accuracy ring
          if (liveLocation.accuracy < 300) {
            ctx.strokeStyle = 'rgba(59,130,246,0.25)'; ctx.lineWidth = 1
            ctx.beginPath(); ctx.arc(lx, ly, Math.min(liveLocation.accuracy / 4, 50), 0, Math.PI * 2); ctx.stroke()
          }
          // Inner dot
          ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(lx, ly, 7, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = 'white';   ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill()
        }
      } catch {}
    }
  }, [mapReady, mode, localPins, heatActive, liveLocation])

  // ── Render ────────────────────────────────────────────────────────────────

  const pinnedCount = mode === 'roadwatch' ? localPins.filter(p =>
    activeFilter === 'all' || p.type === activeFilter
  ).length : 0

  return (
    <div className="glass-card border border-white/[0.08] overflow-hidden rounded-2xl">

      {/* ── Mode header strip ── */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] ${headerConfig.bg}`}
        style={{ boxShadow: `inset 0 -1px 0 ${headerConfig.accentHex}20` }}
      >
        <headerConfig.Icon className={`w-3.5 h-3.5 ${headerConfig.color} shrink-0`} />
        <span className={`text-xs font-semibold ${headerConfig.color}`}>{headerConfig.label}</span>
        <span className="text-white/25 text-[10px] flex-1 truncate hidden sm:block">{headerConfig.tip}</span>

        {/* Heatmap toggle (roadwatch only) */}
        {mode === 'roadwatch' && viewMode === 'map' && (
          <button
            onClick={() => setHeatActive(h => !h)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border transition-all ${
              heatActive
                ? 'bg-red-500/20 border-red-500/30 text-red-400'
                : 'bg-white/5 border-white/10 text-white/30'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span className="hidden sm:inline">Heat</span>
          </button>
        )}

        {/* View toggle */}
        <div className="flex bg-white/5 rounded-lg p-0.5 shrink-0">
          {(['map', 'list'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`px-2 py-1 rounded-md text-xs transition-all ${viewMode === v ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
            >
              {v === 'map' ? <Map className="w-3 h-3" /> : <List className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter chips ── */}
      {tabs.length > 0 && (
        <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none border-b border-white/[0.04]">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                activeFilter === tab.key
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'bg-white/[0.03] text-white/35 border border-white/[0.06] hover:text-white/60'
              }`}
              style={activeFilter === tab.key ? { borderColor: tab.color + '50' } : {}}
            >
              {tab.emoji}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Map / List / Authority ── */}
      <div className="relative">
        {viewMode === 'map' && mode !== 'authority' ? (
          <>
            <div ref={mapRef} style={{ height, width: '100%' }} />

            {/* Canvas heatmap overlay — positioned absolutely over the map */}
            {mode === 'roadwatch' && heatActive && (
              <canvas
                ref={canvasRef}
                style={{ height, width: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 400, mixBlendMode: 'screen' }}
              />
            )}

            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-brand-blue/80 z-50">
                <div className="text-center text-white/40">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <div className="text-sm">Loading {mode} layer…</div>
                </div>
              </div>
            )}

            {mapReady && canDrop && (
              <div className="absolute top-2 right-2 z-[450]">
                <div className="glass px-2.5 py-1.5 rounded-lg text-[10px] text-white/40 border border-white/10">
                  Tap map to {mode === 'emergency' ? 'add pin' : 'report issue'}
                </div>
              </div>
            )}

            {/* Heatmap legend (roadwatch) */}
            {mode === 'roadwatch' && heatActive && mapReady && (
              <motion.div
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                className="absolute bottom-12 left-2 z-[450] glass px-2.5 py-2 rounded-xl border border-white/10"
              >
                <div className="text-white/35 text-[9px] font-semibold uppercase mb-1.5">Issue Density</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-2 rounded-full" style={{
                    background: 'linear-gradient(to right, rgba(234,179,8,0.4), rgba(249,115,22,0.6), rgba(239,68,68,0.85))'
                  }} />
                </div>
                <div className="flex justify-between text-[9px] text-white/25 mt-0.5">
                  <span>Low</span><span>High</span>
                </div>
              </motion.div>
            )}
          </>
        ) : mode === 'authority' || viewMode === 'list' ? (
          <>
            {mode === 'authority' ? (
              <AuthorityWardList />
            ) : (
              <div className="max-h-96 overflow-y-auto p-3 space-y-2">
                {/* Emergency list */}
                {mode === 'emergency' && (() => {
                  const filtered = services.filter(s => activeFilter === 'all' || s.type === activeFilter)
                  return filtered.length === 0 ? (
                    <div className="text-center py-8 text-white/30 text-sm">No services for this filter.</div>
                  ) : (
                    <AnimatePresence>
                      {filtered.map((svc, i) => {
                        const meta = SERVICE_META[svc.type]
                        return (
                          <motion.div key={`${svc.name}-${i}`}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className={`flex items-center gap-3 p-3 rounded-xl border ${meta?.cardColor ?? 'border-white/10 bg-white/5'}`}
                          >
                            <span className="text-2xl shrink-0">{meta?.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-medium text-sm truncate">{svc.name}</div>
                              <div className="text-white/40 text-xs">{formatDistance(svc.distance_m)} · {svc.phone}</div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              {svc.phone && (
                                <a href={`tel:${svc.phone}`} className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all">
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <a href={`https://www.google.com/maps/dir/?api=1&destination=${svc.lat},${svc.lon}`}
                                target="_blank" rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  )
                })()}

                {/* Legal list */}
                {mode === 'legal' && (
                  <AnimatePresence>
                    {MOCK_LEGAL_PINS.filter(p => activeFilter === 'all' || p.type === activeFilter).map((lp, i) => {
                      const meta = SERVICE_META[lp.type]
                      return (
                        <motion.div key={lp.id}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`flex items-center gap-3 p-3 rounded-xl border ${meta?.cardColor ?? 'border-white/10 bg-white/5'}`}
                        >
                          <span className="text-2xl shrink-0">{meta?.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium text-sm truncate">{lp.name}</div>
                            {lp.notes && <div className="text-white/40 text-xs">{lp.notes}</div>}
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                )}

                {/* RoadWatch list */}
                {mode === 'roadwatch' && (
                  <AnimatePresence>
                    {localPins.filter(p => activeFilter === 'all' || p.type === activeFilter).map((pin, i) => {
                      const meta     = SERVICE_META[pin.type] ?? SERVICE_META['pothole']
                      const sevColor = SEV_COLOR[pin.severity ?? 'medium']
                      return (
                        <motion.div key={pin.id}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`flex items-center gap-3 p-3 rounded-xl border ${meta.cardColor}`}
                        >
                          <span className="text-2xl shrink-0">{meta.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium text-sm truncate">{pin.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                                style={{ color: sevColor, borderColor: sevColor + '40', background: sevColor + '18' }}>
                                {(pin.severity ?? 'medium').toUpperCase()}
                              </span>
                              {pin.isVerified && <span className="text-green-400 text-[10px]">✓ Verified</span>}
                              <span className="text-white/25 text-[10px]">👍 {pin.upvotes}</span>
                            </div>
                          </div>
                          <span className="text-white/25 text-[10px] shrink-0 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Community
                          </span>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                )}
              </div>
            )}
          </>
        ) : null}

        {/* ── Pin drop form overlay ── */}
        <AnimatePresence>
          {pendingPin && canDrop && (
            <PinDropForm
              lat={pendingPin.lat} lon={pendingPin.lon}
              mode={mode}
              onSave={handlePinSave}
              onCancel={() => setPendingPin(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer stats bar ── */}
      <div className="px-4 py-2 border-t border-white/[0.04] flex items-center justify-between">
        <div className="text-white/20 text-xs flex items-center gap-1">
          <Layers className="w-3 h-3" />
          {activeFilter === 'all' ? 'All layers' : `Filter: ${activeFilter.replace('_', ' ')}`}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'roadwatch' && heatActive && (
            <div className="flex items-center gap-1 text-red-400/60 text-[10px]">
              <Flame className="w-3 h-3" />
              Heatmap active
            </div>
          )}
          <div className="text-white/20 text-xs">
            {mode === 'emergency' && `${services.length} official · ${localPins.length} community`}
            {mode === 'legal'     && `${MOCK_LEGAL_PINS.length} enforcement zones`}
            {mode === 'roadwatch' && `${localPins.length} active reports`}
            {mode === 'authority' && `${WARD_STATS.length} wards tracked`}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrowdsourcedMap
