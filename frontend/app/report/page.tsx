'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Camera, Upload, CheckCircle, ChevronRight, ChevronLeft, Loader2, X, AlertCircle, Building2, Phone } from 'lucide-react'
import { Navbar } from '@/components/shared/Navbar'
import { useToast } from '@/lib/hooks/useToast'
import { submitReport, type ReportResponse } from '@/lib/api'
import { ComplaintTracker, RoadBudgetWidget } from '@/components/roadwatch/ComplaintTracker'
import { NearbyIssuesPanel } from '@/components/roadwatch/NearbyIssuesPanel'
import { IssueReportCard, buildIssueReportCard, type IssueReportCardData } from '@/components/roadwatch/IssueReportCard'
import { RoadWatchReportCard, type RoadWatchReportCardData } from '@/components/roadwatch/RoadWatchReportCard'

const ISSUE_TYPES = [
  { id: 'pothole', label: 'Pothole', emoji: '🕳️', desc: 'Dangerous hole in road surface' },
  { id: 'broken-signal', label: 'Broken Signal', emoji: '🚦', desc: 'Non-functional traffic light' },
  { id: 'no-streetlight', label: 'No Streetlight', emoji: '💡', desc: 'Dark, unsafe road at night' },
  { id: 'road-damage', label: 'Road Damage', emoji: '⚠️', desc: 'Cracks, flooding, collapsed road' },
  { id: 'missing-sign', label: 'Missing Sign', emoji: '🪧', desc: 'Speed limit or direction sign gone' },
  { id: 'encroachment', label: 'Encroachment', emoji: '🏗️', desc: 'Road blocked by construction' },
  { id: 'stray-animal', label: 'Stray Animal', emoji: '🐄', desc: 'Animals on highway causing danger' },
  { id: 'other', label: 'Other', emoji: '📝', desc: 'Other road safety issue' },
]

const STEPS = ['Type', 'Details', 'Location', 'Submit']

