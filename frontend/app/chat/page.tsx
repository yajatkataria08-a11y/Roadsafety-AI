'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Globe, Trash2, Shield, AlertTriangle, Navigation2 } from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/shared/Navbar'
import { MessageBubble, TypingIndicator } from '@/components/chat/MessageBubble'
import { ChatSkeleton } from '@/components/shared/Skeleton'
import { QuickChips } from '@/components/chat/QuickChips'
import { ChatInput, type VehicleType } from '@/components/chat/ChatInput'
import { sendChatMessage, getMockChatResponse, detectRoadType, type RoadTypeResult } from '@/lib/api'
import { shareLocation } from '@/lib/utils'
import type { Message } from '@/components/chat/types'
import { FloatingScanButton, OCRScannerModal } from '@/components/ocr/OCRScanner'
import { prepareForBackend } from '@/lib/i18n/chatTranslate'

// ── Persistent session ID (survives refreshes, expires with tab) ────────────
function getSessionId(): string {
  if (typeof window === 'undefined') return `sess-${Date.now()}`
  let id = sessionStorage.getItem('rs_session_id')
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem('rs_session_id', id)
  }
  return id
}

const COUNTRIES = ['India', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Myanmar', 'Bhutan', 'Thailand']

// ── Intent detection helpers ───────────────────────────────────────────────────

function detectDriveLegalIntent(text: string): boolean {
  const lower = text.toLowerCase()
  const DRIVELEGAL_KW = [
    'fine', 'challan', 'penalty', 'fee', 'rule', 'law', 'section', 'license',
    'licence', 'helmet', 'seatbelt', 'signal', 'speed', 'drunk', 'parking',
    'insurance', 'registration', 'rc', 'dl', 'permit', 'vehicle', 'two wheeler',
    'car', 'truck', 'bus', 'auto', 'bike', 'kitna', 'how much', 'what is the fine',
  ]
  return DRIVELEGAL_KW.some(kw => lower.includes(kw))
}

// Auto-detect vehicle type from query text — improves Smart Challan accuracy
// without requiring user to tap a button
function autoDetectVehicleType(text: string): VehicleType | null {
  const lower = text.toLowerCase()
  if (/\b(bike|scooter|motorcycle|two.?wheel|activa|splendor|pulsar|ktm|bajaj|tvs|hero)\b/.test(lower)) return 'two_wheeler'
  if (/\b(truck|lorry|heavy|hmv|tanker|tipper|tractor)\b/.test(lower)) return 'hmv'
  if (/\b(bus|mini.?bus|passenger)\b/.test(lower)) return 'bus'
  if (/\b(auto|rick|tuk.?tuk|auto.?rickshaw)\b/.test(lower)) return 'auto'
  if (/\b(car|suv|sedan|hatchback|lmv|swift|innova|baleno|nexon|creta|brezza)\b/.test(lower)) return 'lmv'
  return null
}

function detectEmergencyIntent(text: string): boolean {
  const lower = text.toLowerCase()
  const PRIMARY = ['help me', 'injured', 'bleeding', 'unconscious', 'trapped', 'dying', 'sos', 'bachaao', 'madat']
  const AMBIGUOUS = ['accident', 'crash', 'hit', 'collide']
  const FINE_SIGNALS = ['fine', 'penalty', 'challan', 'law', 'rule', 'section', 'how much', 'kitna', 'what is', 'amount']
  const fineHits = FINE_SIGNALS.filter(s => lower.includes(s)).length
  // 2+ fine signals = definitely a legal query, not emergency
  if (fineHits >= 2) return false
  if (PRIMARY.some(kw => lower.includes(kw))) return true
  return (
    AMBIGUOUS.some(kw => lower.includes(kw)) && !fineHits
  )
}

// Detect severity from emergency message text
function detectSeverityFromText(text: string): 'CRITICAL' | 'HIGH' | 'SERIOUS' | 'MILD' {
  const lower = text.toLowerCase()
  if (/\b(dying|unconscious|not breathing|blood|trapped|bachaao|madat karo|jaan)\b/.test(lower)) return 'CRITICAL'
  if (/\b(bleeding|injured|broken|fracture|serious|severe|head.?injury)\b/.test(lower)) return 'HIGH'
  if (/\b(accident|crash|hit|collide|overturn|rollover)\b/.test(lower)) return 'SERIOUS'
  return 'MILD'
}

// ── Road type badge ────────────────────────────────────────────────────────────

const ROAD_TYPE_STYLE: Record<string, string> = {
  motorway: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  national: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  state:    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  primary:  'bg-green-500/15 text-green-300 border-green-500/30',
  local:    'bg-white/10 text-white/50 border-white/15',
  unknown:  'bg-white/5 text-white/30 border-white/10',
}

function RoadTypeBadge({ road }: { road: RoadTypeResult }) {
  return (
    <div className="space-y-1">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${ROAD_TYPE_STYLE[road.type]}`}
      >
        <Navigation2 className="w-3 h-3" />
        <span>{road.label}</span>
        {road.speedLimit && <span className="opacity-70">· {road.speedLimit} km/h</span>}
        {road.ref && <span className="opacity-70">· {road.ref}</span>}
      </motion.div>
      {road.authority && (
        <div className="text-white/25 text-xs px-1 leading-tight">{road.authority}</div>
      )}
      {road.lastRepaired && (
        <div className="text-white/20 text-xs px-1 leading-tight">
          Last repaired: {road.lastRepaired}
        </div>
      )}
    </div>
  )
}

// ── Welcome message ────────────────────────────────────────────────────────────

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'ai',
  content: `👋 **Namaste! I'm Road Safety AI.**

I can help you with:

🔵 **DriveLegal** — Traffic fines, challans, vehicle rules across 7 BIMSTEC nations

🟠 **RoadWatch** — Report potholes, broken signals, unsafe roads

🔴 **RoadSoS** — Emergency services, nearest hospitals, accident response

What do you need help with today?`,
  timestamp: new Date(),
  intent: 'General',
  source: 'system',
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [country, setCountry] = useState('India')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [showOCRModal, setShowOCRModal] = useState(false)

  // DriveLegal vehicle selector
  const [showVehicleSelector, setShowVehicleSelector] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | null>(null)

  // Road type detection
  const [roadType, setRoadType] = useState<RoadTypeResult | null>(null)

  // Emergency severity for forwarding to /emergency?severity=
  const [detectedSeverity, setDetectedSeverity] = useState<string>('CRITICAL')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // ── Location sharing (now also triggers road type detection) ─────────────────

  const handleLocationShare = useCallback(() => {
    if (location) {
      setLocation(null)
      setRoadType(null)
      return
    }
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setLocation(coords)

        // Detect road type in background
        detectRoadType(coords.lat, coords.lon).then(setRoadType).catch(() => null)

        const locMsg: Message = {
          id: `sys-${Date.now()}`,
          role: 'ai',
          content: `📍 **Location received!**\n\nYour coordinates have been captured (${coords.lat.toFixed(4)}°N, ${coords.lon.toFixed(4)}°E).\n\nI can now find the nearest hospitals, ambulances, and police stations for you.`,
          timestamp: new Date(),
          intent: 'RoadSoS',
          source: 'system',
        }
        setMessages(prev => [...prev, locMsg])
      },
      () => {
        const demo = { lat: 22.7196, lon: 75.8577 }
        setLocation(demo)
        detectRoadType(demo.lat, demo.lon).then(setRoadType).catch(() => null)

        const msg: Message = {
          id: `sys-${Date.now()}`,
          role: 'ai',
          content: `📍 **Demo location set to Indore, MP**\n\nLocation access was denied. Using Indore as demo location.`,
          timestamp: new Date(),
          intent: 'RoadSoS',
          source: 'system',
        }
        setMessages(prev => [...prev, msg])
      }
    )
  }, [location])

  // ── Share location (emergency contacts) ──────────────────────────────────────

  const handleShareLocationContacts = useCallback(async () => {
    if (!location) return
    try {
      await shareLocation(location.lat, location.lon)
    } catch {
      // silent
    }
  }, [location])

  // ── Vehicle selection ─────────────────────────────────────────────────────────

  const handleVehicleSelect = useCallback((type: VehicleType) => {
    setSelectedVehicle(type)
    const names: Record<VehicleType, string> = {
      two_wheeler: 'Two-Wheeler (Bike/Scooter)',
      lmv: 'Car / SUV (LMV)',
      hmv: 'Truck / Heavy Vehicle',
      bus: 'Bus / Passenger Vehicle',
      auto: 'Auto-Rickshaw',
    }
    // Acknowledge selection with a contextual message
    const msg: Message = {
      id: `sys-vehicle-${Date.now()}`,
      role: 'ai',
      content: `🚗 **Vehicle set to: ${names[type]}**\n\nChallan amounts will now be calculated specifically for your vehicle category. Ask me about any traffic offence!`,
      timestamp: new Date(),
      intent: 'DriveLegal',
      source: 'system',
      vehicleType: type,
    }
    setMessages(prev => [...prev, msg])
  }, [])

  // ── Send message ──────────────────────────────────────────────────────────────

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    // v1 feature: detect script + transliterate Hinglish for backend RAG
    const { displayText, backendText } = prepareForBackend(text)

    const isEmergency = detectEmergencyIntent(backendText)
    const isDriveLegal = detectDriveLegalIntent(backendText)

    // Auto-detect vehicle type from query if not already selected
    if (isDriveLegal) {
      setShowVehicleSelector(true)
      const autoVehicle = autoDetectVehicleType(text)
      if (autoVehicle && !selectedVehicle) {
        setSelectedVehicle(autoVehicle)
      }
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayText,  // show original script in bubble
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    // Emergency fast-path
    if (isEmergency && !isDriveLegal) {
      const severity = detectSeverityFromText(text)
      setDetectedSeverity(severity)
      setTimeout(() => {
        const emergMsg: Message = {
          id: `ai-emergency-${Date.now()}`,
          role: 'ai',
          content: `🚨 **EMERGENCY DETECTED!** (${severity})\n\nThis sounds urgent. Please:\n\n• **Call 112** immediately (all emergencies, India)\n• **Call 108** for free ambulance\n\n[🆘 Activate Crash Mode](/emergency?severity=${severity})`,
          timestamp: new Date(),
          intent: 'Emergency',
          confidence: 1.0,
          source: 'emergency_override',
        }
        setMessages(prev => [...prev, emergMsg])
        setIsLoading(false)
      }, 800)
      return
    }

    try {
      let response
      try {
        response = await sendChatMessage({
          message: backendText,  // transliterated for backend RAG
          lat: location?.lat,
          lon: location?.lon,
          country,
          vehicle_type: selectedVehicle ?? undefined,
          session_id: getSessionId(),
        })
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'RATE_LIMIT') throw err
        await new Promise(r => setTimeout(r, 800 + Math.random() * 700))
        response = getMockChatResponse(backendText)
      }

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: response.response,
        timestamp: new Date(),
        intent: response.intent,
        confidence: response.confidence,
        source: response.source,
        action_url:   (response as any).action_url   ?? undefined,
        action_label: (response as any).action_label ?? undefined,
        hierarchyData: (response as { hierarchy?: Message['hierarchyData'] }).hierarchy ?? undefined,
      }
      setMessages(prev => [...prev, aiMsg])

      // Auto-hide vehicle selector once response comes in
      if (response.intent !== 'DriveLegal') {
        setShowVehicleSelector(false)
      }
    } catch (err: unknown) {
      const isRateLimit = err instanceof Error && err.message === 'RATE_LIMIT'
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'ai',
        content: isRateLimit
          ? '⏱️ **Too many requests!**\n\nThe AI is receiving a lot of queries right now. Please wait a moment and try again.\n\n*(Rate limit: 30 messages per minute)*'
          : '⚠️ Unable to connect to Road Safety AI server. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, location, country, selectedVehicle])

  const clearChat = () => {
    setMessages([WELCOME_MESSAGE])
    setShowVehicleSelector(false)
    setSelectedVehicle(null)
  }

  return (
    <div className="flex flex-col h-screen bg-brand-blue overflow-hidden">
      <Navbar />

      {/* Road-stripe background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 48px, rgba(255,255,255,0.5) 48px, rgba(255,255,255,0.5) 50px)',
        }}
      />

      <div className="flex flex-1 overflow-hidden pt-16">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-white/[0.06] bg-brand-blue-mid/50 p-4 gap-3">
          <div className="glass-card p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-5 h-5 text-brand-orange" />
              <span className="font-display font-semibold text-white">Road Safety AI</span>
            </div>
            <p className="text-white/40 text-xs leading-relaxed">
              AI assistant for traffic laws, road reporting, and emergency response across BIMSTEC nations.
            </p>
          </div>

          {/* Country selector */}
          <div className="glass-card p-3 border border-white/[0.06]">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
              <Globe className="w-3.5 h-3.5" />
              Country Context
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCountry(c)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-all duration-150 ${
                    country === c
                      ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30'
                      : 'bg-white/[0.04] text-white/40 hover:text-white/70 border border-white/5'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Road type badge */}
          {roadType && roadType.type !== 'unknown' && (
            <div className="glass-card p-3 border border-white/[0.06]">
              <div className="text-white/40 text-xs mb-2">Current Road</div>
              <RoadTypeBadge road={roadType} />
            </div>
          )}

          {/* Quick actions */}
          <div className="glass-card p-3 border border-white/[0.06]">
            <div className="text-white/40 text-xs mb-2">Quick Actions</div>
            <div className="flex flex-col gap-1.5">
              <Link href={`/emergency?severity=${detectedSeverity}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/20
                           text-brand-red text-sm font-semibold hover:bg-brand-red/15 transition-all">
                <AlertTriangle className="w-4 h-4" />
                Emergency Mode
              </Link>
              <Link href="/report"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]
                           text-white/60 text-sm hover:text-white hover:bg-white/[0.07] transition-all">
                📍 Report Road Issue
              </Link>
              {location && (
                <button
                  onClick={handleShareLocationContacts}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]
                             text-white/60 text-sm hover:text-white hover:bg-white/[0.07] transition-all w-full text-left"
                >
                  📤 Share My Location
                </button>
              )}
              <button
                onClick={clearChat}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]
                           text-white/40 text-sm hover:text-white/60 hover:bg-white/[0.07] transition-all w-full text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Chat
              </button>
            </div>
          </div>

          {/* Emergency numbers */}
          <div className="glass-card p-3 border border-brand-red/10 bg-brand-red/[0.03] mt-auto">
            <div className="text-brand-red/70 text-xs font-semibold mb-2">🚨 Emergency Numbers</div>
            {[['🇮🇳 India', '112 / 108 / 100'], ['🇧🇩 Bangladesh', '999 / 199'], ['🇱🇰 Sri Lanka', '119 / 110']].map(([c, n]) => (
              <div key={c} className="flex justify-between text-xs py-0.5">
                <span className="text-white/40">{c}</span>
                <span className="text-white/70 font-mono">{n}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Chat area */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-brand-blue-mid/30">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-orange/20 to-brand-orange-dark/10 border border-brand-orange/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-brand-orange" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand-green border-2 border-brand-blue" />
              </div>
              <div>
                <div className="font-display font-semibold text-white text-sm">Road Safety AI</div>
                <div className="text-white/40 text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-green inline-block" />
                  Online · {country} mode
                  {roadType && roadType.type !== 'unknown' && (
                    <span className="hidden sm:inline">
                      · <span className="text-white/30">{roadType.label}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile country picker toggle */}
              <button
                onClick={() => setShowCountryPicker(!showCountryPicker)}
                className="lg:hidden flex items-center gap-1.5 glass border border-white/10 px-2.5 py-1.5 rounded-lg text-xs text-white/60"
              >
                <Globe className="w-3.5 h-3.5" />
                {country}
              </button>
              <button
                onClick={clearChat}
                className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile country picker dropdown */}
          <AnimatePresence>
            {showCountryPicker && (
              <motion.div
                className="lg:hidden flex flex-wrap gap-1.5 px-4 py-2 border-b border-white/[0.06] bg-brand-blue-mid/50"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                {COUNTRIES.map(c => (
                  <button
                    key={c}
                    onClick={() => { setCountry(c); setShowCountryPicker(false) }}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                      country === c ? 'bg-brand-orange/20 text-brand-orange' : 'bg-white/5 text-white/50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto py-4 space-y-1"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <MessageBubble key={msg.id} message={msg} index={i} />
              ))}
            </AnimatePresence>

            {isLoading && (
              messages.length === 0
                ? <ChatSkeleton />
                : <TypingIndicator />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom area: chips + input */}
          <div className="border-t border-white/[0.06] bg-brand-blue-mid/30 safe-bottom">
            <QuickChips onSelect={handleSend} />
            <div className="px-4 pb-4 pt-2">
              <ChatInput
                onSend={handleSend}
                onLocationShare={handleLocationShare}
                onVehicleSelect={handleVehicleSelect}
                isLoading={isLoading}
                hasLocation={!!location}
                showVehicleSelector={showVehicleSelector}
                selectedVehicle={selectedVehicle}
              />
            </div>
          </div>
        </div>
      </div>

      {/* OCR Scan floating button */}
      <FloatingScanButton onClick={() => setShowOCRModal(true)} />
      <OCRScannerModal isOpen={showOCRModal} onClose={() => setShowOCRModal(false)} />
    </div>
  )
}
