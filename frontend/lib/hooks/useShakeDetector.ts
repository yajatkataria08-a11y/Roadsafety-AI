'use client'

/**
 * useShakeDetector.ts — DeviceMotion shake gesture hook
 * ═══════════════════════════════════════════════════════════════
 * Detects hard device shakes using accelerometer data.
 * Fires onShake callback when ≥3 shakes detected within 1.5 seconds.
 * Provides haptic feedback via navigator.vibrate.
 *
 * USAGE:
 *   const { isListening, shakeCount } = useShakeDetector({
 *     onShake: () => activateSOS(),
 *     threshold: 18,       // acceleration threshold (m/s²)
 *     requiredShakes: 3,   // shakes needed to trigger
 *     windowMs: 1500,      // detection window in ms
 *   })
 */

import { useState, useEffect, useRef, useCallback } from 'react'

interface ShakeOptions {
  onShake: () => void
  threshold?: number    // default 18 (m/s² — hard shake)
  requiredShakes?: number // default 3
  windowMs?: number     // default 1500ms
}

interface ShakeState {
  isListening: boolean
  isSupported: boolean
  shakeCount: number
  permissionGranted: boolean
  requestPermission: () => Promise<void>
}

export function useShakeDetector({
  onShake,
  threshold = 18,
  requiredShakes = 3,
  windowMs = 1500,
}: ShakeOptions): ShakeState {
  const [isListening, setIsListening]         = useState(false)
  const [isSupported, setIsSupported]         = useState(false)
  const [shakeCount, setShakeCount]           = useState(0)
  const [permissionGranted, setPermGranted]   = useState(false)

  const lastAccel     = useRef({ x: 0, y: 0, z: 0 })
  const shakeTimes    = useRef<number[]>([])
  const cooldownRef   = useRef(false)

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const accel = event.accelerationIncludingGravity
    if (!accel) return

    const { x = 0, y = 0, z = 0 } = accel
    const prev = lastAccel.current

    const delta = Math.abs((x ?? 0) - prev.x) +
                  Math.abs((y ?? 0) - prev.y) +
                  Math.abs((z ?? 0) - prev.z)

    lastAccel.current = { x: x ?? 0, y: y ?? 0, z: z ?? 0 }

    if (delta > threshold && !cooldownRef.current) {
      const now = Date.now()
      shakeTimes.current = [...shakeTimes.current, now].filter(t => now - t < windowMs)

      setShakeCount(shakeTimes.current.length)

      // Brief haptic pulse per shake
      navigator.vibrate?.(50)

      if (shakeTimes.current.length >= requiredShakes) {
        // Long haptic burst = SOS triggered
        navigator.vibrate?.([100, 50, 100, 50, 300])
        shakeTimes.current = []
        setShakeCount(0)
        cooldownRef.current = true
        setTimeout(() => { cooldownRef.current = false }, 3000)
        onShake()
      }
    }
  }, [onShake, threshold, requiredShakes, windowMs])

  const startListening = useCallback(() => {
    window.addEventListener('devicemotion', handleMotion, true)
    setIsListening(true)
  }, [handleMotion])

  const requestPermission = useCallback(async () => {
    // iOS 13+ requires explicit permission
    const DeviceMotionEventAny = DeviceMotionEvent as any
    if (typeof DeviceMotionEventAny.requestPermission === 'function') {
      try {
        const result = await DeviceMotionEventAny.requestPermission()
        if (result === 'granted') {
          setPermGranted(true)
          startListening()
        }
      } catch {
        console.warn('[ShakeDetector] Permission denied')
      }
    } else {
      // Non-iOS — no permission needed
      setPermGranted(true)
      startListening()
    }
  }, [startListening])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = 'DeviceMotionEvent' in window
    setIsSupported(supported)

    if (!supported) return

    // On Android / non-iOS: start immediately without permission prompt
    const DeviceMotionEventAny = DeviceMotionEvent as any
    if (typeof DeviceMotionEventAny.requestPermission !== 'function') {
      setPermGranted(true)
      startListening()
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion, true)
    }
  }, [handleMotion, startListening])

  return { isListening, isSupported, shakeCount, permissionGranted, requestPermission }
}
