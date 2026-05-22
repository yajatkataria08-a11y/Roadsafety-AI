'use client'

import { motion } from 'framer-motion'
import { ChevronRight, CheckCircle2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HierarchyResolutionData {
  resolution: {
    national: { fine: number; section: string } | null
    state: { fine: number; amendment: string } | null
    city: { fine: number; notes: string } | null
  }
  violation?: string
  recommended_level?: 'city' | 'state' | 'national'
}

interface HierarchyResolutionCardProps {
  data: HierarchyResolutionData
  compact?: boolean
}

const LEVEL_CONFIG = {
  national: {
    label: 'National Law',
    badge: '🇮🇳',
    color: 'from-blue-500/20 to-blue-600/10',
    border: 'border-blue-500/25',
    text: 'text-blue-300',
    stepColor: 'bg-blue-500/40',
  },
  state: {
    label: 'State Amendment',
    badge: '🏛️',
    color: 'from-purple-500/20 to-purple-600/10',
    border: 'border-purple-500/25',
    text: 'text-purple-300',
    stepColor: 'bg-purple-500/40',
  },
  city: {
    label: 'City Enforcement',
    badge: '🏙️',
    color: 'from-brand-orange/20 to-brand-orange-dark/10',
    border: 'border-brand-orange/25',
    text: 'text-brand-orange',
    stepColor: 'bg-brand-orange/40',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HierarchyResolutionCard({ data, compact = false }: HierarchyResolutionCardProps) {
  const { resolution, violation, recommended_level } = data
  const entries = Object.entries(resolution) as [keyof typeof LEVEL_CONFIG, { fine: number; [k: string]: string | number } | null][]
  const activeEntries = entries.filter(([, v]) => v !== null)

  const recommendedLevel = recommended_level ??
    (resolution.city ? 'city' : resolution.state ? 'state' : 'national')

  const recommendedFine = resolution[recommendedLevel]?.fine ?? 0

  return (
    <div className={`rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.02] ${compact ? 'text-xs' : ''}`}>
      {/* Header */}
      {!compact && (
        <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
          <span className="text-base">⚖️</span>
          <div>
            <div className="font-display font-semibold text-white text-sm">Law Hierarchy Resolution</div>
            {violation && (
              <div className="text-white/40 text-xs">{violation}</div>
            )}
          </div>
        </div>
      )}

      {/* Steps */}
      <div className={`relative p-3 space-y-2 ${compact ? 'p-2 space-y-1.5' : ''}`}>
        {/* Vertical connector */}
        {activeEntries.length > 1 && (
          <div className={`absolute left-[26px] top-6 bottom-8 w-px
            bg-gradient-to-b from-blue-500/30 via-purple-500/30 to-brand-orange/30
            ${compact ? 'left-[22px]' : ''}`}
          />
        )}

        {activeEntries.map(([level, val], i) => {
          if (!val) return null
          const cfg = LEVEL_CONFIG[level]
          const isRecommended = level === recommendedLevel
          const fine = val.fine
          const detail = level === 'national'
            ? (val as unknown as { section: string }).section
            : level === 'state'
            ? (val as unknown as { amendment: string }).amendment
            : (val as unknown as { notes: string }).notes

          return (
            <motion.div
              key={level}
              className={`relative flex items-start gap-3 ${compact ? 'gap-2' : ''}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {/* Level icon bubble */}
              <div className={`shrink-0 rounded-full border flex items-center justify-center z-10
                bg-gradient-to-br ${cfg.color} ${cfg.border}
                ${compact ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'}`}
              >
                {cfg.badge}
              </div>

              {/* Card */}
              <div className={`flex-1 rounded-xl border p-3 bg-gradient-to-r
                ${cfg.color} ${cfg.border}
                ${isRecommended ? 'ring-1 ring-brand-orange/30' : ''}
                ${compact ? 'p-2' : 'p-3'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`font-semibold font-body flex items-center gap-1.5 ${cfg.text}
                      ${compact ? 'text-[11px]' : 'text-xs'}`}
                    >
                      {cfg.label}
                      {isRecommended && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] bg-brand-orange/20
                          text-brand-orange border border-brand-orange/30 px-1.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          APPLICABLE
                        </span>
                      )}
                    </div>
                    <div className={`text-white/40 mt-0.5 leading-relaxed line-clamp-2
                      ${compact ? 'text-[10px]' : 'text-[11px]'}`}
                    >
                      {detail}
                    </div>
                  </div>

                  <div className={`shrink-0 font-display font-bold ${cfg.text}
                    ${compact ? 'text-base' : 'text-lg'}`}
                  >
                    ₹{fine.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Step connector arrow */}
              {i < activeEntries.length - 1 && (
                <div className={`absolute -bottom-2 z-20 ${compact ? 'left-3' : 'left-3.5'}`}>
                  <ChevronRight className={`rotate-90 text-white/25 ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Final verdict */}
      <motion.div
        className="mx-3 mb-3 p-3 bg-gradient-to-r from-brand-orange/15 to-brand-orange-dark/5
          border border-brand-orange/35 rounded-xl"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: activeEntries.length * 0.1 + 0.1 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-white/50 font-body ${compact ? 'text-[10px]' : 'text-xs'}`}>
              Challan Amount Payable
            </div>
            <div className={`font-display font-bold text-brand-orange mt-0.5
              ${compact ? 'text-xl' : 'text-2xl'}`}
            >
              ₹{recommendedFine.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-white/30 font-body ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
              Governed by
            </div>
            <div className={`text-white/60 font-semibold capitalize font-body
              ${compact ? 'text-[10px]' : 'text-xs'}`}
            >
              {recommendedLevel} rules
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
