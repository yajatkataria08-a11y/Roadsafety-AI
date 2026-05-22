'use client'

/**
 * IssueReportCard.tsx  — RoadWatch "Issue Report Card"
 * ═══════════════════════════════════════════════════════
 * Equivalent to DriveLegal's SmartChallan — a rich, structured output card
 * that shows severity, responsible authority, estimated resolution, budget
 * transparency, AI image analysis result, and contractor details.
 *
 * HACKATHON VALUE: Balances RoadWatch module to DriveLegal's quality.
 * Citizens can see exactly WHO is responsible, WHEN it will be fixed, and
 * WHERE their tax money went — the governance transparency story.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, CheckCircle2, Clock, Building2, IndianRupee,
  Camera, Shield, ChevronDown, ChevronUp, Zap, MapPin,
  TrendingUp, FileText, Globe, Star, AlertCircle, Hash,
  Calendar, Wrench, Phone, Share2, Copy, CheckCheck,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'
export type IssueStatus = 'submitted' | 'acknowledged' | 'in_progress' | 'resolved' | 'rejected'

export interface IssueReportCardData {
  ticket_id: string
  issue_type: string
  issue_emoji: string
  description: string
  severity: IssueSeverity
  status: IssueStatus
  lat?: number
  lon?: number
  address?: string
  submitted_at: string
  // Authority
  authority: string
  authority_tier: 'Municipal' | 'State' | 'National' | 'District'
  authority_contact?: string
  authority_email?: string
  jurisdiction: string
  estimated_resolution_days: number
  // Contractor / Budget
  road_name?: string
  contractor?: string
  contract_end?: string
  sanctioned_inr?: number
  spent_inr?: number
  last_repair_date?: string
  // AI Image Analysis
  ai_analysis?: {
    detected: boolean
    confidence: number
    type: string
    severity_estimate: IssueSeverity
    recommendation: string
    bimstec_similar?: string
  }
  // BIMSTEC / context
  bimstec_context?: string
  similar_cases?: number
}

// ── Mock data builder ──────────────────────────────────────────────────────────

const ISSUE_TYPE_META: Record<string, {
  authority: string; tier: 'Municipal' | 'State' | 'National' | 'District'
  contact: string; email: string
  resolutionDays: number
  severityDefault: IssueSeverity
  bimstec: string
}> = {
  pothole: {
    authority: 'Indore Municipal Corporation – Roads Dept.',
    tier: 'Municipal', contact: '0731-2700000', email: 'roads@imc.gov.in',
    resolutionDays: 14, severityDefault: 'high',
    bimstec: 'Pothole density in South Asian cities averages 12/km during monsoon season.',
  },
  'broken-signal': {
    authority: 'Indore Traffic Police – Signal Maintenance',
    tier: 'Municipal', contact: '0731-2527272', email: 'traffic@mppolice.gov.in',
    resolutionDays: 3, severityDefault: 'critical',
    bimstec: 'Dysfunctional signals cause 23% of urban intersection accidents in BIMSTEC nations.',
  },
  'road-damage': {
    authority: 'MP Public Works Department',
    tier: 'State', contact: '0755-2573604', email: 'pwd@mp.gov.in',
    resolutionDays: 21, severityDefault: 'high',
    bimstec: 'Post-monsoon road repair backlog affects 40% of State Highway network.',
  },
  'no-streetlight': {
    authority: 'Indore Municipal Corporation – Electricity Dept.',
    tier: 'Municipal', contact: '0731-2700100', email: 'elect@imc.gov.in',
    resolutionDays: 7, severityDefault: 'medium',
    bimstec: 'Poorly lit roads account for 31% of night-time fatalities in SAARC region.',
  },
  'missing-sign': {
    authority: 'NHAI / MP PWD – Signage Division',
    tier: 'State', contact: '1800-11-7788', email: 'signage@nhai.org',
    resolutionDays: 10, severityDefault: 'medium',
    bimstec: 'Missing road signs are cited in 18% of rural accident reports in South Asia.',
  },
  encroachment: {
    authority: 'Indore Municipal Corporation – Enforcement',
    tier: 'Municipal', contact: '0731-2700200', email: 'enforce@imc.gov.in',
    resolutionDays: 5, severityDefault: 'high',
    bimstec: 'Encroachments reduce effective road width by 30% in dense urban corridors.',
  },
  'stray-animal': {
    authority: 'Indore City Forest & Animal Control',
    tier: 'Municipal', contact: '0731-4207777', email: 'animal@imc.gov.in',
    resolutionDays: 2, severityDefault: 'critical',
    bimstec: 'Stray livestock on highways causes 9% of rural highway fatalities in India.',
  },
  other: {
    authority: 'Local Municipal Corporation',
    tier: 'Municipal', contact: '1800-11-0031', email: 'helpline@nic.in',
    resolutionDays: 10, severityDefault: 'medium',
    bimstec: 'Reporting infrastructure hazards improves resolution rates by 3×.',
  },
}

const MOCK_ROAD_DATA = [
  {
    road_name: 'AB Road (Vijay Nagar Stretch)',
    contractor: 'M/s Sharma Construction Pvt. Ltd.',
    contract_end: '2025-03-31',
    sanctioned_inr: 4_20_00_000,
    spent_inr: 3_10_00_000,
    last_repair_date: '2024-08-15',
  },
  {
    road_name: 'Ring Road NH-52 Segment',
    contractor: 'Dilip Buildcon Ltd.',
    contract_end: '2024-12-31',
    sanctioned_inr: 12_50_00_000,
    spent_inr: 11_80_00_000,
    last_repair_date: '2024-11-01',
  },
  {
    road_name: 'Rau-Pithampur Road SH-27',
    contractor: 'M/s Rajesh Infra Works',
    contract_end: '2025-06-30',
    sanctioned_inr: 2_80_00_000,
    spent_inr: 1_90_00_000,
    last_repair_date: '2023-12-10',
  },
]

const AI_ANALYSIS_RESULTS: Record<string, {
  type: string; confidence: number; recommendation: string; severity: IssueSeverity
}> = {
  pothole: {
    type: 'Pothole — Deep cavity >8cm', confidence: 94,
    recommendation: 'Immediate cold-mix patching required. Estimated repair: 2 hrs.',
    severity: 'critical',
  },
  'broken-signal': {
    type: 'Signal Head Failure — Power fault detected', confidence: 88,
    recommendation: 'Manual traffic control needed immediately. Signal unit replacement.',
    severity: 'critical',
  },
  'road-damage': {
    type: 'Surface Crack Network — Alligator cracking', confidence: 91,
    recommendation: 'Full resurfacing of 200m stretch within 30 days to prevent water ingress.',
    severity: 'high',
  },
  'no-streetlight': {
    type: 'Street Light — Ballast failure', confidence: 82,
    recommendation: 'Replace lamp ballast unit. Temporary battery backup until repair.',
    severity: 'medium',
  },
  other: {
    type: 'Road Hazard Detected', confidence: 76,
    recommendation: 'Site inspection required by field engineer within 48 hours.',
    severity: 'medium',
  },
}

export function buildIssueReportCard(
  ticketId: string,
  issueTypeId: string,
  description: string,
  hasImage: boolean,
  address?: string,
  lat?: number,
  lon?: number,
): IssueReportCardData {
  const meta = ISSUE_TYPE_META[issueTypeId] || ISSUE_TYPE_META.other
  const roadData = MOCK_ROAD_DATA[Math.floor(Math.random() * MOCK_ROAD_DATA.length)]
  const aiResult = AI_ANALYSIS_RESULTS[issueTypeId] || AI_ANALYSIS_RESULTS.other

  const severityScore = {
    critical: 4, high: 3, medium: 2, low: 1,
  }[meta.severityDefault] ?? 2

  return {
    ticket_id: ticketId,
    issue_type: issueTypeId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    issue_emoji: {
      pothole: '🕳️', 'broken-signal': '🚦', 'road-damage': '⚠️',
      'no-streetlight': '💡', 'missing-sign': '🪧', encroachment: '🏗️',
      'stray-animal': '🐄', other: '📝',
    }[issueTypeId] ?? '📝',
    description,
    severity: meta.severityDefault,
    status: 'submitted',
    lat, lon, address,
    submitted_at: new Date().toISOString(),
    authority: meta.authority,
    authority_tier: meta.tier,
    authority_contact: meta.contact,
    authority_email: meta.email,
    jurisdiction: 'Indore, Madhya Pradesh',
    estimated_resolution_days: meta.resolutionDays,
    ...roadData,
    ai_analysis: hasImage ? {
      detected: true,
      confidence: aiResult.confidence,
      type: aiResult.type,
      severity_estimate: aiResult.severity,
      recommendation: aiResult.recommendation,
      bimstec_similar: severityScore >= 3 ? 'Similar pattern reported in Dhaka, Bangladesh (2024)' : undefined,
    } : undefined,
    bimstec_context: meta.bimstec,
    similar_cases: Math.floor(Math.random() * 80) + 10,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCrore(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`
  return `₹${n.toLocaleString('en-IN')}`
}

const SEVERITY_CONFIG: Record<IssueSeverity, {
  label: string; color: string; bg: string; border: string; glow: string; icon: string; priority: string
}> = {
  critical: {
    label: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.2)]', icon: '🚨', priority: 'Priority 1 – Immediate',
  },
  high: {
    label: 'HIGH', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/40',
    glow: 'shadow-[0_0_16px_rgba(249,115,22,0.15)]', icon: '⚠️', priority: 'Priority 2 – Urgent',
  },
  medium: {
    label: 'MEDIUM', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/35',
    glow: '', icon: '⚡', priority: 'Priority 3 – Standard',
  },
  low: {
    label: 'LOW', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/25',
    glow: '', icon: '📋', priority: 'Priority 4 – Routine',
  },
}

const STATUS_STEPS = ['submitted', 'acknowledged', 'in_progress', 'resolved']
const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted', acknowledged: 'Acknowledged',
  in_progress: 'In Progress', resolved: 'Resolved',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityMeter({ severity }: { severity: IssueSeverity }) {
  const levels: IssueSeverity[] = ['low', 'medium', 'high', 'critical']
  const idx = levels.indexOf(severity)
  return (
    <div className="flex gap-1 items-center">
      {levels.map((l, i) => (
        <div
          key={l}
          className={`h-2 flex-1 rounded-full transition-all ${
            i <= idx
              ? l === 'critical' ? 'bg-red-500'
              : l === 'high' ? 'bg-orange-500'
              : l === 'medium' ? 'bg-amber-500'
              : 'bg-green-500'
              : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  )
}

function BudgetBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">{label}</span>
        <span className={color}>{formatCrore(value)}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color.includes('orange') ? '#FF6200' : '#00E676' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
      <div className="text-white/25 text-xs text-right">{pct.toFixed(1)}% utilized</div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface IssueReportCardProps {
  data: IssueReportCardData
}

export function IssueReportCard({ data }: IssueReportCardProps) {
  const [showBudget, setShowBudget] = useState(false)
  const [showAI, setShowAI] = useState(!!data.ai_analysis)
  const [copied, setCopied] = useState(false)

  const sev = SEVERITY_CONFIG[data.severity]
  const currentStepIdx = STATUS_STEPS.indexOf(data.status)

  const copyTicket = async () => {
    await navigator.clipboard.writeText(data.ticket_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareReport = () => {
    const text = `🚨 Road Issue Reported\nTicket: ${data.ticket_id}\nType: ${data.issue_type}\nSeverity: ${data.severity.toUpperCase()}\nAuthority: ${data.authority}\nTrack via RoadSafety AI`
    if (navigator.share) navigator.share({ title: 'Road Issue Report', text })
    else navigator.clipboard.writeText(text)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-2xl border ${sev.border} ${sev.glow} overflow-hidden`}
    >
      {/* ── Header: Severity Banner ── */}
      <div className={`${sev.bg} px-4 py-3 flex items-center justify-between border-b ${sev.border}`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{sev.icon}</span>
          <div>
            <div className={`font-bold text-xs tracking-widest ${sev.color}`}>
              {sev.label} SEVERITY
            </div>
            <div className="text-white/40 text-xs">{sev.priority}</div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-mono ${sev.color}`}>{data.ticket_id}</div>
          <div className="text-white/30 text-xs">{new Date(data.submitted_at).toLocaleDateString('en-IN')}</div>
        </div>
      </div>

      <div className="p-4 space-y-4 bg-[rgba(10,22,40,0.6)]">

        {/* ── Issue Summary ── */}
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0">{data.issue_emoji}</span>
          <div className="flex-1">
            <div className="text-white font-semibold text-base">{data.issue_type}</div>
            <div className="text-white/50 text-sm mt-0.5 leading-relaxed">{data.description}</div>
            {data.address && (
              <div className="flex items-center gap-1 text-xs text-white/30 mt-1">
                <MapPin className="w-3 h-3" /> {data.address}
              </div>
            )}
          </div>
        </div>

        {/* ── Severity Meter ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Severity Level</span>
            <span className={sev.color}>{data.similar_cases} similar cases nearby</span>
          </div>
          <SeverityMeter severity={data.severity} />
        </div>

        {/* ── Status Timeline ── */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
          <div className="flex items-center gap-1.5 text-xs text-white/40 mb-3">
            <Clock className="w-3.5 h-3.5" /> Status Timeline
          </div>
          <div className="flex items-center gap-0">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < currentStepIdx ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                    : i === currentStepIdx ? `${sev.bg} border ${sev.border} ${sev.color} animate-pulse`
                    : 'bg-white/5 border border-white/10 text-white/20'
                  }`}>
                    {i < currentStepIdx ? '✓' : i + 1}
                  </div>
                  <div className={`text-[9px] mt-1 text-center leading-tight ${
                    i === currentStepIdx ? sev.color : i < currentStepIdx ? 'text-green-400/70' : 'text-white/20'
                  }`}>
                    {STATUS_LABELS[step]}
                  </div>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mb-4 ${i < currentStepIdx ? 'bg-green-500/30' : 'bg-white/8'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-white/30 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Estimated resolution: <span className={sev.color + ' font-semibold ml-1'}>
              {data.estimated_resolution_days} days
            </span>
            <span className="ml-auto text-white/20">
              By {new Date(Date.now() + data.estimated_resolution_days * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>

        {/* ── Responsible Authority ── */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
            <Building2 className="w-3.5 h-3.5" /> Responsible Authority
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white font-semibold text-sm">{data.authority}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${sev.border} ${sev.color} ${sev.bg}`}>
                  {data.authority_tier}
                </span>
                <span className="text-white/30 text-xs">{data.jurisdiction}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            {data.authority_contact && (
              <a href={`tel:${data.authority_contact}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs hover:bg-green-500/20 transition-all">
                <Phone className="w-3 h-3" /> {data.authority_contact}
              </a>
            )}
            {data.authority_email && (
              <a href={`mailto:${data.authority_email}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/20 transition-all">
                <Globe className="w-3 h-3" /> Email
              </a>
            )}
          </div>
        </div>

        {/* ── AI Image Analysis (if image was attached) ── */}
        {data.ai_analysis && (
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 overflow-hidden">
            <button
              onClick={() => setShowAI(!showAI)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-violet-500/5 transition-all"
            >
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-violet-400" />
                <span className="text-violet-300 text-sm font-semibold">AI Image Analysis</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-400`}>
                  {data.ai_analysis.confidence}% confidence
                </span>
              </div>
              {showAI ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
            </button>
            <AnimatePresence>
              {showAI && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-2 border-t border-violet-500/15">
                    <div className="text-white/70 text-sm pt-2">
                      <span className="text-violet-300 font-semibold">Detected: </span>
                      {data.ai_analysis.type}
                    </div>
                    <div className="text-white/60 text-xs">
                      <span className="text-violet-300/70">Recommendation: </span>
                      {data.ai_analysis.recommendation}
                    </div>
                    {/* Confidence bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-white/30">
                        <span>AI Confidence</span>
                        <span className="text-violet-400">{data.ai_analysis.confidence}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-violet-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${data.ai_analysis.confidence}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                        />
                      </div>
                    </div>
                    {data.ai_analysis.bimstec_similar && (
                      <div className="text-xs text-violet-400/60 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {data.ai_analysis.bimstec_similar}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Budget Transparency (toggle) ── */}
        {data.road_name && (
          <div className="rounded-xl border border-white/[0.08] overflow-hidden">
            <button
              onClick={() => setShowBudget(!showBudget)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.03] transition-all"
            >
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-brand-orange" />
                <span className="text-white/70 text-sm">Budget Transparency</span>
                {data.sanctioned_inr && data.spent_inr && (
                  <span className="text-xs text-white/30">
                    {Math.round((data.spent_inr / data.sanctioned_inr) * 100)}% spent
                  </span>
                )}
              </div>
              {showBudget ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
            </button>
            <AnimatePresence>
              {showBudget && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-3 border-t border-white/[0.06]">
                    <div className="pt-2">
                      <div className="text-white font-medium text-sm">{data.road_name}</div>
                    </div>
                    {data.sanctioned_inr && data.spent_inr && (
                      <div className="space-y-2">
                        <BudgetBar label="Sanctioned Budget" value={data.sanctioned_inr} total={data.sanctioned_inr} color="text-white/60" />
                        <BudgetBar label="Amount Spent" value={data.spent_inr} total={data.sanctioned_inr} color="text-brand-orange" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {data.contractor && (
                        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                          <div className="text-white/30 mb-0.5 flex items-center gap-1"><Wrench className="w-3 h-3" /> Contractor</div>
                          <div className="text-white/70 font-medium leading-tight text-[11px]">{data.contractor}</div>
                        </div>
                      )}
                      {data.last_repair_date && (
                        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                          <div className="text-white/30 mb-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Last Repair</div>
                          <div className="text-white/70 font-medium">{data.last_repair_date}</div>
                        </div>
                      )}
                      {data.contract_end && (
                        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                          <div className="text-white/30 mb-0.5">Contract End</div>
                          <div className="text-white/70 font-medium">{data.contract_end}</div>
                        </div>
                      )}
                      {data.sanctioned_inr && data.spent_inr && (
                        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                          <div className="text-white/30 mb-0.5">Unspent</div>
                          <div className="text-amber-400 font-medium">
                            {formatCrore(data.sanctioned_inr - data.spent_inr)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-white/20 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> PMGSY / Municipal records (mock for demo)
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── BIMSTEC Context ── */}
        {data.bimstec_context && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/[0.06] border border-blue-500/15">
            <Globe className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-blue-400 text-xs font-semibold mb-0.5">BIMSTEC Road Safety Context</div>
              <div className="text-white/50 text-xs leading-relaxed">{data.bimstec_context}</div>
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={copyTicket}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/80 text-xs hover:bg-white/[0.07] transition-all"
          >
            {copied ? <><CheckCheck className="w-3.5 h-3.5 text-green-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Ticket</>}
          </button>
          <button
            onClick={shareReport}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/80 text-xs hover:bg-white/[0.07] transition-all"
          >
            <Share2 className="w-3.5 h-3.5" /> Share Report
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="text-white/20 text-xs text-center border-t border-white/[0.05] pt-3">
          Complaint routed via RoadSafety AI · {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit' })} IST
        </div>
      </div>
    </motion.div>
  )
}
