'use client'

/**
 * AiMap.tsx  — Unified Intelligent Map Component
 * ════════════════════════════════════════════════
 * Three operating modes on a single Leaflet canvas:
 *
 *   🚨 RoadSoS   — Emergency services, SOS beacon, ETA countdown
 *   🗺️ RoadWatch — Road issue heatmap, clustered markers, complaint tracker
 *   ⚖️ DriveLegal — Black spots, speed/helmet cameras, geo-fence alerts
 *
 * Architecture:
 *  • Leaflet loaded dynamically (SSR-safe) via script injection
 *  • Leaflet.heat CDN for heatmap layers
 *  • All marker icons are SVG divIcons — zero external image deps
 *  • Offline-first: falls back to Indore demo data if API unavailable
 *  • Geo-fence worker runs every 5 s to check proximity to cameras/zones
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Phone, Navigation, MapPin, Clock, Shield,
  X, Loader2, Filter, Layers, List, Map, Zap,
  Camera, AlertCircle, Eye, Radio, Share2, Copy, CheckCheck,
  ChevronRight, Activity,
} from 'lucide-react'
import {
  getMapServices, getMapIssues, getMapHotspots,
  type MapService, type MapIssue, type BlackSpot,
  type SpeedCamera, type ViolationZone, type MapServicesResult,
  type MapIssuesResult, type MapHotspotsResult,
} from '@/lib/api'
import { formatDistance } from '@/lib/utils'

// ── Design tokens (mirror the app design system) ──────────────────────────────

export type MapMode = 'sos' | 'roadwatch' | 'drivelegal'

const MODE_META: Record<MapMode, {
  label: string; emoji: string; color: string; bg: string; border: string; glow: string
}> = {
  sos:       { label: 'RoadSoS',    emoji: '🚨', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     glow: '#ef4444' },
  roadwatch: { label: 'RoadWatch',  emoji: '🗺️', color: 'text-amber-400',  bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   glow: '#f59e0b' },
  drivelegal:{ label: 'DriveLegal', emoji: '⚖️', color: 'text-violet-400', bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  glow: '#8b5cf6' },
}

const SERVICE_META: Record<string, { emoji: string; mapColor: string; label: string; border: string }> = {
  hospital:      { emoji: '🏥', mapColor: '#3b82f6', label: 'Hospital',      border: 'border-blue-500/30 bg-blue-500/5' },
  ambulance:     { emoji: '🚑', mapColor: '#ef4444', label: 'Ambulance',     border: 'border-red-500/30 bg-red-500/5' },
  police:        { emoji: '🚔', mapColor: '#6366f1', label: 'Police',        border: 'border-indigo-500/30 bg-indigo-500/5' },
  towing:        { emoji: '🚗', mapColor: '#f59e0b', label: 'Towing',        border: 'border-amber-500/30 bg-amber-500/5' },
  puncture_shop: { emoji: '🔧', mapColor: '#10b981', label: 'Puncture Shop', border: 'border-emerald-500/30 bg-emerald-500/5' },
  fuel:          { emoji: '⛽', mapColor: '#8b5cf6', label: 'Fuel Station',  border: 'border-violet-500/30 bg-violet-500/5' },
}

const ISSUE_META: Record<string, { emoji: string; mapColor: string; label: string }> = {
  pothole:        { emoji: '🕳️', mapColor: '#ef4444', label: 'Pothole' },
  road_damage:    { emoji: '⚠️', mapColor: '#f97316', label: 'Road Damage' },
  bad_lighting:   { emoji: '💡', mapColor: '#facc15', label: 'Bad Lighting' },
  broken_signal:  { emoji: '🚦', mapColor: '#a855f7', label: 'Broken Signal' },
  construction:   { emoji: '🏗️', mapColor: '#64748b', label: 'Construction' },
  flooding:       { emoji: '🌊', mapColor: '#06b6d4', label: 'Flooding' },
  missing_sign:   { emoji: '🪧', mapColor: '#78716c', label: 'Missing Sign' },
  other:          { emoji: '📝', mapColor: '#6b7280', label: 'Other Issue' },
}

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  pending:    { label: 'Pending',     color: 'text-red-400',    dot: '#ef4444' },
  in_progress:{ label: 'In Progress', color: 'text-amber-400',  dot: '#f59e0b' },
  resolved:   { label: 'Resolved',    color: 'text-green-400',  dot: '#22c55e' },
  rejected:   { label: 'Rejected',    color: 'text-white/30',   dot: '#6b7280' },
}

const CAMERA_META: Record<string, { emoji: string; color: string; label: string }> = {
  speed:    { emoji: '📷', color: '#ef4444', label: 'Speed Camera' },
  helmet:   { emoji: '🪖', color: '#f59e0b', label: 'Helmet Camera' },
  redlight: { emoji: '🚦', color: '#a855f7', label: 'Red-Light Camera' },
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AiMapProps {
  mode?: MapMode
  userLat?: number
  userLon?: number
  height?: number
  showModeSwitcher?: boolean
  /** Crash Mode: auto-zoom to nearest hospital + show SOS beacon */
  crashMode?: boolean
  onSOSActivated?: (lat: number, lon: number) => void
  className?: string
}

// ── Utility ───────────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtETA(min: number): string {
  if (min < 1) return '<1 min'
  if (min < 60) return `~${min} min`
  return `~${Math.round(min / 60)}h`
}

// ── SOS Share button ──────────────────────────────────────────────────────────

function ShareSOSButton({ lat, lon }: { lat: number; lon: number }) {
  const [copied, setCopied] = useState(false)
  const url = `https://maps.google.com/?q=${lat},${lon}`
  const msg = `🚨 EMERGENCY — I need help!\n📍 Location: ${url}\n⏰ ${new Date().toLocaleTimeString()}`

  const copy = async () => {
    await navigator.clipboard.writeText(msg)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={copy}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs hover:bg-red-500/20 transition-all"
      >
        {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Copy SOS Link'}
      </button>
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          onClick={() => navigator.share({ title: 'SOS Emergency', text: msg })}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs hover:bg-red-500/20 transition-all"
        >
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      )}
    </div>
  )
}

