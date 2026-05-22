'use client'

import { useState, useRef, KeyboardEvent, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, MapPin, Image, Loader2, AlertTriangle, Mic, MicOff } from 'lucide-react'
import { detectScript, getScriptLabel } from '@/lib/i18n/chatTranslate'
import Link from 'next/link'

// Vehicle options for DriveLegal intent
const VEHICLE_OPTIONS = [
  { type: 'two_wheeler', label: 'Two-Wheeler', icon: '🏍️' },
  { type: 'lmv',        label: 'Car / SUV',    icon: '🚗' },
  { type: 'hmv',        label: 'Truck',         icon: '🚛' },
  { type: 'bus',        label: 'Bus',           icon: '🚌' },
  { type: 'auto',       label: 'Auto',          icon: '🛺' },
] as const

export type VehicleType = (typeof VEHICLE_OPTIONS)[number]['type']

interface ChatInputProps {
  onSend: (message: string) => void
  onLocationShare: () => void
  onVehicleSelect?: (type: VehicleType) => void
  isLoading: boolean
  hasLocation: boolean
  showVehicleSelector?: boolean
  selectedVehicle?: VehicleType | null
}

// ── Web Speech API hook ────────────────────────────────────────────────────────

function useVoiceInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SpeechRecognition)
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      if (transcript) onTranscript(transcript)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [onTranscript])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, supported, startListening, stopListening }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ChatInput({
  onSend,
  onLocationShare,
  onVehicleSelect,
  isLoading,
  hasLocation,
  showVehicleSelector = false,
  selectedVehicle = null,
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // v21: script detection
  const detectedScript  = text.length > 2 ? detectScript(text) : 'latin' as const
  const showScriptBadge = detectedScript !== 'latin' && text.length > 2

  const handleSend = () => {
    if (!text.trim() || isLoading) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const { listening, supported: voiceSupported, startListening, stopListening } = useVoiceInput(
    (transcript) => {
      setText(prev => prev ? `${prev} ${transcript}` : transcript)
      // Auto-focus textarea after voice input
      textareaRef.current?.focus()
    }
  )

  const toggleVoice = () => {
    if (listening) stopListening()
    else startListening()
  }

  return (
    <div
      className={`relative transition-all duration-200 ${dragOver ? 'scale-[1.01]' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false) }}
    >
      {/* Drag zone overlay */}
      <AnimatePresence>
        {dragOver && (
          <motion.div
            className="absolute inset-0 -top-32 bg-brand-orange/10 border-2 border-dashed border-brand-orange/40 rounded-2xl z-10
                       flex items-center justify-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Image className="w-8 h-8 text-brand-orange" />
            <span className="text-brand-orange font-display font-semibold text-lg">Drop image for RoadWatch Analysis</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`glass-strong border rounded-2xl p-3 transition-all ${listening ? 'border-red-500/40 shadow-[0_0_16px_rgba(239,68,68,0.15)]' : 'border-white/10'}`}>
        {/* Voice listening indicator */}
        <AnimatePresence>
          {listening && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 px-1 pb-2 text-red-400">
                <div className="flex gap-0.5 items-end h-4">
                  {[1, 2, 3, 4].map(i => (
                    <motion.div
                      key={i}
                      className="w-1 bg-red-400 rounded-full"
                      animate={{ height: [4, 12, 6, 14, 4] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium">Listening… speak your query</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main input row */}
        <div className="flex items-end gap-2">
          {/* v21: Script badge */}
          <AnimatePresence>
            {showScriptBadge && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="mb-1"
              >
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
                  {detectedScript === 'devanagari' ? '🇮🇳' : detectedScript === 'bengali' ? '🇧🇩' : '🇹🇭'}{' '}
                  {getScriptLabel(detectedScript)} detected — sending to AI
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={listening ? 'Listening…' : 'Ask about traffic fines, road issues, or emergency help…'}
            className="flex-1 bg-transparent text-white placeholder-white/30 text-sm resize-none
                       focus:outline-none leading-relaxed min-h-[40px] max-h-[120px]
                       font-body py-1.5"
            rows={1}
            disabled={isLoading}
          />

          <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
            {/* Voice input button */}
            {voiceSupported && (
              <motion.button
                onClick={toggleVoice}
                title={listening ? 'Stop listening' : 'Voice input (en-IN)'}
                whileTap={{ scale: 0.9 }}
                className={`p-2 rounded-xl transition-all duration-150 ${
                  listening
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                    : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70'
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </motion.button>
            )}

            {/* Location */}
            <button
              onClick={onLocationShare}
              title="Share location"
              className={`p-2 rounded-xl transition-all duration-150
                ${hasLocation
                  ? 'bg-brand-green/15 text-brand-green border border-brand-green/30'
                  : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70'
                }`}
            >
              <MapPin className="w-4 h-4" />
            </button>

            {/* Image upload */}
            <button
              title="Upload road image"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all duration-150"
            >
              <Image className="w-4 h-4" />
            </button>

            {/* Send */}
            <motion.button
              onClick={handleSend}
              disabled={!text.trim() || isLoading}
              className={`p-2.5 rounded-xl font-semibold transition-all duration-150
                ${text.trim() && !isLoading
                  ? 'bg-brand-orange hover:bg-brand-orange-glow text-white shadow-glow-orange/30 active:scale-95'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              whileTap={text.trim() && !isLoading ? { scale: 0.92 } : {}}
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </motion.button>
          </div>
        </div>

        {/* Vehicle Type Quick Selector — shows when DriveLegal intent detected */}
        <AnimatePresence>
          {showVehicleSelector && (
            <motion.div
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 8, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
                <div className="text-white/30 text-[11px] mb-2 font-medium tracking-wide uppercase">
                  🚗 Select vehicle type for accurate challan
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VEHICLE_OPTIONS.map((v) => (
                    <motion.button
                      key={v.type}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onVehicleSelect?.(v.type)}
                      className={`px-3 py-1.5 text-xs rounded-2xl border transition-all
                                  flex items-center gap-1.5 font-medium
                        ${selectedVehicle === v.type
                          ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                          : 'border-white/15 hover:border-brand-orange/50 hover:bg-brand-orange/10 text-white/60 hover:text-white'
                        }`}
                    >
                      <span>{v.icon}</span>
                      <span>{v.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom bar */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.05]">
          <div className="text-white/20 text-xs font-body flex items-center gap-2">
            {hasLocation ? '📍 Location shared' : 'Shift+Enter for new line'}
            {voiceSupported && !hasLocation && (
              <span className="text-white/15">· 🎤 Voice input ready</span>
            )}
          </div>
          <Link
            href="/emergency"
            className="flex items-center gap-1.5 text-brand-red/60 hover:text-brand-red text-xs font-semibold
                       transition-colors duration-150 group"
          >
            <AlertTriangle className="w-3.5 h-3.5 group-hover:animate-pulse" />
            Emergency?
          </Link>
        </div>
      </div>
    </div>
  )
}
