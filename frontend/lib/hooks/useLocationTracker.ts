'use client'

/**
 * lib/hooks/useLocationTracker.ts — Live GPS tracking hook  (v21)
 * ═══════════════════════════════════════════════════════════════════
 * Wraps navigator.geolocation.watchPosition for continuous position
 * updates. Used by MapController "📍 Live" toggle to feed
 * CrowdsourcedMap canvas and re-trigger RiskRadarAlerts.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export interface LiveLocation {
  lat:       number
  lon:       number
  accuracy:  number        // metres
  heading:   number | null // 0–360°, null if stationary
  speed:     number | null // m/s, null if unavailable
  timestamp: number        // epoch ms
}

export interface UseLocationTrackerReturn {
  liveLocation:  LiveLocation | null
  isTracking:    boolean
  error:         string | null
  startTracking: () => void
  stopTracking:  () => void
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge:  5_000,
  timeout:    10_000,
}

export function useLocationTracker(
  onPositionUpdate?: (lat: number, lon: number) => void
): UseLocationTrackerReturn {
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null)
  const [isTracking,   setIsTracking]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const watchIdRef   = useRef<number | null>(null)
  const onUpdateRef  = useRef(onPositionUpdate)

  useEffect(() => { onUpdateRef.current = onPositionUpdate }, [onPositionUpdate])

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
    const loc: LiveLocation = {
      lat:       pos.coords.latitude,
      lon:       pos.coords.longitude,
      accuracy:  pos.coords.accuracy,
      heading:   pos.coords.heading,
      speed:     pos.coords.speed,
      timestamp: pos.timestamp,
    }
    setLiveLocation(loc)
    setError(null)
    onUpdateRef.current?.(loc.lat, loc.lon)
  }, [])

  const handleError = useCallback((err: GeolocationPositionError) => {
    const messages: Record<number, string> = {
      1: 'Location permission denied. Enable in browser settings.',
      2: 'Location unavailable. Check GPS signal.',
      3: 'Location request timed out. Retrying…',
    }
    setError(messages[err.code] ?? 'Unknown location error')
  }, [])

  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported on this device.')
      return
    }
    if (watchIdRef.current !== null) return
    setIsTracking(true)
    setError(null)
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess, handleError, GEO_OPTIONS
    )
  }, [handleSuccess, handleError])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)
    setLiveLocation(null)
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  return { liveLocation, isTracking, error, startTracking, stopTracking }
}
