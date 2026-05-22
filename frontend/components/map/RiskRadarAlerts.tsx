'use client'

/**
 * RiskRadarAlerts.tsx — Live proximity toast alerts while on map
 * ═══════════════════════════════════════════════════════════════
 * Fires informational toasts as the user's position changes or
 * on a timed interval during map session. Shows:
 *   📷 Speed camera Xm ahead
 *   ⚠️  Black spot nearby
 *   🕳️  Critical pothole reported 200m
 *
 * Uses useRiskRadar for Haversine proximity calculation.
 * Only fires once per alert per session (dedup by id + distance bucket).
 *
 * USAGE (in MapController):
 *   <RiskRadarAlerts lat={userLat} lon={userLon} mode={activeMode} />
 */

import { useEffect, useRef } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { useRiskRadar } from '@/lib/hooks/useRiskRadar'
import type { ExtendedMapMode } from '@/components/map/MapController'

interface RiskRadarAlertsProps {
  lat: number
  lon: number
  mode: ExtendedMapMode
}

// Alert only fires once per (id, distance-bucket) combination per session
function bucketDist(km: number): string {
  if (km < 0.2)  return '<200m'
  if (km < 0.5)  return '<500m'
  if (km < 1.0)  return '<1km'
  if (km < 2.0)  return '<2km'
  return '>2km'
}

// Which modes surface which alert types
const MODE_ALERT_TYPES: Record<ExtendedMapMode, string[]> = {
  legal:     ['speed_cam', 'helmet_cam', 'blackspot'],
  roadwatch: ['pothole', 'flooding', 'broken_signal'],
  emergency: ['blackspot', 'pothole'],          // all risk items on emergency
  authority: [],
}

const ALERT_MESSAGES: Record<string, (dist: string, label: string) => string> = {
  speed_cam:      (d, l) => `📷 Speed camera ${d} — ${l}`,
  helmet_cam:     (d, l) => `🪖 Helmet camera ${d} — ${l}`,
  blackspot:      (d, l) => `⚠️ Accident black spot ${d} — ${l}`,
  pothole:        (d, l) => `🕳️ Critical pothole ${d} — ${l}`,
  flooding:       (d, l) => `🌊 Waterlogging reported ${d} — ${l}`,
  broken_signal:  (d, l) => `🚦 Signal down ${d} — ${l}`,
}

export function RiskRadarAlerts({ lat, lon, mode }: RiskRadarAlertsProps) {
  const { toast } = useToast()
  const firedRef  = useRef(new Set<string>())
  const initRef   = useRef(false)

  // Only alert within 1.5km in normal mode
  const alerts = useRiskRadar({ lat, lon, radius_km: 1.5, max: 8 })
  const allowedTypes = MODE_ALERT_TYPES[mode] ?? []

  useEffect(() => {
    // Skip very first render — avoids flooding toasts on mount
    if (!initRef.current) { initRef.current = true; return }
    if (!lat || !lon) return

    const relevant = alerts.filter(a => allowedTypes.includes(a.type))

    for (const alert of relevant) {
      const bucket = bucketDist(alert.dist_km)
      const key = `${alert.id}-${bucket}`

      if (firedRef.current.has(key)) continue
      firedRef.current.add(key)

      const msgFn = ALERT_MESSAGES[alert.type]
      if (!msgFn) continue

      const msg = msgFn(alert.dist_str, alert.label)

      // Choose toast variant by severity
      setTimeout(() => {
        if (alert.severity === 'urgent') {
          toast.warning(msg)
        } else {
          toast.info(msg)
        }
      }, Math.random() * 800) // stagger toasts slightly
    }
  }, [alerts, allowedTypes, lat, lon]) // eslint-disable-line react-hooks/exhaustive-deps

  // Component renders nothing — side-effect only
  return null
}
