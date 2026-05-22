'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Phone, Navigation, MapPin, Clock, Shield,
  ChevronRight, X, Activity, Share2, Copy, CheckCircle2, Loader2,
  Wrench, Truck,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/lib/hooks/useToast'
import { MapServiceSkeleton } from '@/components/shared/Skeleton'
import { EMERGENCY_NUMBERS, formatDistance, shareLocation } from '@/lib/utils'
import { getEmergencyServices, reverseGeocode, detectRoadType, type EmergencyService, type ServiceType, type RoadTypeResult } from '@/lib/api'
import { GoldenHourProtocol, useGoldenHour } from '@/components/emergency/GoldenHourProtocol'
import { BIMSTECDialer } from '@/components/emergency/BIMSTECDialer'
import { CountryFlag } from '@/components/shared/CountryFlag'
import { CrashModeButton } from '@/components/emergency/CrashMode'
import { AiMap } from '@/components/map/AiMap'
import { useCrashEmergency } from '@/lib/hooks/useCrashEmergency'
import { useShakeDetector }  from '@/lib/hooks/useShakeDetector'
import { ShakeSOSModal }     from '@/components/emergency/ShakeSOSModal'

// ── Smart ETA calculator (replaces fixed 40 km/h) ────────────────────────────
// Uses road type + time-of-day to estimate ambulance response time
function computeSmartEta(distanceM: number, roadType?: RoadTypeResult | null): { seconds: number; label: string } {
  // Base speed by road type (km/h)
  const SPEED_MAP: Record<string, number> = {
    motorway: 70, national: 60, state: 45, primary: 40, local: 30, unknown: 35,
  }
  const baseSpeedKmh = SPEED_MAP[roadType?.type ?? 'unknown'] ?? 35

  // Time-of-day factor: rush hour slower, night faster
  const hour = new Date().getHours()
  let timeFactor = 1.0
  let timeLabel = ''
  if ((hour >= 7 && hour < 10) || (hour >= 17 && hour < 20)) {
    timeFactor = 0.65  // rush hour — heavy traffic
    timeLabel = ' (rush hour)'
  } else if (hour >= 22 || hour < 5) {
    timeFactor = 1.25  // night — empty roads
    timeLabel = ' (night, clear roads)'
  }

  const effectiveSpeedKmh = baseSpeedKmh * timeFactor
  const speedMPerSec = (effectiveSpeedKmh * 1000) / 3600
  const seconds = Math.round(distanceM / speedMPerSec)

  const roadLabel = roadType?.type !== 'unknown' ? ` · ${roadType?.label}` : ''
  const label = `~${effectiveSpeedKmh.toFixed(0)} km/h avg${roadLabel}${timeLabel}`

  return { seconds, label }
}

// ── Leaflet dynamic import (SSR-safe) ─────────────────────────────────────────
// We import leaflet only on the client via useEffect to avoid SSR issues.

// ── Service meta ──────────────────────────────────────────────────────────────

