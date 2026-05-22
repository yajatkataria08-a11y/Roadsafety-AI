'use client'

/**
 * /map — Full Map Dashboard
 * ══════════════════════════
 * Full-screen map experience combining all three layers:
 *   🚨 RoadSoS   — Emergency service locator + SOS beacon
 *   🗺️ RoadWatch — Pothole/issue heatmap + complaint tracker
 *   ⚖️ DriveLegal — Black spots + camera alerts + violation zones
 *
 * Layout:
 *  - Full-height map canvas (Leaflet)
 *  - Floating stats sidebar (desktop) / bottom sheet (mobile)
 *  - Mode header with context-specific stats
 */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Phone, MapPin, Shield, Zap,
  Navigation, ChevronRight, Activity, Clock,
  Camera, BarChart2, Radio, X, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/shared/Navbar'
import { AiMap, type MapMode } from '@/components/map/AiMap'
import { MapController } from '@/components/map/MapController'
import { CrashModeButton } from '@/components/emergency/CrashMode'
import { useCrashEmergency } from '@/lib/hooks/useCrashEmergency'
import {
  getMapServices, getMapIssues, getMapHotspots,
  type MapService, type MapIssuesResult, type MapHotspotsResult,
} from '@/lib/api'

// ── Mode card metadata ─────────────────────────────────────────────────────────

const MODES: Array<{
  key: MapMode
  title: string
  subtitle: string
  emoji: string
  color: string
  bg: string
  border: string
  stats: string[]
  description: string
}> = [
  {
    key: 'sos',
    title: 'RoadSoS',
    subtitle: 'Emergency Services',
    emoji: '🚨',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    stats: ['Nearest hospital', 'ETA estimate', 'One-Tap SOS'],
    description: 'Locate hospitals, police, ambulances, towing & puncture shops near you. Drop SOS beacon & share live location.',
  },
  {
    key: 'roadwatch',
    title: 'RoadWatch',
    subtitle: 'Road Issue Heatmap',
    emoji: '🗺️',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    stats: ['Pothole density', 'Complaint status', 'Authority tracking'],
    description: 'Heatmap of potholes, flooding, broken signals & construction zones. Track complaint tickets in real-time.',
  },
  {
    key: 'drivelegal',
    title: 'DriveLegal',
    subtitle: 'Violation Intelligence',
    emoji: '⚖️',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    stats: ['Black spots', 'Speed cameras', 'Geo-fence alerts'],
    description: 'See accident black spots, speed & helmet cameras. Get real-time geo-fence alerts as you approach violation zones.',
  },
]

// ── Quick stats (pulled from API results) ─────────────────────────────────────

interface QuickStats {
  sos: { total: number; nearest: string; nearestETA: string }
  roadwatch: { total: number; pending: number; hotTypes: string }
  drivelegal: { blackspots: number; cameras: number; zones: number }
}

const DEFAULT_STATS: QuickStats = {
  sos: { total: 0, nearest: '—', nearestETA: '—' },
  roadwatch: { total: 0, pending: 0, hotTypes: '—' },
  drivelegal: { blackspots: 0, cameras: 0, zones: 0 },
}

// ── SOS Activation modal ───────────────────────────────────────────────────────

