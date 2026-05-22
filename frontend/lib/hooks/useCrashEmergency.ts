'use client'

/**
 * useCrashEmergency.ts — CrashMode → MapController Integration Hook (v2)
 * ══════════════════════════════════════════════════════════════════════
 * Bridges CrashMode.tsx and MapController.tsx.
 * When CrashMode activates it stores lat/lon in sessionStorage so
 * the Map page can pick it up and force Emergency mode.
 *
 * v2 UPGRADES:
 *  • Dispatches a custom window event so components on the SAME page
 *    (e.g. MapController embedded in emergency/page.tsx) react instantly
 *    without a router push.
 *  • Provides clearCrashState for clean dismissal.
 *  • country field passed through for BIMSTEC emergency numbers.
 *  • Expiry reduced to 20 min (more realistic emergency window).
 *
 * SETUP:
 *
 * In app/emergency/page.tsx:
 *   const { onCrashActivate } = useCrashEmergency()
 *   <CrashModeButton onActivate={(lat, lon) => onCrashActivate(lat, lon)} />
 *
 * In app/map/page.tsx:
 *   const { isCrisis, crashLat, crashLon } = useCrashEmergency()
 *   <MapController forceEmergency={isCrisis} userLat={crashLat} userLon={crashLon} />
 *
 * WHAT HAPPENS (full chain):
 * 1. User taps SOS in CrashMode
 * 2. onCrashActivate stores lat/lon + timestamp in sessionStorage
 * 3. Window event 'crashEmergency' fires — same-page listeners update
 * 4. User (or auto-redirect) navigates to /map?crisis=1
 * 5. MapController reads forceEmergency=true → Emergency mode activates
 * 6. Crisis banner + pulsing border + haptic vibration all fire
 * 7. Risk Radar shows nearest ambulance / hospital distances
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface CrashState {
  lat:      number
  lon:      number
  ts:       number
  ticketId: string
  country?: string
}

const CRASH_KEY       = 'roadsos_crash_state'
const CRASH_EXPIRY_MS = 20 * 60 * 1000   // 20 minutes
const CRASH_EVENT     = 'crashEmergency'  // custom window event

export function useCrashEmergency() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const [crashState, setCrashState] = useState<CrashState | null>(null)

  // ── Read persisted crash state on mount ──────────────────────────────
  useEffect(() => {
    const loadState = () => {
      try {
        const raw = sessionStorage.getItem(CRASH_KEY)
        if (!raw) return
        const state = JSON.parse(raw) as CrashState
        if (Date.now() - state.ts > CRASH_EXPIRY_MS) {
          sessionStorage.removeItem(CRASH_KEY)
          return
        }
        setCrashState(state)
      } catch { /* sessionStorage unavailable */ }
    }

    loadState()

    // Also listen for same-page activation events
    const handleCrashEvent = (e: Event) => {
      const detail = (e as CustomEvent<CrashState>).detail
      if (detail) setCrashState(detail)
    }
    window.addEventListener(CRASH_EVENT, handleCrashEvent)
    return () => window.removeEventListener(CRASH_EVENT, handleCrashEvent)
  }, [])

  /**
   * Call from CrashMode when SOS is activated.
   * Stores location → fires window event → navigates to emergency map.
   */
  const onCrashActivate = useCallback((lat: number, lon: number, country = 'India') => {
    const ticketId = `ACC-${Date.now().toString(36).toUpperCase().slice(-8)}`
    const state: CrashState = { lat, lon, ts: Date.now(), ticketId, country }

    try {
      sessionStorage.setItem(CRASH_KEY, JSON.stringify(state))
    } catch { /* graceful degradation */ }

    setCrashState(state)

    // Dispatch same-page event for immediate reactivity (no re-render needed for mappage)
    try {
      window.dispatchEvent(new CustomEvent(CRASH_EVENT, { detail: state }))
    } catch { /* SSR safety */ }

    // Haptic burst — 3-pulse SOS pattern
    try {
      if ('vibrate' in navigator) navigator.vibrate([300, 100, 300, 100, 300])
    } catch { /* no haptics */ }

    // Navigate to map in crisis mode after brief delay
    // (allows CrashMode animation sequence to run first)
    setTimeout(() => {
      router.push('/map?crisis=1')
    }, 3500)
  }, [router])

  /**
   * Clear crash state — call when user explicitly dismisses emergency.
   */
  const clearCrashState = useCallback(() => {
    try { sessionStorage.removeItem(CRASH_KEY) } catch { }
    setCrashState(null)
  }, [])

  // Is the current page in crisis mode?
  const isCrisis = searchParams?.get('crisis') === '1' || !!crashState

  return {
    onCrashActivate,
    clearCrashState,
    isCrisis,
    crashLat:      crashState?.lat,
    crashLon:      crashState?.lon,
    crashTicketId: crashState?.ticketId,
    crashCountry:  crashState?.country,
  }
}
