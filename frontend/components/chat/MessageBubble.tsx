'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Bot, User, ShieldCheck, Scale, MapPin, AlertTriangle } from 'lucide-react'
import { formatTime } from '@/lib/utils'
import type { Message } from './types'
import { HierarchyResolutionCard } from '@/components/challan/HierarchyResolutionCard'

const intentColors: Record<string, string> = {
  DriveLegal: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  RoadSoS: 'text-red-400 bg-red-500/10 border-red-500/20',
  RoadWatch: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Emergency:  'text-red-400 bg-red-500/15 border-red-500/30',
  Scan:       'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Map:        'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  Authority:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Dashboard:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  General:    'text-white/40 bg-white/5 border-white/10',
}

const intentIcons: Record<string, React.ReactNode> = {
  DriveLegal: <Scale className="w-3 h-3" />,
  RoadSoS: <AlertTriangle className="w-3 h-3" />,
  RoadWatch: <MapPin className="w-3 h-3" />,
  Emergency:  <AlertTriangle className="w-3 h-3" />,
  Scan:       <span className="text-[10px]">📷</span>,
  Map:        <span className="text-[10px]">🗺️</span>,
  Authority:  <span className="text-[10px]">🏛</span>,
  Dashboard:  <span className="text-[10px]">📊</span>,
}

const VEHICLE_BADGE: Record<string, string> = {
  two_wheeler: '🏍️ Two-Wheeler',
  lmv: '🚗 Car / SUV',
  hmv: '🚛 Truck',
  bus: '🚌 Bus',
  auto: '🛺 Auto',
}

// Parse markdown-like content
function parseContent(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <p key={i} className="font-semibold text-white mb-1">{line.slice(2, -2)}</p>
    }
    if (line.startsWith('• ')) {
      return (
        <div key={i} className="flex gap-2 mb-1">
          <span className="text-brand-orange mt-0.5 shrink-0">•</span>
          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
        </div>
      )
    }
    if (line === '') return <div key={i} className="h-2" />
    return (
      <p
        key={i}
        className="mb-1 leading-relaxed"
        dangerouslySetInnerHTML={{
          __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white/90">$1</strong>'),
        }}
      />
    )
  })
}

export function TypingIndicator() {
  return (
    <motion.div
      className="flex items-end gap-2 px-4 py-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange/20 to-brand-orange-dark/20 border border-brand-orange/20 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-brand-orange" />
      </div>
      <div className="bubble-ai px-4 py-3">
        <div className="flex items-center gap-1.5">
          {/* Road-themed typing: cars as dots */}
          {['🚗', '🚙', '🚕'].map((car, i) => (
            <span
              key={i}
              className="typing-dot text-base"
              style={{ display: 'inline-block', animation: `bounce-dot 1.2s ease-in-out infinite ${i * 0.2}s` }}
            >
              {car}
            </span>
          ))}
          <span className="text-white/30 text-xs ml-1">AI is thinking...</span>
        </div>
      </div>
    </motion.div>
  )
}


// ── ActionCard — rendered when message has an action_url ─────────────────────
function ActionCard({ url, label, intent }: { url: string; label: string; intent: string }) {
  const gradients: Record<string, string> = {
    Scan:      'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-300',
    Map:       'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-300',
    Authority: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-300',
    Dashboard: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-300',
  }
  const style = gradients[intent] || 'from-brand-orange/20 to-brand-orange-dark/10 border-brand-orange/30 text-brand-orange'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-3"
    >
      <Link
        href={url}
        className={`
          flex items-center justify-between gap-3
          px-4 py-3 rounded-xl border bg-gradient-to-r
          ${style}
          hover:scale-[1.02] active:scale-[0.98]
          transition-all duration-150 group
        `}
      >
        <span className="font-semibold text-sm">{label}</span>
        <span className="text-lg group-hover:translate-x-1 transition-transform duration-150">→</span>
      </Link>
    </motion.div>
  )
}

export function MessageBubble({ message, index }: { message: Message; index: number }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      className={`flex items-end gap-2 px-4 py-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: 'easeOut' }}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-1
        ${isUser 
          ? 'bg-gradient-to-br from-brand-orange to-brand-orange-dark' 
          : 'bg-gradient-to-br from-brand-blue-light to-brand-blue-accent/20 border border-brand-orange/20'
        }`}
      >
        {isUser 
          ? <User className="w-4 h-4 text-white" />
          : <Bot className="w-4 h-4 text-brand-orange" />
        }
      </div>

      <div className={`max-w-[80%] md:max-w-[65%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Intent badge (AI only) */}
        {!isUser && message.intent && message.intent !== 'General' && (
          <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${intentColors[message.intent] || intentColors.General}`}>
            {intentIcons[message.intent]}
            <span>{message.intent}</span>
            {message.confidence && (
              <span className="opacity-60">· {Math.round(message.confidence * 100)}%</span>
            )}
            {/* Vehicle type badge on DriveLegal */}
            {message.intent === 'DriveLegal' && message.vehicleType && VEHICLE_BADGE[message.vehicleType] && (
              <span className="ml-1 px-1.5 py-0 rounded bg-brand-orange/15 text-brand-orange border border-brand-orange/25 text-[10px]">
                {VEHICLE_BADGE[message.vehicleType]}
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={`px-4 py-3 text-sm leading-relaxed ${isUser ? 'bubble-user' : 'bubble-ai'}`}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="text-white/80 space-y-0.5">
              {parseContent(message.content)}
              {/* Hierarchy resolution card (DriveLegal responses) */}
              {message.hierarchyData && (
                <div className="mt-3">
                  <HierarchyResolutionCard data={message.hierarchyData} compact />
                </div>
              )}
              {/* Action deep-link card (Scan / Map / Authority / Dashboard) */}
              {message.action_url && message.action_label && (
                <ActionCard
                  url={message.action_url}
                  label={message.action_label}
                  intent={message.intent || ''}
                />
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-white/25 text-xs px-1">
          {formatTime(message.timestamp)}
        </div>
      </div>
    </motion.div>
  )
}