// ── Proximity Alert banner ────────────────────────────────────────────────────

interface Alert { id: string; msg: string; type: 'camera' | 'zone' | 'blackspot' }

function ProximityAlert({ alerts, onDismiss }: { alerts: Alert[]; onDismiss: (id: string) => void }) {
  if (!alerts.length) return null
  return (
    <div className="absolute top-14 left-2 right-2 z-[600] space-y-1.5 pointer-events-none">
      <AnimatePresence>
        {alerts.map(a => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`pointer-events-auto flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-medium
              ${a.type === 'camera' ? 'bg-red-900/90 border-red-500/50 text-red-200' :
                a.type === 'blackspot' ? 'bg-orange-900/90 border-orange-500/50 text-orange-200' :
                'bg-violet-900/90 border-violet-500/50 text-violet-200'
              } backdrop-blur-sm`}
          >
            <span className="text-base">{a.type === 'camera' ? '📷' : a.type === 'blackspot' ? '⚠️' : '🚫'}</span>
            <span className="flex-1">{a.msg}</span>
            <button onClick={() => onDismiss(a.id)} className="opacity-50 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AiMap({
  mode: initialMode = 'sos',
  userLat: propLat,
  userLon: propLon,
  height = 420,
  showModeSwitcher = true,
  crashMode = false,
  onSOSActivated,
  className = '',
}: AiMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const heatLayerRef = useRef<unknown>(null)
  const markersGroupRef = useRef<unknown>(null)

  const [mode, setMode] = useState<MapMode>(initialMode)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [mapReady, setMapReady] = useState(false)
  const [loading, setLoading] = useState(false)

  // Location
  const [userLat, setUserLat] = useState(propLat ?? 22.7196)
  const [userLon, setUserLon] = useState(propLon ?? 75.8577)
  const [locationLabel, setLocationLabel] = useState<string>('')
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)

  // Data
  const [services, setServices]           = useState<MapService[]>([])
  const [issues, setIssues]               = useState<MapIssue[]>([])
  const [blackspots, setBlackspots]       = useState<BlackSpot[]>([])
  const [cameras, setCameras]             = useState<SpeedCamera[]>([])
  const [violationZones, setViolationZones] = useState<ViolationZone[]>([])
  const [dataSource, setDataSource]       = useState<string>('')

  // Filters
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all')
  const [issueStatusFilter, setIssueStatusFilter] = useState<string>('all')

  // UI state
  const [selectedService, setSelectedService] = useState<MapService | null>(null)
  const [selectedIssue, setSelectedIssue]     = useState<MapIssue | null>(null)
  const [alerts, setAlerts]                   = useState<Alert[]>([])
  const [sosBeaconActive, setSOSBeaconActive] = useState(false)
  const [countsType, setCountsType]           = useState<Record<string, number>>({})
  const [countsStatus, setCountsStatus]       = useState<Record<string, number>>({})

  // ── New Enhancement States ─────────────────────────────────────────────────
  // Heatmap + layer controls
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showBlackSpots, setShowBlackSpots] = useState(true)
  const [authorityView, setAuthorityView] = useState(false)
  const [showRouteAnalyzer, setShowRouteAnalyzer] = useState(false)
  const [routeSrc, setRouteSrc] = useState('')
  const [routeDst, setRouteDst] = useState('')
  const [routeResult, setRouteResult] = useState<{
    riskScore: number; riskLabel: string; distance: string; hotspots: number; recommendation: string
  } | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)

  // ── GPS ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (propLat && propLon) {
      setUserLat(propLat)
      setUserLon(propLon)
      return
    }
    navigator.geolocation?.getCurrentPosition(
      p => {
        setUserLat(p.coords.latitude)
        setUserLon(p.coords.longitude)
        setGpsAccuracy(p.coords.accuracy)
      },
      () => {
        setLocationLabel('Indore, MP (Demo)')
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [propLat, propLon])

  // ── Data fetching ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (mode === 'sos') {
        const r = await getMapServices(userLat, userLon, serviceFilter)
        setServices(r.services)
        setDataSource(r.source === 'overpass' ? '✓ Live OSM data' : '⚠ Demo data')
      } else if (mode === 'roadwatch') {
        const r = await getMapIssues(userLat, userLon, 10000, issueTypeFilter, issueStatusFilter)
        setIssues(r.issues)
        setCountsType(r.counts_by_type)
        setCountsStatus(r.counts_by_status)
        setDataSource(`${r.count} issues found`)
      } else if (mode === 'drivelegal') {
        const r = await getMapHotspots(userLat, userLon)
        setBlackspots(r.blackspots)
        setCameras(r.cameras)
        setViolationZones(r.violation_zones)
        setDataSource(`${r.blackspots.length} black spots · ${r.cameras.length} cameras`)
      }
    } catch (e) {
      console.warn('Map data fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [mode, userLat, userLon, serviceFilter, issueTypeFilter, issueStatusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Proximity geo-fence (DriveLegal) ─────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'drivelegal') return
    const check = () => {
      const newAlerts: Alert[] = []
      cameras.forEach(cam => {
        const dist = haversine(userLat, userLon, cam.lat, cam.lon)
        if (dist < cam.alert_radius_m) {
          newAlerts.push({
            id: cam.id,
            msg: `${CAMERA_META[cam.type]?.label || 'Camera'} ahead: ${cam.name}${cam.speed_limit_kmh ? ` · Limit: ${cam.speed_limit_kmh} km/h` : ''}`,
            type: 'camera',
          })
        }
      })
      blackspots.forEach(bs => {
        const dist = haversine(userLat, userLon, bs.lat, bs.lon)
        if (dist < bs.alert_radius_m) {
          newAlerts.push({
            id: bs.id,
            msg: `⚠ Accident black spot: ${bs.name}`,
            type: 'blackspot',
          })
        }
      })
      violationZones.forEach(zone => {
        const dist = haversine(userLat, userLon, zone.lat, zone.lon)
        if (dist < zone.radius_m + 100) {
          newAlerts.push({
            id: zone.id,
            msg: `Entering ${zone.name} · Fine: ${zone.fine_inr}`,
            type: 'zone',
          })
        }
      })
      if (newAlerts.length) {
        setAlerts(prev => {
          const existingIds = new Set(prev.map(a => a.id))
          const fresh = newAlerts.filter(a => !existingIds.has(a.id))
          return [...prev, ...fresh].slice(-4)
        })
      }
    }
    check()
    const t = setInterval(check, 5000)
    return () => clearInterval(t)
  }, [mode, userLat, userLon, cameras, blackspots, violationZones])

  // ── Leaflet bootstrap ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || viewMode !== 'map') return

    const loadLeaflet = () => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      const loadScript = (src: string, id: string): Promise<void> =>
        new Promise((res, rej) => {
          if (document.getElementById(id)) { res(); return }
          const s = document.createElement('script')
          s.id = id; s.src = src; s.async = true
          s.onload = () => res()
          s.onerror = rej
          document.head.appendChild(s)
        })

      loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'leaflet-js')
        .then(() => loadScript('https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js', 'leaflet-heat-js'))
        .then(() => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const L = (window as any).L
          if (!mapRef.current) return

          const map = L.map(mapRef.current, {
            center: [userLat, userLon],
            zoom: crashMode ? 16 : 14,
            zoomControl: true,
            attributionControl: false,
          })

          // Dark CARTO tiles
          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
          }).addTo(map)

          // User dot + accuracy ring
          const userIcon = L.divIcon({
            html: `<div style="
              width:16px;height:16px;border-radius:50%;
              background:#FF6200;border:3px solid #fff;
              box-shadow:0 0 0 4px rgba(255,98,0,0.3),0 0 20px rgba(255,98,0,0.6);
            "></div>`,
            iconSize: [16, 16], iconAnchor: [8, 8], className: '',
          })
          L.marker([userLat, userLon], { icon: userIcon })
            .addTo(map)
            .bindPopup('<b style="color:#FF6200">📍 You are here</b>')

          if (gpsAccuracy) {
            L.circle([userLat, userLon], {
              radius: gpsAccuracy,
              color: '#FF6200', weight: 1, opacity: 0.4,
              fillColor: '#FF6200', fillOpacity: 0.06,
            }).addTo(map)
          }

          // SOS beacon animation ring (crash mode)
          if (crashMode || sosBeaconActive) {
            L.circle([userLat, userLon], {
              radius: 80,
              color: '#ef4444', weight: 2, opacity: 0.8,
              fillColor: '#ef4444', fillOpacity: 0.15,
              className: 'sos-ring',
            }).addTo(map)
          }

          markersGroupRef.current = L.layerGroup().addTo(map)
          mapInstanceRef.current = map
          setMapReady(true)
        })
    }

    loadLeaflet()

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as any).remove()
        mapInstanceRef.current = null
        markersGroupRef.current = null
        heatLayerRef.current = null
        setMapReady(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  // ── Layer rendering ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return
    const L = (window as any).L
    const map = mapInstanceRef.current as any
    const group = markersGroupRef.current as any

    // Clear previous layer
    group?.clearLayers()
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }

    if (mode === 'sos') {
      // ── RoadSoS markers ────────────────────────────────────────────────────
      const filtered = serviceFilter === 'all'
        ? services
        : services.filter(s => s.type === serviceFilter)

      filtered.forEach(svc => {
        const meta = SERVICE_META[svc.type]
        if (!meta) return
        const icon = L.divIcon({
          html: `<div style="
            font-size:16px;background:rgba(10,22,40,0.95);
            border:2px solid ${meta.mapColor};border-radius:50%;
            width:32px;height:32px;display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 10px ${meta.mapColor}66;cursor:pointer;
          ">${meta.emoji}</div>`,
          iconSize: [32, 32], iconAnchor: [16, 16], className: '',
        })
        const marker = L.marker([svc.lat, svc.lon], { icon }).addTo(group)
        marker.bindPopup(`
          <div style="min-width:180px;font-family:system-ui;padding:4px">
            <div style="color:${meta.mapColor};font-weight:700;font-size:14px;margin-bottom:6px">
              ${meta.emoji} ${svc.name}
            </div>
            <div style="color:#9ca3af;font-size:12px;margin-bottom:4px">
              ${meta.label} · ${formatDistance(svc.distance_m)} away
            </div>
            ${svc.eta_min ? `<div style="color:#fbbf24;font-size:12px;margin-bottom:6px">⏱ ETA: ${fmtETA(svc.eta_min)}</div>` : ''}
            ${svc.phone ? `<a href="tel:${svc.phone}" style="display:block;color:#4ade80;font-size:12px;margin-bottom:8px">📞 ${svc.phone}</a>` : ''}
            <div style="display:flex;gap:6px;margin-top:6px">
              ${svc.phone ? `<a href="tel:${svc.phone}" style="flex:1;text-align:center;padding:6px;background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.3);border-radius:8px;color:#4ade80;font-size:11px;text-decoration:none">📞 Call Now</a>` : ''}
              <a href="${svc.maps_url}" target="_blank" style="flex:1;text-align:center;padding:6px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:8px;color:#60a5fa;font-size:11px;text-decoration:none">🗺 Directions</a>
            </div>
          </div>
        `)
        marker.on('click', () => setSelectedService(svc))
      })

      // Auto-zoom to nearest hospital on crash mode
      if (crashMode && filtered.length > 0) {
        const nearest = filtered[0]
        map.flyTo([nearest.lat, nearest.lon], 15, { duration: 1.2 })
      }

    } else if (mode === 'roadwatch') {
      // ── RoadWatch heatmap + markers ────────────────────────────────────────
      const filtered = issues.filter(i =>
        (issueTypeFilter === 'all' || i.type === issueTypeFilter) &&
        (issueStatusFilter === 'all' || i.status === issueStatusFilter)
      )

      // Heatmap layer
      const heatData = filtered.map(i => [i.lat, i.lon, _issueWeight(i)])
      if (showHeatmap && (window as any).L.heatLayer && heatData.length > 0) {
        const heat = (window as any).L.heatLayer(heatData, {
          radius: 35, blur: 20, maxZoom: 17,
          gradient: { 0.2: '#1d4ed8', 0.4: '#f59e0b', 0.6: '#f97316', 0.8: '#ef4444', 1.0: '#dc2626' },
        })
        heat.addTo(map)
        heatLayerRef.current = heat
      }

      // Clustered markers
      filtered.forEach(issue => {
        const meta = ISSUE_META[issue.type] || ISSUE_META.other
        const statusMeta = STATUS_META[issue.status] || STATUS_META.pending
        const icon = L.divIcon({
          html: `<div style="
            font-size:14px;background:rgba(10,22,40,0.95);
            border:2px solid ${meta.mapColor};border-radius:6px;
            width:28px;height:28px;display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 8px ${meta.mapColor}55;cursor:pointer;
          ">${meta.emoji}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14], className: '',
        })
        const marker = L.marker([issue.lat, issue.lon], { icon }).addTo(group)
        marker.bindPopup(`
          <div style="min-width:200px;font-family:system-ui;padding:4px">
            <div style="color:${meta.mapColor};font-weight:700;font-size:13px;margin-bottom:4px">
              ${meta.emoji} ${meta.label}
            </div>
            <div style="color:#d1d5db;font-size:12px;margin-bottom:4px">${issue.description}</div>
            <div style="display:flex;gap:8px;margin-bottom:6px">
              <span style="color:${statusMeta.dot};font-size:11px">● ${statusMeta.label}</span>
              <span style="color:#6b7280;font-size:11px">Ticket: ${issue.id}</span>
            </div>
            <div style="color:#9ca3af;font-size:11px;margin-bottom:4px">🏢 ${issue.authority}</div>
            ${issue.authority_contact ? `<div style="color:#9ca3af;font-size:11px">📞 ${issue.authority_contact}</div>` : ''}
            ${issue.has_image ? '<div style="color:#60a5fa;font-size:11px;margin-top:4px">📷 Photo attached</div>' : ''}
          </div>
        `)
        marker.on('click', () => setSelectedIssue(issue))
      })

    } else if (mode === 'drivelegal') {
      // ── DriveLegal: black spots, cameras, violation zones ──────────────────

      // Heatmap for accident density
      const heatData = blackspots.map(bs => [bs.lat, bs.lon, bs.severity / 10])
      if (showHeatmap && (window as any).L.heatLayer && heatData.length > 0) {
        const heat = (window as any).L.heatLayer(heatData, {
          radius: 40, blur: 25, maxZoom: 17,
          gradient: { 0.3: '#7c3aed', 0.6: '#dc2626', 0.8: '#ff1744', 1.0: '#ff0000' },
        })
        heat.addTo(map)
        heatLayerRef.current = heat
      }

      // Black spot markers
      blackspots.forEach(bs => {
        const sev = bs.severity
        const color = sev >= 8 ? '#dc2626' : sev >= 6 ? '#f97316' : '#f59e0b'
        const icon = L.divIcon({
          html: `<div style="
            width:36px;height:36px;border-radius:50%;cursor:pointer;
            background:rgba(10,22,40,0.95);border:3px solid ${color};
            display:flex;align-items:center;justify-content:center;
            font-size:18px;box-shadow:0 0 12px ${color}77;
          ">💀</div>`,
          iconSize: [36, 36], iconAnchor: [18, 18], className: '',
        })
        const marker = L.marker([bs.lat, bs.lon], { icon }).addTo(group)
        marker.bindPopup(`
          <div style="min-width:200px;font-family:system-ui;padding:4px">
            <div style="color:${color};font-weight:700;font-size:13px;margin-bottom:4px">
              ⚠️ Black Spot: ${bs.name}
            </div>
            <div style="color:#9ca3af;font-size:11px;margin-bottom:4px">
              Severity: ${'▰'.repeat(bs.severity)}${'▱'.repeat(10 - bs.severity)} ${bs.severity}/10
            </div>
            <div style="color:#d1d5db;font-size:12px">${bs.description}</div>
          </div>
        `)
      })

      // Camera markers
      cameras.forEach(cam => {
        const meta = CAMERA_META[cam.type] || CAMERA_META.speed
        const icon = L.divIcon({
          html: `<div style="
            font-size:15px;background:rgba(10,22,40,0.95);
            border:2px solid ${meta.color};border-radius:4px;
            width:28px;height:28px;display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 8px ${meta.color}66;cursor:pointer;
          ">${meta.emoji}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14], className: '',
        })
        const marker = L.marker([cam.lat, cam.lon], { icon }).addTo(group)
        marker.bindPopup(`
          <div style="min-width:180px;font-family:system-ui;padding:4px">
            <div style="color:${meta.color};font-weight:700;font-size:13px;margin-bottom:4px">
              ${meta.emoji} ${meta.label}
            </div>
            <div style="color:#d1d5db;font-size:12px;margin-bottom:4px">${cam.name}</div>
            ${cam.speed_limit_kmh ? `<div style="color:#fbbf24;font-size:12px">Speed limit: ${cam.speed_limit_kmh} km/h</div>` : ''}
            <div style="color:#9ca3af;font-size:11px;margin-top:4px">🏢 ${cam.operator}</div>
          </div>
        `)
      })

      // Violation zone circles
      violationZones.forEach(zone => {
        const colors: Record<string, string> = {
          speed: '#ef4444', helmet: '#f59e0b', horn: '#22c55e',
          parking: '#3b82f6', multi: '#a855f7',
        }
        const col = colors[zone.type] || '#6b7280'
        L.circle([zone.lat, zone.lon], {
          radius: zone.radius_m,
          color: col, weight: 2, opacity: 0.6,
          fillColor: col, fillOpacity: 0.08,
          dashArray: '6, 4',
        }).addTo(group).bindPopup(`
          <div style="min-width:180px;font-family:system-ui;padding:4px">
            <div style="color:${col};font-weight:700;font-size:13px;margin-bottom:4px">
              🚫 ${zone.name}
            </div>
            <div style="color:#d1d5db;font-size:12px;margin-bottom:4px">${zone.description}</div>
            <div style="color:#f87171;font-size:12px">Fine: ${zone.fine_inr}</div>
          </div>
        `)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, mode, services, issues, blackspots, cameras, violationZones,
      serviceFilter, issueTypeFilter, issueStatusFilter, crashMode, sosBeaconActive, showHeatmap])

  // ── SOS handler ───────────────────────────────────────────────────────────────

  const activateSOS = useCallback(() => {
    setSOSBeaconActive(true)
    onSOSActivated?.(userLat, userLon)
    if (mapInstanceRef.current) {
      (mapInstanceRef.current as any).flyTo([userLat, userLon], 17, { duration: 1 })
    }
  }, [userLat, userLon, onSOSActivated])

  // ── Route Safety Analyzer ──────────────────────────────────────────────────

  const analyzeRoute = useCallback(async () => {
    if (!routeSrc.trim() || !routeDst.trim()) return
    setRouteLoading(true)
    // Mock route risk analysis (would call Gemini/routing API in production)
    await new Promise(resolve => setTimeout(resolve, 1200))
    const hotspots = blackspots.filter(bs => bs.severity >= 6).length
    const pendingIssues = issues.filter(i => i.status === 'pending').length
    const riskScore = Math.min(100, Math.round(
      hotspots * 15 + pendingIssues * 3 + Math.random() * 20
    ))
    const riskLabel = riskScore >= 70 ? 'HIGH RISK' : riskScore >= 40 ? 'MODERATE' : 'LOW RISK'
    const distance = `${(Math.random() * 12 + 3).toFixed(1)} km`
    const recommendation = riskScore >= 70
      ? 'Avoid NH-52 stretch near Ring Road — 3 black spots detected. Use Ring Road bypass via Rau.'
      : riskScore >= 40
      ? 'Route has moderate hazards. Proceed with caution near Vijay Nagar signal junction.'
      : 'Route is relatively safe. Standard precautions apply.'
    setRouteResult({ riskScore, riskLabel, distance, hotspots, recommendation })
    setRouteLoading(false)
  }, [routeSrc, routeDst, blackspots, issues])

  // ── Mode switch ───────────────────────────────────────────────────────────────

  const switchMode = (newMode: MapMode) => {
    setMode(newMode)
    setSelectedService(null)
    setSelectedIssue(null)
    setViewMode('map')
  }

  // ── Filtered lists for list view ───────────────────────────────────────────

  const filteredServices = serviceFilter === 'all' ? services : services.filter(s => s.type === serviceFilter)
  const filteredIssues = issues.filter(i =>
    (issueTypeFilter === 'all' || i.type === issueTypeFilter) &&
    (issueStatusFilter === 'all' || i.status === issueStatusFilter)
  )

  const m = MODE_META[mode]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`glass-card overflow-hidden rounded-2xl flex flex-col ${className}`}>

      {/* ── Mode switcher ── */}
      {showModeSwitcher && (
        <div className="flex gap-1 p-2 border-b border-white/[0.06] bg-brand-blue/60 shrink-0">
          {(Object.entries(MODE_META) as [MapMode, typeof MODE_META[MapMode]][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => switchMode(k)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                mode === k
                  ? `${v.bg} ${v.border} border ${v.color}`
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              <span>{v.emoji}</span>
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">{m.emoji}</span>
          <span className={`font-semibold text-sm ${m.color}`}>{m.label}</span>
          {dataSource && (
            <span className="text-white/25 text-xs hidden sm:inline">· {dataSource}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Route Analyzer toggle — roadwatch mode */}
          {mode === 'roadwatch' && (
            <button
              onClick={() => setShowRouteAnalyzer(!showRouteAnalyzer)}
              title="Route Safety Analyzer"
              className={`p-1.5 rounded-lg text-xs transition-all ${
                showRouteAnalyzer
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'hover:bg-white/10 text-white/30 hover:text-white/70'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Heatmap toggle */}
          {(mode === 'roadwatch' || mode === 'drivelegal') && (
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              title={showHeatmap ? 'Hide heatmap' : 'Show heatmap'}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                showHeatmap
                  ? `${m.bg} ${m.color} border ${m.border}`
                  : 'hover:bg-white/10 text-white/30 hover:text-white/70'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Authority Dashboard toggle */}
          <button
            onClick={() => setAuthorityView(!authorityView)}
            title="Authority Dashboard"
            className={`p-1.5 rounded-lg text-xs transition-all ${
              authorityView
                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                : 'hover:bg-white/10 text-white/30 hover:text-white/70'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
          </button>
          {/* View toggle */}
          <div className="flex bg-white/5 rounded-lg p-0.5">
            {(['map', 'list'] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-2 py-1 rounded-md text-xs transition-all ${
                  viewMode === v ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'
                }`}
              >
                {v === 'map' ? <Map className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-all"
            title="Refresh"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Route Safety Analyzer ── */}
      <AnimatePresence>
        {showRouteAnalyzer && mode === 'roadwatch' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-amber-500/20 shrink-0"
          >
            <div className="p-3 bg-amber-500/[0.04] space-y-2">
              <div className="text-amber-400 text-xs font-semibold flex items-center gap-1.5 mb-1">
                <Navigation className="w-3.5 h-3.5" /> Route Safety Analyzer
              </div>
              <div className="flex gap-2">
                <input
                  value={routeSrc}
                  onChange={e => setRouteSrc(e.target.value)}
                  placeholder="From (e.g. Vijay Nagar)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
                />
                <input
                  value={routeDst}
                  onChange={e => setRouteDst(e.target.value)}
                  placeholder="To (e.g. Airport)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
                />
                <button
                  onClick={analyzeRoute}
                  disabled={routeLoading || !routeSrc.trim() || !routeDst.trim()}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {routeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Analyze'}
                </button>
              </div>
              <AnimatePresence>
                {routeResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`text-xs font-black px-2 py-0.5 rounded-full border ${
                          routeResult.riskScore >= 70 ? 'text-red-400 border-red-500/30 bg-red-500/10'
                          : routeResult.riskScore >= 40 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                          : 'text-green-400 border-green-500/30 bg-green-500/10'
                        }`}>
                          {routeResult.riskLabel}
                        </div>
                        <span className="text-white/40 text-xs">{routeResult.distance}</span>
                      </div>
                      <div className={`text-lg font-black tabular-nums ${
                        routeResult.riskScore >= 70 ? 'text-red-400' : routeResult.riskScore >= 40 ? 'text-amber-400' : 'text-green-400'
                      }`}>{routeResult.riskScore}</div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          routeResult.riskScore >= 70 ? 'bg-red-500' : routeResult.riskScore >= 40 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${routeResult.riskScore}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                    <div className="text-white/50 text-xs flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
                      {routeResult.recommendation}
                    </div>
                    <div className="text-white/25 text-xs">
                      {routeResult.hotspots} black spots detected · Mock Gemini analysis
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Authority Dashboard ── */}
      <AnimatePresence>
        {authorityView && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-violet-500/20 shrink-0"
          >
            <div className="p-3 bg-violet-500/[0.04] space-y-2">
              <div className="text-violet-400 text-xs font-semibold flex items-center gap-1.5 mb-2">
                <Shield className="w-3.5 h-3.5" /> Authority Dashboard View (Mock)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Open Issues', value: issues.filter(i => i.status === 'pending').length.toString(), color: 'text-red-400', icon: '🔴' },
                  { label: 'In Progress', value: issues.filter(i => i.status === 'in_progress').length.toString(), color: 'text-amber-400', icon: '🟡' },
                  { label: 'Resolved', value: issues.filter(i => i.status === 'resolved').length.toString(), color: 'text-green-400', icon: '🟢' },
                  { label: 'Black Spots', value: blackspots.length.toString(), color: 'text-orange-400', icon: '⚠️' },
                  { label: 'Cameras', value: cameras.length.toString(), color: 'text-blue-400', icon: '📷' },
                  { label: 'Avg Severity', value: blackspots.length > 0 ? (blackspots.reduce((a, b) => a + b.severity, 0) / blackspots.length).toFixed(1) : 'N/A', color: 'text-violet-400', icon: '📊' },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                    <div className="text-sm">{icon}</div>
                    <div className={`font-bold text-sm ${color}`}>{value}</div>
                    <div className="text-white/30 text-[10px]">{label}</div>
                  </div>
                ))}
              </div>
              <div className="text-white/20 text-xs text-center">
                Authority view · Switchable in production for municipal officials
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-none border-b border-white/[0.04] shrink-0">
        {mode === 'sos' && (
          <>
            {[
              { k: 'all', emoji: '🗺️', label: 'All' },
              { k: 'hospital',      emoji: '🏥', label: 'Hospital' },
              { k: 'ambulance',     emoji: '🚑', label: 'Ambulance' },
              { k: 'police',        emoji: '🚔', label: 'Police' },
              { k: 'towing',        emoji: '🚗', label: 'Towing' },
              { k: 'puncture_shop', emoji: '🔧', label: 'Puncture' },
              { k: 'fuel',          emoji: '⛽', label: 'Fuel' },
            ].map(f => (
              <button key={f.k}
                onClick={() => setServiceFilter(f.k)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  serviceFilter === f.k
                    ? `${m.bg} ${m.color} border ${m.border}`
                    : 'bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/60'
                }`}
              >
                {f.emoji} <span className="hidden sm:inline">{f.label}</span>
                {f.k !== 'all' && services.filter(s => s.type === f.k).length > 0 && (
                  <span className="opacity-50">({services.filter(s => s.type === f.k).length})</span>
                )}
              </button>
            ))}
          </>
        )}
        {mode === 'roadwatch' && (
          <>
            {[{ k: 'all', emoji: '🗺️', label: 'All Issues' },
              ...Object.entries(ISSUE_META).map(([k, v]) => ({ k, emoji: v.emoji, label: v.label }))
            ].map(f => (
              <button key={f.k}
                onClick={() => setIssueTypeFilter(f.k)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all ${
                  issueTypeFilter === f.k
                    ? `${m.bg} ${m.color} border ${m.border}`
                    : 'bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/60'
                }`}
              >
                {f.emoji} <span className="hidden sm:inline">{f.label}</span>
                {f.k !== 'all' && countsType[f.k] && <span className="opacity-50">({countsType[f.k]})</span>}
              </button>
            ))}
            <div className="w-px bg-white/10 mx-1 shrink-0" />
            {(['all', 'pending', 'in_progress', 'resolved'] as const).map(s => (
              <button key={s}
                onClick={() => setIssueStatusFilter(s)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all ${
                  issueStatusFilter === s
                    ? `${m.bg} ${m.color} border ${m.border}`
                    : 'bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/60'
                }`}
              >
                {s === 'all' ? '📋 All' : `● ${STATUS_META[s]?.label || s}`}
                {s !== 'all' && countsStatus[s] ? <span className="opacity-50">({countsStatus[s]})</span> : null}
              </button>
            ))}
          </>
        )}
        {mode === 'drivelegal' && (
          <>
            {[
              { k: 'blackspot', emoji: '💀', label: 'Black Spots', count: blackspots.length },
              { k: 'cameras',   emoji: '📷', label: 'Cameras',    count: cameras.length },
              { k: 'zones',     emoji: '🚫', label: 'Zones',      count: violationZones.length },
            ].map(f => (
              <div key={f.k}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${m.border} ${m.color} ${m.bg}`}
              >
                {f.emoji} <span className="hidden sm:inline">{f.label}</span>
                <span className="opacity-70">({f.count})</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Map / List panel ── */}
      <div className="relative flex-1" style={{ minHeight: height }}>
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-brand-blue/60 backdrop-blur-sm">
            <div className="text-center text-white/50">
              <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2" />
              <div className="text-xs">Loading {m.label} data…</div>
            </div>
          </div>
        )}

        {viewMode === 'map' ? (
          <>
            <div ref={mapRef} style={{ height, width: '100%' }} />

            {/* Map loading skeleton */}
            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-brand-blue/90">
                <div className="text-center text-white/40">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <div className="text-sm">Initialising map…</div>
                </div>
              </div>
            )}

            {/* Proximity alerts overlay */}
            <ProximityAlert
              alerts={alerts}
              onDismiss={id => setAlerts(prev => prev.filter(a => a.id !== id))}
            />

            {/* ── RoadSoS SOS button ── */}
            {mode === 'sos' && mapReady && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center gap-2">
                {sosBeaconActive ? (
                  <motion.div
                    initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-600/90 border border-red-400/50 text-white text-sm font-bold backdrop-blur-sm"
                  >
                    <Radio className="w-4 h-4 animate-pulse" />
                    SOS BEACON ACTIVE
                    <ShareSOSButton lat={userLat} lon={userLon} />
                  </motion.div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}
                    onClick={activateSOS}
                    className="relative flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-red-600 border-2 border-red-400/60 text-white font-bold text-sm shadow-glow-red"
                  >
                    <span className="absolute inset-0 rounded-2xl animate-pulse-red pointer-events-none" />
                    <AlertTriangle className="w-5 h-5" />
                    ONE-TAP SOS
                  </motion.button>
                )}
              </div>
            )}

            {/* ── Map Legend ── */}
            {mapReady && mode !== 'sos' && (
              <div className="absolute bottom-3 left-3 z-[500] glass rounded-xl border border-white/10 overflow-hidden">
                <div className="px-2.5 py-1.5 text-xs text-white/25 space-y-1 max-w-[160px]">
                  {mode === 'roadwatch' && (
                    <>
                      {showHeatmap && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-2 rounded-sm" style={{ background: 'linear-gradient(to right, #1d4ed8, #f59e0b, #ef4444)' }} />
                          <span>Issue density</span>
                        </div>
                      )}
                      {[
                        { color: '#ef4444', label: 'Pothole' },
                        { color: '#f97316', label: 'Road damage' },
                        { color: '#facc15', label: 'Bad lighting' },
                      ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm border" style={{ borderColor: color, background: color + '30' }} />
                          <span>{label}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {mode === 'drivelegal' && (
                    <>
                      {showHeatmap && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-2 rounded-sm" style={{ background: 'linear-gradient(to right, #7c3aed, #dc2626, #ff1744)' }} />
                          <span>Accident density</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">💀</span><span>Black spot</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">📷</span><span>Speed camera</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🚫</span><span>Violation zone</span>
                      </div>
                    </>
                  )}
                  <div className="text-white/15 pt-0.5 border-t border-white/10">Click markers for details</div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── List View ── */
          <div className="overflow-y-auto p-3 space-y-2" style={{ maxHeight: height }}>
            {mode === 'sos' && (
              <>
                {filteredServices.length === 0 ? (
                  <div className="py-12 text-center text-white/30 text-sm">No services found.</div>
                ) : filteredServices.map((svc, i) => {
                  const meta = SERVICE_META[svc.type]
                  return (
                    <motion.div
                      key={svc.name + i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${meta?.border} transition-all cursor-pointer hover:brightness-110`}
                      onClick={() => setSelectedService(svc)}
                    >
                      <span className="text-2xl shrink-0">{meta?.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm truncate">{svc.name}</div>
                        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{formatDistance(svc.distance_m)}
                          </span>
                          {svc.eta_min && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtETA(svc.eta_min)}</span>}
                          {svc.phone && <span className="font-mono">{svc.phone}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {svc.phone && (
                          <a href={`tel:${svc.phone}`}
                            onClick={e => e.stopPropagation()}
                            className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <a href={svc.maps_url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20">
                          <Navigation className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </motion.div>
                  )
                })}
              </>
            )}

            {mode === 'roadwatch' && (
              <>
                {filteredIssues.length === 0 ? (
                  <div className="py-12 text-center text-white/30 text-sm">No issues reported.</div>
                ) : filteredIssues.map((issue, i) => {
                  const meta = ISSUE_META[issue.type] || ISSUE_META.other
                  const statusMeta = STATUS_META[issue.status] || STATUS_META.pending
                  return (
                    <motion.div
                      key={issue.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-all"
                      onClick={() => setSelectedIssue(issue)}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium text-sm">{meta.label}</span>
                          <span className={`text-xs ${statusMeta.color} flex items-center gap-0.5`}>
                            ● {statusMeta.label}
                          </span>
                        </div>
                        <div className="text-white/50 text-xs truncate">{issue.description}</div>
                        <div className="text-white/30 text-xs mt-0.5 flex items-center gap-2">
                          <span>{formatDistance(issue.distance_m)}</span>
                          <span className="font-mono">{issue.id}</span>
                          {issue.has_image && <span>📷</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 shrink-0 mt-1" />
                    </motion.div>
                  )
                })}
              </>
            )}

            {mode === 'drivelegal' && (
              <>
                {blackspots.map((bs, i) => (
                  <motion.div key={bs.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-3 p-3 rounded-xl border border-red-500/20 bg-red-500/5"
                  >
                    <span className="text-xl">💀</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-red-300 font-semibold text-sm">{bs.name}</div>
                      <div className="text-white/40 text-xs mt-0.5">{bs.description}</div>
                      <div className="text-red-400/60 text-xs mt-1">
                        Severity {bs.severity}/10 · {formatDistance(bs.distance_m)}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {cameras.map((cam, i) => {
                  const meta = CAMERA_META[cam.type]
                  return (
                    <motion.div key={cam.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (blackspots.length + i) * 0.04 }}
                      className="flex items-start gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5"
                    >
                      <span className="text-xl">{meta?.emoji || '📷'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-amber-300 font-semibold text-sm">{cam.name}</div>
                        <div className="text-white/40 text-xs mt-0.5">{meta?.label}</div>
                        {cam.speed_limit_kmh > 0 && (
                          <div className="text-amber-400/70 text-xs mt-1">
                            Limit: {cam.speed_limit_kmh} km/h · {formatDistance(cam.distance_m)}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* ── Service Detail Panel ── */}
        <AnimatePresence>
          {selectedService && (
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 z-[600] glass-strong rounded-t-2xl border-t border-white/10 p-4"
            >
              <button
                onClick={() => setSelectedService(null)}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 text-white/40"
              >
                <X className="w-4 h-4" />
              </button>
              {(() => {
                const meta = SERVICE_META[selectedService.type]
                return (
                  <div>
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-3xl">{meta?.emoji}</span>
                      <div>
                        <div className="text-white font-bold text-base">{selectedService.name}</div>
                        <div className="text-white/40 text-xs mt-0.5">{meta?.label}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="glass rounded-xl p-2.5 text-center">
                        <div className="text-white/40 text-xs mb-1 flex items-center justify-center gap-1">
                          <MapPin className="w-3 h-3" /> Distance
                        </div>
                        <div className="text-white font-semibold text-sm">{formatDistance(selectedService.distance_m)}</div>
                      </div>
                      <div className="glass rounded-xl p-2.5 text-center">
                        <div className="text-white/40 text-xs mb-1 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" /> ETA
                        </div>
                        <div className="text-amber-400 font-semibold text-sm">{fmtETA(selectedService.eta_min)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedService.phone && (
                        <a
                          href={`tel:${selectedService.phone}`}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 font-semibold text-sm hover:bg-green-500/25 transition-all"
                        >
                          <Phone className="w-4 h-4" /> Call Now
                        </a>
                      )}
                      <a
                        href={selectedService.maps_url}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold text-sm hover:bg-blue-500/25 transition-all"
                      >
                        <Navigation className="w-4 h-4" /> Get Directions
                      </a>
                    </div>
                  </div>
                )
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Issue Detail Panel ── */}
        <AnimatePresence>
          {selectedIssue && (
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 z-[600] glass-strong rounded-t-2xl border-t border-white/10 p-4"
            >
              <button
                onClick={() => setSelectedIssue(null)}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10 text-white/40"
              >
                <X className="w-4 h-4" />
              </button>
              {(() => {
                const meta = ISSUE_META[selectedIssue.type] || ISSUE_META.other
                const statusMeta = STATUS_META[selectedIssue.status] || STATUS_META.pending
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{meta.emoji}</span>
                      <div>
                        <div className="text-white font-bold text-sm">{meta.label}</div>
                        <div className={`text-xs ${statusMeta.color} flex items-center gap-1`}>
                          ● {statusMeta.label}
                        </div>
                      </div>
                      <div className="ml-auto text-white/30 text-xs font-mono">{selectedIssue.id}</div>
                    </div>
                    <div className="text-white/70 text-sm mb-3">{selectedIssue.description}</div>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Shield className="w-3.5 h-3.5" />
                        <span>{selectedIssue.authority}</span>
                      </div>
                      {selectedIssue.authority_contact && (
                        <a href={`tel:${selectedIssue.authority_contact}`}
                          className="flex items-center gap-2 text-xs text-green-400">
                          <Phone className="w-3.5 h-3.5" />
                          {selectedIssue.authority_contact}
                        </a>
                      )}
                      {selectedIssue.has_image && (
                        <div className="text-xs text-blue-400 flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5" /> Photo evidence attached
                        </div>
                      )}
                    </div>
                    <div className="text-white/25 text-xs">
                      Reported {new Date(selectedIssue.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {selectedIssue.source === 'demo' && ' · Demo data'}
                    </div>
                  </div>
                )
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer stats ── */}
      <div className="px-3 py-2 border-t border-white/[0.04] flex items-center justify-between shrink-0">
        <div className="text-white/20 text-xs flex items-center gap-1.5">
          <Layers className="w-3 h-3" />
          {mode === 'sos' && `${filteredServices.length} services`}
          {mode === 'roadwatch' && `${filteredIssues.length} issues`}
          {mode === 'drivelegal' && `${blackspots.length + cameras.length + violationZones.length} items`}
        </div>
        <div className="text-white/20 text-xs flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {locationLabel || `${userLat.toFixed(4)}°N · ${userLon.toFixed(4)}°E`}
        </div>
      </div>
    </div>
  )
}

// Helper for heatmap weight
function _issueWeight(issue: MapIssue): number {
  const weights: Record<string, number> = {
    flooding: 0.9, pothole: 0.8, road_damage: 0.7,
    broken_signal: 0.6, bad_lighting: 0.5, construction: 0.4,
    missing_sign: 0.3, other: 0.2,
  }
  const base = weights[issue.type] ?? 0.3
  return issue.status === 'pending' ? Math.min(1, base * 1.2) : base
}

export default AiMap