const SERVICE_META: Record<ServiceType, { icon: string; label: string; color: string; mapColor: string }> = {
  hospital:     { icon: '🏥', label: 'Hospital',      color: 'border-blue-500/30 bg-blue-500/5 hover:border-blue-400/50 hover:bg-blue-500/10',   mapColor: '#3b82f6' },
  ambulance:    { icon: '🚑', label: 'Ambulance',     color: 'border-red-500/30 bg-red-500/5 hover:border-red-400/50 hover:bg-red-500/10',       mapColor: '#ef4444' },
  police:       { icon: '🚔', label: 'Police',        color: 'border-indigo-700/30 bg-indigo-700/5 hover:border-indigo-600/50 hover:bg-indigo-700/10', mapColor: '#4338ca' },
  towing:       { icon: '🚗', label: 'Towing',        color: 'border-amber-500/30 bg-amber-500/5 hover:border-amber-400/50 hover:bg-amber-500/10', mapColor: '#f59e0b' },
  puncture_shop:{ icon: '🔧', label: 'Puncture Shop', color: 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400/50 hover:bg-emerald-500/10', mapColor: '#10b981' },
  fuel:         { icon: '⛽', label: 'Fuel Station', color: 'border-violet-500/30 bg-violet-500/5 hover:border-violet-400/50 hover:bg-violet-500/10', mapColor: '#8b5cf6' },
}

const FILTER_TABS: Array<{ key: ServiceType | 'all'; label: string; icon: string }> = [
  { key: 'all',          label: 'All',     icon: '🗺️' },
  { key: 'hospital',     label: 'Hospital',icon: '🏥' },
  { key: 'ambulance',    label: 'Ambulance',icon:'🚑' },
  { key: 'police',       label: 'Police',  icon: '🚔' },
  { key: 'towing',       label: 'Towing',  icon: '🚗' },
  { key: 'puncture_shop',label: 'Puncture',icon: '🔧' },
  { key: 'fuel',         label: 'Fuel',    icon: '⛽' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function CountdownTimer({ seconds }: { seconds: number | null }) {
  const [remaining, setRemaining] = useState(seconds ?? 0)
  useEffect(() => {
    if (seconds !== null) setRemaining(seconds)
  }, [seconds])
  useEffect(() => {
    if (remaining <= 0) return
    const t = setInterval(() => setRemaining(r => Math.max(r - 1, 0)), 1000)
    return () => clearInterval(t)
  }, [remaining])

  if (seconds === null) {
    return (
      <div className="flex items-center gap-2 text-white/40">
        <Activity className="w-5 h-5 animate-pulse" />
        <span className="font-mono text-2xl tracking-widest">Calculating…</span>
      </div>
    )
  }

  const mm = Math.floor(remaining / 60).toString().padStart(2, '0')
  const ss = (remaining % 60).toString().padStart(2, '0')
  return (
    <div className="flex items-center gap-2 text-red-400">
      <Activity className="w-5 h-5 animate-pulse" />
      <span className="font-mono text-3xl font-bold tracking-widest">{mm}:{ss}</span>
    </div>
  )
}

function SOSButton({ number, label, icon }: { number: string; label: string; icon: string }) {
  return (
    <motion.a
      href={`tel:${number}`}
      className="relative flex flex-col items-center justify-center gap-2 p-6 rounded-2xl
                 bg-red-600 border border-red-500/40 text-white overflow-hidden group"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
    >
      <span className="absolute inset-0 rounded-2xl border-2 border-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="text-4xl relative z-10">{icon}</span>
      <div className="relative z-10 text-center">
        <div className="font-mono font-bold text-xl">{number}</div>
        <div className="text-white/70 text-xs">{label}</div>
      </div>
      <Phone className="w-4 h-4 relative z-10" />
    </motion.a>
  )
}

// ── Map component (Leaflet, client-only) ──────────────────────────────────────

function ServicesMap({
  userLat, userLon, services,
}: {
  userLat: number; userLon: number; services: EmergencyService[]
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamically load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Dynamically load Leaflet JS
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.onload = () => {
      const L = (window as unknown as { L: unknown }).L as {
        map: (...args: unknown[]) => unknown
        tileLayer: (...args: unknown[]) => { addTo: (...args: unknown[]) => unknown }
        circleMarker: (...args: unknown[]) => { addTo: (...args: unknown[]) => unknown; bindPopup: (...args: unknown[]) => unknown }
        divIcon: (...args: unknown[]) => unknown
        marker: (...args: unknown[]) => { addTo: (...args: unknown[]) => unknown; bindPopup: (...args: unknown[]) => unknown }
      }

      if (!mapRef.current) return

      const map = L.map(mapRef.current, {
        center: [userLat, userLon] as unknown as never,
        zoom: 14 as unknown as never,
        zoomControl: true as unknown as never,
      }) as unknown as { remove: () => void }

      ;(L.tileLayer as (url: string, opts: unknown) => { addTo: (m: unknown) => void })(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap contributors', maxZoom: 19 }
      ).addTo(map)

      // User pin
      const userMarker = (L.circleMarker as (latlng: number[], opts: unknown) => any)(
        [userLat, userLon],
        { radius: 10, fillColor: '#ffffff', color: '#ef4444', weight: 3, fillOpacity: 1 }
      )
      userMarker.addTo(map)
      userMarker.bindPopup('<b>📍 You are here</b>')

      // Service pins
      services.forEach(svc => {
        const meta = SERVICE_META[svc.type]
        if (!meta) return
        const icon = (L.divIcon as (opts: unknown) => unknown)({
          html: `<div style="
            font-size:22px;
            background:rgba(0,0,0,0.7);
            border:2px solid ${meta.mapColor};
            border-radius:50%;
            width:36px;height:36px;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 8px ${meta.mapColor}88;
          ">${meta.icon}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          className: '',
        })
        const svcMarker = (L.marker as (latlng: number[], opts: unknown) => any)(
          [svc.lat, svc.lon],
          { icon }
        )
        svcMarker.addTo(map)
        svcMarker.bindPopup(`
          <b>${svc.name}</b><br/>
          ${formatDistance(svc.distance_m)} away<br/>
          ${svc.phone ? `📞 ${svc.phone}` : ''}
        `)
      })

      mapInstanceRef.current = map
    }
    document.head.appendChild(script)

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="glass-card border border-white/[0.08] overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
        <MapPin className="w-4 h-4 text-blue-400" />
        <span className="text-white/60 text-xs font-medium">Nearby Services Map</span>
        <span className="ml-auto text-white/30 text-xs">{services.length} pinned</span>
      </div>
      <div ref={mapRef} style={{ height: '280px', width: '100%' }} />
    </div>
  )
}

// ── Share location button ─────────────────────────────────────────────────────

function ShareLocationButton({
  lat, lon, address
}: {
  lat: number; lon: number; address?: string
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [label, setLabel] = useState('Share My Location with Emergency Contacts')

  const handleShare = async () => {
    setState('loading')
    try {
      const method = await shareLocation(lat, lon, address)
      const labels: Record<string, string> = {
        native:    'Shared via your device ✓',
        whatsapp:  'Opening WhatsApp… ✓',
        sms:       'Opening SMS… ✓',
        clipboard: 'Copied to clipboard ✓',
      }
      setLabel(labels[method] ?? 'Shared ✓')
      setState('done')
      setTimeout(() => { setLabel('Share My Location with Emergency Contacts'); setState('idle') }, 3000)
    } catch {
      setLabel('Could not share — copy the maps link manually')
      setState('idle')
    }
  }

  return (
    <div className="space-y-2">
      <motion.button
        onClick={handleShare}
        disabled={state === 'loading'}
        className="w-full py-3.5 rounded-xl border border-white/15 text-white/70 hover:text-white
                   hover:border-white/30 hover:bg-white/5 text-sm flex items-center justify-center
                   gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        whileTap={{ scale: 0.98 }}
      >
        {state === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : state === 'done' ? (
          <CheckCircle2 className="w-4 h-4 text-green-400" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
        {label}
      </motion.button>

      {/* Fallback WhatsApp + copy row */}
      <div className="flex gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            `🚨 I need help!\n📍 ${address ?? 'See location:'} https://maps.google.com/?q=${lat},${lon}`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2.5 rounded-lg bg-green-600/10 border border-green-500/20 text-green-400
                     text-xs font-medium text-center hover:bg-green-600/20 transition-all"
        >
          📱 WhatsApp
        </a>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(
              `🚨 Emergency! My location: https://maps.google.com/?q=${lat},${lon}`
            )
          }}
          className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/50
                     text-xs font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-1"
        >
          <Copy className="w-3 h-3" /> Copy Link
        </button>
        <a
          href={`sms:?body=${encodeURIComponent(
            `🚨 I need help! My location: https://maps.google.com/?q=${lat},${lon}`
          )}`}
          className="flex-1 py-2.5 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400
                     text-xs font-medium text-center hover:bg-blue-600/20 transition-all"
        >
          💬 SMS
        </a>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmergencyPage() {
  const router = useRouter()
  const [activated, setActivated] = useState(false)
  const { onCrashActivate } = useCrashEmergency()
  const [location, setLocation] = useState<{ lat: number; lon: number; address?: string } | null>(null)
  const [services, setServices] = useState<EmergencyService[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [country, setCountry] = useState<keyof typeof EMERGENCY_NUMBERS>('India')
  const [filter, setFilter] = useState<ServiceType | 'all'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [dataSource, setDataSource] = useState<'overpass' | 'fallback' | null>(null)
  const [estimatedEtaSeconds, setEstimatedEtaSeconds] = useState<number | null>(null)
  const [etaLabel, setEtaLabel] = useState<string>('')
  const [roadType, setRoadType] = useState<RoadTypeResult | null>(null)

  // Read severity from URL params (e.g. ?severity=SERIOUS from chat redirect)
  const searchParams = useSearchParams()
  const urlSeverity = searchParams.get('severity') ?? 'CRITICAL'
  const severityLevel = (['CRITICAL', 'HIGH', 'SERIOUS', 'MILD'].includes(urlSeverity.toUpperCase()))
    ? urlSeverity.toUpperCase() as 'CRITICAL' | 'HIGH'
    : 'CRITICAL'

  // Golden Hour protocol — auto-triggers on crash mode activation
  const { toast } = useToast()

  // ── Shake-to-SOS ──────────────────────────────────────────────────────────
  const [showShakeModal, setShowShakeModal] = useState(false)
  useShakeDetector({
    onShake: () => setShowShakeModal(true),
    threshold: 18, requiredShakes: 3, windowMs: 1500,
  })
  const handleShakeConfirm = () => {
    setShowShakeModal(false)
    activateCrashMode()
    toast.emergency('🚨 SOS via shake — crash mode activated!')
  }
  const { show: showGoldenHour, dismiss: dismissGoldenHour, activate: activateGoldenHour } = useGoldenHour()

  const activateCrashMode = useCallback(async () => {
    setActivated(true)
    setLoadingServices(true)
    // Trigger golden hour protocol immediately — don't wait for GPS
    activateGoldenHour()
    toast.emergency('🚨 SOS Activated — locating emergency services…')
    // Redirect map to crisis mode so it shows forceEmergency
    router.prefetch('/map?crisis=true')

    navigator.geolocation?.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude

        // Persist to sessionStorage so /map picks up crash state automatically
        onCrashActivate(lat, lon)

        // Reverse geocode + services + road type in parallel
        const [address, svcResult, roadResult] = await Promise.allSettled([
          reverseGeocode(lat, lon),
          getEmergencyServices(lat, lon),
          detectRoadType(lat, lon),
        ])

        const resolvedAddress = address.status === 'fulfilled' ? address.value : 'Your location'
        setLocation({ lat, lon, address: resolvedAddress })

        const detectedRoad = roadResult.status === 'fulfilled' ? roadResult.value : null
        setRoadType(detectedRoad)

        if (svcResult.status === 'fulfilled') {
          setServices(svcResult.value.results)
          setDataSource(svcResult.value.source)
          // Smart ETA using road type + time-of-day
          const nearest = svcResult.value.results.find(
            s => s.type === 'ambulance' || s.type === 'hospital'
          )
          if (nearest && nearest.distance_m > 0) {
            const eta = computeSmartEta(nearest.distance_m, detectedRoad)
            setEstimatedEtaSeconds(eta.seconds)
            setEtaLabel(eta.label)
          } else {
            setEstimatedEtaSeconds(null)
          }
        }
        setLoadingServices(false)
      },
      async () => {
        // Geolocation denied — use Indore demo coords
        const demoLat = 22.7196, demoLon = 75.8577
        setLocation({ lat: demoLat, lon: demoLon, address: 'Vijay Nagar, Indore, MP (Demo)' })
        const svcResult = await getEmergencyServices(demoLat, demoLon)
        setServices(svcResult.results)
        setDataSource(svcResult.source)
        setLoadingServices(false)
      },
      { timeout: 10_000, enableHighAccuracy: true }
    )
  }, [activateGoldenHour])

  const nums = EMERGENCY_NUMBERS[country] || EMERGENCY_NUMBERS.India
  const filteredServices = filter === 'all'
    ? services
    : services.filter(s => s.type === filter)

  return (
    <>
    <div className="min-h-screen relative overflow-hidden">
      {/* Siren BG */}
      <AnimatePresence>
        {activated && (
          <motion.div
            className="fixed inset-0 pointer-events-none z-0"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <div className="absolute inset-0 animate-siren" />
            <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-[#0c1222] to-[#0c1222]" />
          </motion.div>
        )}
      </AnimatePresence>

      {!activated && (
        <div className="fixed inset-0 bg-gradient-to-b from-[#1a0505] via-[#0c1222] to-[#0c1222] pointer-events-none" />
      )}

      {/* Header */}
      <div className="relative z-10">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06] bg-[#0c1222]/60 backdrop-blur-sm">
          <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
            <span className="text-sm">Exit Emergency</span>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500 animate-pulse" />
            <span className="font-bold text-red-500 tracking-wide text-sm">
              {activated ? 'CRASH MODE ACTIVE' : 'EMERGENCY MODE'}
            </span>
          </div>
          <div className="w-28" />
        </div>

        <div className="max-w-3xl mx-auto px-4 py-6">
          {!activated ? (
            /* ── Pre-activation ── */
            <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <motion.div
                className="text-8xl mb-6 inline-block"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                🚨
              </motion.div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Emergency <span className="text-red-500">Response</span>
              </h1>
              <p className="text-white/60 mb-10 max-w-md mx-auto text-lg">
                Instantly locate hospitals, ambulances, police, towing services & puncture shops near you.
              </p>

              {/* Country selector — SVG flag pills */}
              <div className="flex flex-wrap justify-center gap-2 mb-10">
                {Object.keys(EMERGENCY_NUMBERS).map(c => (
                  <motion.button
                    key={c}
                    onClick={() => setCountry(c as keyof typeof EMERGENCY_NUMBERS)}
                    whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.93 }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                      country === c
                        ? 'bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                        : 'bg-white/[0.04] border-white/10 text-white/55 hover:text-white hover:border-white/25'
                    }`}
                  >
                    <span className="rounded-[2px] overflow-hidden" style={{ lineHeight: 0 }}>
                      <CountryFlag country={c} size={16} />
                    </span>
                    <span>{c}</span>
                  </motion.button>
                ))}
              </div>
              </div>

              {/* Quick dial */}
              <div className="bg-white/[0.04] border border-red-500/15 rounded-2xl p-4">
                <div className="text-white/50 text-xs mb-3 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> One-Tap Emergency Call
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { num: nums.emergency, label: 'Emergency', emoji: '🆘' },
                    { num: nums.ambulance, label: 'Ambulance',  emoji: '🚑' },
                    { num: nums.police,    label: 'Police',     emoji: '🚔' },
                  ].map(({ num, label, emoji }) => (
                    <a
                      key={num}
                      href={`tel:${num}`}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-red-500/10
                                 border border-red-500/25 hover:bg-red-500/20 active:scale-95
                                 transition-all text-center"
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className="font-mono font-bold text-red-400 text-base">{num}</span>
                      <span className="text-white/50 text-xs">{label}</span>
                    </a>
                  ))}
                </div>
                {/* Highway helpline */}
                <a
                  href={`tel:${nums.highway}`}
                  className="mt-2 w-full flex items-center justify-between py-2 px-3 rounded-lg
                             bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                >
                  <span className="text-amber-400 text-xs flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Highway / NHAI Helpline
                  </span>
                  <span className="font-mono text-amber-400 font-bold text-sm">{nums.highway}</span>
                </a>
              </div>

              {/* ── BIMSTEC EMERGENCY DIALER — quick-dial for all 7 nations ── */}
              <BIMSTECDialer activeCountry={country ?? 'India'} />

              {/* ── GOLDEN HOUR PROTOCOL — auto-triggered on crash activation ── */}
              <GoldenHourProtocol
                isVisible={showGoldenHour}
                onDismiss={dismissGoldenHour}
                severity={severityLevel}
                emergencyNumber={nums.emergency}
              />

              {/* Filter + view mode tabs */}
              <div className="flex flex-col gap-2">
                {/* Service type filter */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {FILTER_TABS.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setFilter(tab.key as ServiceType | 'all')}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                        filter === tab.key
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/70'
                      }`}
                    >
                      {tab.icon} {tab.label}
                      {tab.key !== 'all' && (
                        <span className="ml-1 opacity-60">
                          ({services.filter(s => s.type === tab.key).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content: enhanced CrowdsourcedMap or list */}
              {loadingServices ? (
                <div className="px-1 pt-2">
                  <MapServiceSkeleton />
                </div>
              ) : location ? (
                <AiMap
                  mode="sos"
                  userLat={location.lat}
                  userLon={location.lon}
                  height={380}
                  showModeSwitcher={false}
                  crashMode={true}
                  onSOSActivated={(lat, lon) => {
                    // Already in crash mode — just ensure SOS is shared
                    shareLocation(lat, lon, location.address)
                  }}
                />
              ) : null}

              {/* Share location */}
              {location && (
                <div className="pb-8">
                  <ShareLocationButton lat={location.lat} lon={location.lon} address={location.address} />
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>

      {/* Shake-to-SOS modal */}
      <ShakeSOSModal
        isOpen={showShakeModal}
        onConfirm={handleShakeConfirm}
        onDismiss={() => setShowShakeModal(false)}
        autoConfirmMs={4000}
      />
    </>
  )
}
