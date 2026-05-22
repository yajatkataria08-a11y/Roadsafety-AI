'use client'

/**
 * useRiskRadar.ts — Live Proximity Risk Computation Hook
 * ═══════════════════════════════════════════════════════
 * Runs client-side Haversine distance calculations against
 * the static legal pin dataset and roadwatch project list.
 *
 * Returns a sorted list of nearby alerts within radius_km,
 * refreshed whenever userLat/userLon changes.
 *
 * Fully offline — no API calls. Works on PWA with no internet.
 *
 * USAGE:
 *   const alerts = useRiskRadar({ lat: 22.7196, lon: 75.8577, radius_km: 2 })
 *   // alerts[0] = { type: 'speed_cam', dist_km: 0.31, ... }
 */

import { useMemo } from 'react'

export interface RiskAlert {
  id:       string
  type:     'speed_cam' | 'helmet_cam' | 'blackspot' | 'pothole' | 'flooding' | 'broken_signal'
  label:    string
  dist_km:  number
  dist_str: string
  severity: 'urgent' | 'high' | 'medium'
  lat:      number
  lon:      number
  emoji:    string
  color:    string
}

// ── Static risk point dataset (Indore focus) ──────────────────────────────────
// These mirror the legal pins and roadwatch mock data so distances
// shown in the Risk Radar match the map markers exactly.

interface RawPoint {
  id: string; type: RiskAlert['type']; label: string
  lat: number; lon: number; emoji: string; color: string
  severity: RiskAlert['severity']
}

const RISK_POINTS: RawPoint[] = [
  // Legal — cameras & black spots
  { id: 'l1', type: 'speed_cam',    label: 'Speed Cam — AB Road @ VN Square',  lat: 22.7470, lon: 75.8932, emoji: '📷', color: '#ef4444', severity: 'urgent' },
  { id: 'l2', type: 'helmet_cam',   label: 'Helmet Cam — Ring Road @ LIG',     lat: 22.7139, lon: 75.8625, emoji: '🪖', color: '#f59e0b', severity: 'high'   },
  { id: 'l3', type: 'blackspot',    label: 'Black Spot — Bhawarkuwa Junction',  lat: 22.7536, lon: 75.8803, emoji: '⚠️', color: '#f97316', severity: 'high'   },
  { id: 'l4', type: 'speed_cam',    label: 'Speed Cam — Airport Bypass',        lat: 22.7214, lon: 75.8012, emoji: '📷', color: '#ef4444', severity: 'urgent' },
  { id: 'l5', type: 'blackspot',    label: 'Black Spot — NH-52 km 22',          lat: 22.7800, lon: 75.8100, emoji: '⚠️', color: '#f97316', severity: 'high'   },
  // RoadWatch — active issues
  { id: 'rw1', type: 'pothole',     label: 'Critical Pothole — AB Road',        lat: 22.7467, lon: 75.8929, emoji: '🕳️', color: '#ef4444', severity: 'urgent' },
  { id: 'rw3', type: 'flooding',    label: 'Waterlogging — Rajwada',            lat: 22.7177, lon: 75.8572, emoji: '🌊', color: '#06b6d4', severity: 'high'   },
  { id: 'rw4', type: 'broken_signal',label:'Signal Down — Palasia',             lat: 22.7237, lon: 75.8803, emoji: '🚦', color: '#a855f7', severity: 'urgent' },
  { id: 'rw6', type: 'pothole',     label: 'Broken Guardrail — NH52',           lat: 22.7800, lon: 75.8100, emoji: '🕳️', color: '#ef4444', severity: 'urgent' },
  { id: 'rw7', type: 'pothole',     label: 'Pothole — LIG Colony',              lat: 22.7139, lon: 75.8625, emoji: '🕳️', color: '#ef4444', severity: 'high'   },
]

// ── Haversine formula ─────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R  = 6371
  const dL = ((lat2 - lat1) * Math.PI) / 180
  const dN = ((lon2 - lon1) * Math.PI) / 180
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dN / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRiskRadar({
  lat,
  lon,
  radius_km = 3,
  max = 5,
}: {
  lat:       number
  lon:       number
  radius_km?: number
  max?:       number
}): RiskAlert[] {
  return useMemo(() => {
    if (!lat || !lon) return []

    return RISK_POINTS
      .map(p => {
        const dist_km = haversineKm(lat, lon, p.lat, p.lon)
        return { ...p, dist_km, dist_str: formatDist(dist_km) } as RiskAlert
      })
      .filter(p => p.dist_km <= radius_km)
      .sort((a, b) => a.dist_km - b.dist_km)
      .slice(0, max)
  }, [lat, lon, radius_km, max])
}