function SOSModal({ lat, lon, onClose }: { lat: number; lon: number; onClose: () => void }) {
  const url = `https://maps.google.com/?q=${lat},${lon}`
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, scale: 0.9 }} animate={{ y: 0, scale: 1 }} exit={{ y: 60 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md glass-strong rounded-3xl border border-red-500/30 p-6 space-y-4"
      >
        {/* Siren flash */}
        <div className="absolute inset-0 rounded-3xl animate-siren pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center animate-heartbeat">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-red-400 font-bold text-lg">SOS ACTIVATED</div>
              <div className="text-white/50 text-xs">Location pinned · Services alerted</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/40">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Location */}
        <div className="relative z-10 bg-white/[0.04] rounded-2xl p-3 border border-white/[0.08]">
          <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Your location (shared)
          </div>
          <div className="text-white font-mono text-sm">{lat.toFixed(5)}°N, {lon.toFixed(5)}°E</div>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-blue-400 text-xs mt-1 block hover:underline">
            Open in Maps ↗
          </a>
        </div>

        {/* Emergency numbers */}
        <div className="relative z-10 grid grid-cols-3 gap-2">
          {[
            { num: '112', label: 'Emergency', emoji: '🆘' },
            { num: '108', label: 'Ambulance', emoji: '🚑' },
            { num: '100', label: 'Police',    emoji: '🚔' },
          ].map(({ num, label, emoji }) => (
            <a key={num} href={`tel:${num}`}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-center hover:bg-red-500/20 active:scale-95 transition-all"
            >
              <span className="text-xl">{emoji}</span>
              <span className="font-mono font-bold text-red-400 text-sm">{num}</span>
              <span className="text-white/40 text-xs">{label}</span>
            </a>
          ))}
        </div>

        {/* Share */}
        <button
          onClick={() => navigator.share?.({ title: '🚨 SOS Emergency', text: `Emergency at ${url}` })}
          className="relative z-10 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
        >
          <Radio className="w-4 h-4 animate-pulse" />
          Share live location with responders
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── Mode Selector Cards ────────────────────────────────────────────────────────

function ModeSelectorCard({
  mode, active, onClick,
}: { mode: typeof MODES[0]; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex-1 p-3 rounded-2xl border text-left transition-all overflow-hidden ${
        active ? `${mode.bg} ${mode.border} border ${mode.color}` :
        'border-white/[0.08] bg-white/[0.02] text-white/40 hover:text-white/60 hover:bg-white/[0.05]'
      }`}
    >
      {active && (
        <div className={`absolute inset-0 ${mode.bg} opacity-50`} />
      )}
      <div className="relative z-10">
        <div className="text-2xl mb-1">{mode.emoji}</div>
        <div className={`font-bold text-sm ${active ? mode.color : 'text-white/60'}`}>{mode.title}</div>
        <div className="text-white/30 text-xs">{mode.subtitle}</div>
      </div>
    </motion.button>
  )
}

// ── Stats Sidebar ─────────────────────────────────────────────────────────────

function StatsSidebar({ mode, stats }: { mode: MapMode; stats: QuickStats }) {
  const items = mode === 'sos' ? [
    { label: 'Services Found', value: stats.sos.total, icon: '🏥', color: 'text-blue-400' },
    { label: 'Nearest',        value: stats.sos.nearest,   icon: '📍', color: 'text-white/70' },
    { label: 'ETA',            value: stats.sos.nearestETA, icon: '⏱', color: 'text-amber-400' },
  ] : mode === 'roadwatch' ? [
    { label: 'Total Issues',  value: stats.roadwatch.total,   icon: '🗺️', color: 'text-amber-400' },
    { label: 'Pending',       value: stats.roadwatch.pending,  icon: '🔴', color: 'text-red-400' },
    { label: 'Top Issue',     value: stats.roadwatch.hotTypes, icon: '⚠️', color: 'text-white/70' },
  ] : [
    { label: 'Black Spots', value: stats.drivelegal.blackspots, icon: '💀', color: 'text-red-400' },
    { label: 'Cameras',     value: stats.drivelegal.cameras,    icon: '📷', color: 'text-amber-400' },
    { label: 'Zones',       value: stats.drivelegal.zones,      icon: '🚫', color: 'text-violet-400' },
  ]

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07 }}
          className="flex items-center gap-3 p-3 rounded-xl glass border border-white/[0.08]"
        >
          <span className="text-xl">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-white/30 text-xs">{item.label}</div>
            <div className={`font-semibold text-sm truncate ${item.color}`}>{item.value || '—'}</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MapPage() {
  const searchParams = useSearchParams()
  const { isCrisis, crashLat, crashLon } = useCrashEmergency()
  // Support ?crisis=true|1 (legacy + new) and sessionStorage crash state
  const crisis = searchParams.get('crisis') === 'true' || searchParams.get('crisis') === '1' || isCrisis
  const [activeMode, setActiveMode] = useState<MapMode>('sos')
  const [userLat, setUserLat] = useState(22.7196)
  const [userLon, setUserLon] = useState(75.8577)
  const [sosModalOpen, setSOSModalOpen] = useState(false)
  const [stats, setStats] = useState<QuickStats>(DEFAULT_STATS)
  const [crashMode, setCrashMode] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [mapHeight, setMapHeight] = useState(480)

  // GPS — prefer crash state location if coming from SOS
  useEffect(() => {
    if (crashLat && crashLon) {
      setUserLat(crashLat)
      setUserLon(crashLon)
      return
    }
    navigator.geolocation?.getCurrentPosition(
      p => { setUserLat(p.coords.latitude); setUserLon(p.coords.longitude) },
      () => {} // use defaults
    )
  }, [crashLat, crashLon])

  // Responsive height
  useEffect(() => {
    const update = () => setMapHeight(window.innerHeight > 800 ? 540 : 420)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Fetch stats for sidebar
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const [svcs, issues, hotspots] = await Promise.allSettled([
        getMapServices(userLat, userLon),
        getMapIssues(userLat, userLon),
        getMapHotspots(userLat, userLon),
      ])

      const newStats: QuickStats = { ...DEFAULT_STATS }

      if (svcs.status === 'fulfilled') {
        const s = svcs.value
        newStats.sos.total = s.count
        const nearest = s.services[0]
        if (nearest) {
          newStats.sos.nearest = nearest.name
          newStats.sos.nearestETA = nearest.eta_min ? `~${nearest.eta_min} min` : '—'
        }
      }
      if (issues.status === 'fulfilled') {
        const s = issues.value
        newStats.roadwatch.total = s.count
        newStats.roadwatch.pending = s.counts_by_status.pending ?? 0
        const topType = Object.entries(s.counts_by_type).sort((a, b) => b[1] - a[1])[0]
        newStats.roadwatch.hotTypes = topType
          ? topType[0].replace('_', ' ')
          : '—'
      }
      if (hotspots.status === 'fulfilled') {
        const s = hotspots.value
        newStats.drivelegal.blackspots = s.blackspots.length
        newStats.drivelegal.cameras = s.cameras.length
        newStats.drivelegal.zones = s.violation_zones.length
      }

      setStats(newStats)
    } catch (e) {
      console.warn('Stats fetch error:', e)
    } finally {
      setStatsLoading(false)
    }
  }, [userLat, userLon])

  useEffect(() => { fetchStats() }, [fetchStats])

  return (
    <div className="min-h-screen bg-brand-blue flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 pb-6 pt-4 gap-4">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white flex items-center gap-2">
              <span className="text-gradient-orange">AI</span> Map Intelligence
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Real-time road safety · emergency services · violation alerts
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchStats}
              className="p-2 rounded-xl hover:bg-white/10 text-white/30 hover:text-white/70 transition-all"
              title="Refresh all data"
            >
              <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="w-52">
              <CrashModeButton
                compact
                onActivate={(lat, lon) => {
                  setUserLat(lat)
                  setUserLon(lon)
                  setCrashMode(true)
                  setActiveMode('sos')
                  setSOSModalOpen(true)
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Main grid: map + sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">

          {/* Map — MapController owns mode tabs + layers; AiMap is its inner renderer */}
          <div className={crisis ? 'ring-2 ring-red-500/60 rounded-3xl animate-pulse' : ''}>
            <MapController
              userLat={userLat}
              userLon={userLon}
              height={mapHeight}
              forceEmergency={crisis || crashMode}
              className="w-full"
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* Live stats */}
            <div className="glass-card p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
                  <BarChart2 className="w-4 h-4" />
                  Live Stats
                </div>
                {statsLoading && <Activity className="w-3.5 h-3.5 text-white/30 animate-pulse" />}
              </div>
              <StatsSidebar mode={activeMode} stats={stats} />
            </div>

            {/* Emergency numbers (always visible in sos mode) */}
            {activeMode === 'sos' && (
              <div className="glass-card p-4 rounded-2xl">
                <div className="text-white/40 text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Emergency Numbers
                </div>
                <div className="space-y-2">
                  {[
                    { num: '112', label: 'All Emergencies', emoji: '🆘', color: 'border-red-500/25 bg-red-500/5 text-red-400' },
                    { num: '108', label: 'Ambulance',       emoji: '🚑', color: 'border-red-500/20 bg-red-500/5 text-red-300' },
                    { num: '100', label: 'Police',          emoji: '🚔', color: 'border-indigo-500/25 bg-indigo-500/5 text-indigo-400' },
                    { num: '1033',label: 'NHAI Highway',    emoji: '🛣️', color: 'border-amber-500/20 bg-amber-500/5 text-amber-400' },
                  ].map(({ num, label, emoji, color }) => (
                    <a key={num} href={`tel:${num}`}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border ${color} hover:brightness-110 transition-all`}
                    >
                      <span>{emoji}</span>
                      <div className="flex-1">
                        <div className="text-xs opacity-70">{label}</div>
                        <div className="font-mono font-bold">{num}</div>
                      </div>
                      <Phone className="w-3.5 h-3.5 opacity-50" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* DriveLegal tips */}
            {activeMode === 'drivelegal' && (
              <div className="glass-card p-4 rounded-2xl">
                <div className="text-white/40 text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Compliance Tips
                </div>
                <div className="space-y-2 text-xs text-white/50">
                  {[
                    '🪖 Always wear a helmet in marked zones',
                    '📷 Slow down before speed camera zones',
                    '🚗 Keep documents ready in high-enforcement areas',
                    '📱 Avoid mobile use while driving — ₹5,000 fine',
                    '🛑 Never park in tow-away zones',
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 border-b border-white/[0.05] last:border-0">
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RoadWatch tips */}
            {activeMode === 'roadwatch' && (
              <div className="glass-card p-4 rounded-2xl">
                <div className="text-white/40 text-xs font-semibold mb-3">How to Report</div>
                <div className="space-y-2">
                  {[
                    { icon: '📍', text: 'Tap any marker for issue details' },
                    { icon: '📷', text: 'Attach photo for AI image analysis' },
                    { icon: '🎟️', text: 'Get full Issue Report Card on submit' },
                    { icon: '📢', text: 'Share tickets to escalate faster' },
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-white/40">
                      <span>{tip.icon}</span>
                      <span>{tip.text}</span>
                    </div>
                  ))}
                  <Link
                    href="/report"
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all"
                  >
                    Report a Road Issue <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* BIMSTEC Road Safety Stats — all modes */}
            <div className="glass-card p-4 rounded-2xl">
              <div className="text-white/40 text-xs font-semibold mb-3 flex items-center gap-1.5">
                🌏 BIMSTEC Road Safety
              </div>
              <div className="space-y-2">
                {[
                  { country: '🇮🇳 India',      stat: '4.6L deaths/yr', trend: '↓8%',   color: 'text-orange-400' },
                  { country: '🇧🇩 Bangladesh', stat: '25K deaths/yr', trend: '↑3%',   color: 'text-red-400' },
                  { country: '🇳🇵 Nepal',      stat: '2.4K deaths/yr',trend: '↓12%',  color: 'text-green-400' },
                  { country: '🇱🇰 Sri Lanka',  stat: '3.1K deaths/yr',trend: '↓5%',   color: 'text-blue-400' },
                  { country: '🇲🇲 Myanmar',    stat: '9.5K deaths/yr',trend: '↑1%',   color: 'text-amber-400' },
                  { country: '🇹🇭 Thailand',   stat: '20K deaths/yr', trend: '↓4%',   color: 'text-violet-400' },
                  { country: '🇧🇹 Bhutan',     stat: '320 deaths/yr', trend: '↓15%',  color: 'text-green-400' },
                ].map(({ country, stat, trend, color }) => (
                  <div key={country} className="flex items-center justify-between text-xs">
                    <span className="text-white/50">{country}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white/30">{stat}</span>
                      <span className={`${trend.startsWith('↓') ? 'text-green-400' : 'text-red-400'} font-semibold`}>{trend}</span>
                    </div>
                  </div>
                ))}
                <div className="text-white/15 text-[10px] pt-1 border-t border-white/[0.05]">
                  Source: WHO Global Status Report 2023 · BIMSTEC Transport Working Group
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Bottom links ── */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Link href="/emergency"
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-red-500/20 text-red-400/70 hover:text-red-400 text-xs transition-all hover:bg-red-500/10">
            <AlertTriangle className="w-3.5 h-3.5" /> Emergency Full Mode
          </Link>
          <Link href="/report"
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-amber-500/20 text-amber-400/70 hover:text-amber-400 text-xs transition-all hover:bg-amber-500/10">
            <MapPin className="w-3.5 h-3.5" /> Report Road Issue
          </Link>
          <Link href="/chat"
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-brand-blue-accent/20 text-brand-blue-accent/70 hover:text-brand-blue-accent text-xs transition-all">
            <Zap className="w-3.5 h-3.5" /> AI Assistant
          </Link>
        </div>
      </main>

      {/* SOS Modal */}
      <AnimatePresence>
        {sosModalOpen && (
          <SOSModal
            lat={userLat}
            lon={userLon}
            onClose={() => setSOSModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