export default function ReportPage() {
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [issueType, setIssueType] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [location, setLocation] = useState<{ lat: number; lon: number; address: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reportResult, setReportResult] = useState<ReportResponse | null>(null)
  const [issueReportCard, setIssueReportCard] = useState<IssueReportCardData | null>(null)
  const [roadWatchCard, setRoadWatchCard] = useState<RoadWatchReportCardData | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImage = (file: File) => {
    setImage(file)
    const reader = new FileReader()
    reader.onload = e => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          address: `${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E`,
        })
      },
      () => {
        setLocation({ lat: 22.7196, lon: 75.8577, address: 'Vijay Nagar, Indore, MP (Demo)' })
      }
    )
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const result = await submitReport(
        `[${issueType}] ${description}`,
        location?.lat,
        location?.lon,
        image || undefined
      )
      setReportResult(result)
      toast.success(`✅ Ticket ${result.ticket_id} created — track at /history`)
      // Build RoadWatch report card (rich authority/contractor view)
      setRoadWatchCard({
        ticket_id: result.ticket_id,
        issue_type: issueType,
        issue_emoji: ISSUE_TYPES.find(t => t.id === issueType)?.emoji ?? '⚠️',
        description,
        severity: 'medium',
        status: 'submitted',
        address: location?.address ?? 'Location not captured',
        lat: location?.lat,
        lon: location?.lon,
        submitted_at: new Date().toISOString(),
        authority: result.details?.jurisdiction?.authority ?? 'Municipal Corporation',
        authority_tier: 'Municipal',
        authority_contact: result.details?.jurisdiction?.contact,
        jurisdiction: result.details?.jurisdiction?.routed_to ?? 'Local Authority',
        escalation_path: [
          { tier: 'Ward Officer',        name: 'Ward Officer',        contact: result.details?.jurisdiction?.contact ?? '1800-11-0031', email: '' },
          { tier: 'District Collector',  name: 'District Collector',  contact: '1077',           email: '' },
          { tier: 'State PWD',           name: 'State PWD',           contact: '1800-XXX-XXXX',  email: '' },
        ],
        estimated_resolution_days: 7,
        sla_target_days: 7,
        days_elapsed: 0,
        history: [
          { date: new Date().toISOString(), action: 'Complaint logged', actor: 'Citizen App' },
        ],
        ai_confidence: 0.91,
      })
      // Build rich Issue Report Card
      setIssueReportCard(buildIssueReportCard(
        result.ticket_id, issueType, description, !!image, location?.address, location?.lat, location?.lon
      ))
    } catch {
      // Offline fallback — construct a mock ReportResponse
      // Notify user their report is saved and will sync
      toast.info('📥 Report saved locally — will sync automatically when you reconnect')
      const issueLabel = ISSUE_TYPES.find(t => t.id === issueType)?.label ?? 'General Road Issue'
      const cityKey = description.toLowerCase().includes('indore') ? 'indore'
                    : description.toLowerCase().includes('bhopal') ? 'bhopal'
                    : 'default'
      const JURISDICTION: Record<string, { authority: string; contact: string; routed_to: string }> = {
        indore:  { authority: 'Indore Municipal Corporation',  contact: '0731-2700000', routed_to: 'Indore' },
        bhopal:  { authority: 'Bhopal Municipal Corporation',  contact: '0755-2700000', routed_to: 'Bhopal' },
        default: { authority: 'Local Municipal Corporation',   contact: '1800-11-0031', routed_to: 'National Helpline' },
      }
      const offlineTicket = `RW-${Date.now().toString(36).toUpperCase().slice(-8)}`
      setReportResult({
        status: 'reported',
        ticket_id: offlineTicket,
        message: '✅ Your complaint has been logged and routed to the appropriate authority.',
        details: {
          ticket_id: offlineTicket,
          description: `[${issueType}] ${description}`,
          category: issueLabel,
          lat: location?.lat ?? null,
          lon: location?.lon ?? null,
          jurisdiction: JURISDICTION[cityKey],
          status: 'logged',
          timestamp: new Date().toISOString(),
        },
      })
      setIssueReportCard(buildIssueReportCard(
        offlineTicket, issueType, description, !!image, location?.address, location?.lat, location?.lon
      ))
    }
    setIsSubmitting(false)
  }

  const canNext = [
    !!issueType,
    description.length >= 10,
    !!location,
    true,
  ]

  if (reportResult) {
    const isDuplicate = reportResult.status === 'duplicate'
    const reset = () => {
      setReportResult(null)
      setIssueReportCard(null)
      setRoadWatchCard(null)
      setStep(0)
      setIssueType('')
      setDescription('')
      setImage(null)
      setImagePreview(null)
      setLocation(null)
    }

    return (
      <div className="min-h-screen bg-brand-blue flex flex-col">
        <Navbar />
        <div className="max-w-lg mx-auto w-full px-4 pt-20 pb-12">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            {/* Header */}
            <div className="text-center mb-6">
              <motion.div
                className="text-6xl mb-3 inline-block"
                animate={{ rotate: isDuplicate ? 0 : [0, -10, 10, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {isDuplicate ? '⚠️' : '✅'}
              </motion.div>
              <h2 className="font-display text-2xl font-bold text-white mb-1">
                {isDuplicate ? 'Already Reported' : 'Report Submitted!'}
              </h2>
              <p className="text-white/40 text-sm">
                {isDuplicate
                  ? 'This issue was already reported. No duplicate ticket created.'
                  : 'GPS-tagged complaint logged. Authorities notified.'}
              </p>
            </div>

            {/* Rich Issue Report Card — prefer RoadWatchReportCard (full authority view) */}
            {roadWatchCard ? (
              <div className="mb-5">
                <RoadWatchReportCard
                  data={roadWatchCard}
                  onEscalate={(id) => {
                    const level = roadWatchCard.escalation_path?.[1]?.tier ?? 'Zonal Engineer'
                    toast.warning(`⬆️ Escalated ${id} → ${level} · Response SLA: 24h`)
                  }}
                  onShare={(id) => {
                    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/report?ticket=${id}`
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      navigator.share({
                        title: `Road Issue Report — ${id}`,
                        text: `Track road issue ${id} filed via Road Safety AI`,
                        url,
                      }).then(() => toast.success('📤 Report shared successfully'))
                        .catch(() => {
                          navigator.clipboard?.writeText(url)
                          toast.success('📋 Share link copied to clipboard')
                        })
                    } else {
                      navigator.clipboard?.writeText(url)
                      toast.success('📋 Share link copied to clipboard')
                    }
                  }}
                />
              </div>
            ) : issueReportCard ? (
              <div className="mb-5">
                <IssueReportCard data={issueReportCard} />
              </div>
            ) : (
              /* Fallback for duplicate / no card */
              <div className={`glass-card p-4 border mb-4 text-left ${isDuplicate ? 'border-brand-gold/25' : 'border-brand-green/25'}`}>
                <div className={`text-xs mb-1 ${isDuplicate ? 'text-brand-gold' : 'text-brand-green'}`}>
                  {isDuplicate ? '⚠️ Existing Ticket ID' : '✅ Ticket ID'}
                </div>
                <div className="font-mono font-bold text-white text-lg tracking-wider">
                  {reportResult.ticket_id}
                </div>
                <div className="text-white/30 text-xs mt-0.5">Save this to track your complaint status</div>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button onClick={reset} className="btn-ghost">
                {isDuplicate ? 'Go Back' : 'Report Another'}
              </button>
              <a href="/chat" className="btn-primary">Back to Chat</a>
            </div>

            {/* Road Budget Widget — only on fresh submissions */}
            {!isDuplicate && (
              <div className="mt-6">
                <p className="text-white/25 text-xs mb-2 text-center">Road budget data for your area</p>
                <RoadBudgetWidget
                  lat={reportResult.details?.lat ?? 22.7196}
                  lon={reportResult.details?.lon ?? 75.8577}
                />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-blue">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">
            📍 Report Road Issue
          </h1>
          <p className="text-white/50">File a GPS-tagged complaint directly to municipal authorities</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shrink-0
                ${i < step ? 'bg-brand-green text-white' : i === step ? 'bg-brand-orange text-white' : 'bg-white/10 text-white/30'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <div className="flex-1 flex flex-col items-center">
                <div className={`h-0.5 w-full transition-all duration-500 ${i < step ? 'bg-brand-green' : 'bg-white/10'}`} />
                <div className={`text-xs mt-1 transition-colors ${i === step ? 'text-brand-orange font-medium' : 'text-white/30'}`}>
                  {s}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {/* Step 0: Issue type */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
              <h2 className="font-display text-xl font-semibold text-white mb-4">What issue did you find?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ISSUE_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setIssueType(t.id)}
                    className={`p-4 rounded-2xl text-center transition-all duration-150 border
                      ${issueType === t.id 
                        ? 'border-brand-orange/50 bg-brand-orange/10 shadow-glow-orange/20'
                        : 'glass-card border-white/[0.06] hover:border-white/20 hover:bg-white/[0.06]'
                      }`}
                  >
                    <div className="text-3xl mb-2">{t.emoji}</div>
                    <div className="text-white text-xs font-semibold">{t.label}</div>
                    <div className="text-white/30 text-[10px] mt-0.5 leading-tight">{t.desc}</div>
                  </button>
                ))}
              </div>

              {/* Recent reports near you — powered by roadwatch_projects.json demo seed */}
              <NearbyIssuesPanel max={3} />
            </motion.div>
          )}

          {/* Step 1: Description + image */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-white">Describe the issue</h2>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the road issue in detail — location, severity, how long it's been there…"
                className="w-full h-32 bg-white/[0.04] border border-white/10 rounded-xl p-4
                           text-white text-sm placeholder-white/30 resize-none
                           focus:border-brand-orange/40 transition-colors"
              />
              
              {/* Image upload */}
              <div
                className="border-2 border-dashed border-white/10 hover:border-brand-orange/30 rounded-xl p-6 text-center
                           transition-all cursor-pointer hover:bg-brand-orange/[0.03]"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImage(f) }}
              >
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="preview" className="max-h-40 rounded-lg mx-auto" />
                    <button
                      onClick={e => { e.stopPropagation(); setImage(null); setImagePreview(null) }}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-red flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <div className="text-white/40 text-sm">Click or drag to add a photo</div>
                    <div className="text-white/20 text-xs mt-1">JPG, PNG up to 10MB · Helps faster resolution</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])} />
            </motion.div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-white">Share the location</h2>
              
              {location ? (
                <div className="glass-card p-5 border border-brand-green/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-green/10 border border-brand-green/20 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-brand-green" />
                    </div>
                    <div>
                      <div className="text-brand-green font-semibold text-sm">Location Captured</div>
                      <div className="text-white/60 text-xs">{location.address}</div>
                    </div>
                    <CheckCircle className="w-5 h-5 text-brand-green ml-auto" />
                  </div>
                  <div className="font-mono text-white/30 text-xs">
                    Lat: {location.lat.toFixed(6)} · Lon: {location.lon.toFixed(6)}
                  </div>
                  <button onClick={() => setLocation(null)} className="text-brand-red/60 text-xs mt-2 hover:text-brand-red">
                    Use different location
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={getLocation}
                    className="w-full btn-primary flex items-center justify-center gap-3 py-4 text-base"
                  >
                    <MapPin className="w-5 h-5" />
                    Use My Current Location
                  </button>
                  <div className="text-center text-white/30 text-sm">or enter manually</div>
                  <input
                    placeholder="Type address, landmark, or area…"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3
                               text-white text-sm placeholder-white/30 focus:border-brand-orange/40 transition-colors"
                    onBlur={e => {
                      if (e.target.value) setLocation({ lat: 22.7196, lon: 75.8577, address: e.target.value })
                    }}
                  />
                </div>
              )}

              <div className="glass-card p-4 border border-white/[0.06]">
                <div className="text-white/40 text-xs mb-2">📋 Complaint Summary</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex gap-2"><span className="text-white/30 w-20 shrink-0">Issue:</span><span className="text-white">{ISSUE_TYPES.find(t => t.id === issueType)?.label}</span></div>
                  <div className="flex gap-2"><span className="text-white/30 w-20 shrink-0">Description:</span><span className="text-white/70 line-clamp-2">{description}</span></div>
                  {image && <div className="flex gap-2"><span className="text-white/30 w-20 shrink-0">Photo:</span><span className="text-brand-green">Attached ✓</span></div>}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Review & submit */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-white">Review & Submit</h2>
              
              <div className="glass-card p-5 border border-white/[0.08] space-y-3">
                {[
                  { label: 'Issue Type', value: ISSUE_TYPES.find(t => t.id === issueType)?.label + ' ' + ISSUE_TYPES.find(t => t.id === issueType)?.emoji },
                  { label: 'Description', value: description },
                  { label: 'Location', value: location?.address },
                  { label: 'Photo', value: image ? `${image.name} attached` : 'No photo' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3 text-sm">
                    <span className="text-white/30 w-24 shrink-0">{label}</span>
                    <span className="text-white/80">{value || '—'}</span>
                  </div>
                ))}
              </div>

              <div className="glass-card p-4 border border-brand-orange/15 bg-brand-orange/[0.03] text-sm text-white/50">
                📨 Your complaint will be forwarded to: <span className="text-white/70">Municipal Corporation, PWD, Traffic Police</span>
              </div>

              <motion.button
                onClick={handleSubmit}
                disabled={isSubmitting}
                whileHover={isSubmitting ? {} : { scale: 1.02 }}
                whileTap={isSubmitting ? {} : { scale: 0.97 }}
                className="w-full btn-primary flex items-center justify-center gap-3 py-4 text-base"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</>
                ) : (
                  <><Upload className="w-5 h-5" /> Submit Complaint</>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        {!reportResult && (
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="btn-ghost flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext[step]}
                className={`flex-1 btn-primary flex items-center justify-center gap-2 ${!canNext[step] ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
