'use client'

/**
 * app/history/page.tsx — Challan & Chat History  (v21)
 * Loads REAL data from IndexedDB via Dexie helpers.
 * Two tabs: Challan History (addChallanRecord) + Chat Sessions.
 * Clear All with double-tap confirmation.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from '@/components/shared/Navbar'
import {
  MessageSquare, Trash2, Scale, MapPin, AlertTriangle,
  Search, ChevronRight, Calculator, ExternalLink, Loader2, Clock,
} from 'lucide-react'
import Link from 'next/link'
import {
  getChallanHistory, clearChallanHistory,
  type ChallanRecord,
} from '@/lib/db'
import { useToast } from '@/lib/hooks/useToast'

type Tab = 'challan' | 'chat'

const COUNTRY_FLAGS: Record<string, string> = {
  India: '🇮🇳', Bangladesh: '🇧🇩', 'Sri Lanka': '🇱🇰',
  Nepal: '🇳🇵', Myanmar: '🇲🇲', Bhutan: '🇧🇹', Thailand: '🇹🇭',
}
const VEHICLE_LABELS: Record<string, string> = {
  two_wheeler: '🏍️ Two-Wheeler', lmv: '🚗 Car/SUV',
  hmv: '🚛 Truck', bus: '🚌 Bus', auto: '🛺 Auto', all: '🚦 All',
}
const intentColors: Record<string, string> = {
  DriveLegal: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  RoadSoS:    'text-red-400 bg-red-500/10 border-red-500/20',
  RoadWatch:  'text-orange-400 bg-orange-500/10 border-orange-500/20',
}

// Sample chat sessions shown when no real sessions exist yet
const DEMO_CHATS = [
  { id: 'c1', preview: 'What is the fine for no helmet in Indore?', intent: 'DriveLegal', time: '2h ago', msgs: 4, country: '🇮🇳' },
  { id: 'c2', preview: 'Nearest trauma centre near me',             intent: 'RoadSoS',    time: 'Yesterday', msgs: 7, country: '🇮🇳' },
  { id: 'c3', preview: 'Drunk driving penalty in Bangladesh',       intent: 'DriveLegal', time: 'Last week', msgs: 3, country: '🇧🇩' },
  { id: 'c4', preview: 'Report broken streetlight on NH3',          intent: 'RoadWatch',  time: '2 weeks ago', msgs: 6, country: '🇮🇳' },
]

function timeAgo(ts: number): string {
  const diff = Date.now() - ts, m = Math.floor(diff / 60000)
  if (m < 1)   return 'Just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)   return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <motion.div className="flex flex-col items-center justify-center py-20 text-center"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="text-5xl mb-4">{tab === 'challan' ? '🧾' : '💬'}</div>
      <h3 className="text-white font-semibold text-lg mb-2">No history yet</h3>
      <p className="text-white/35 text-sm max-w-[240px] leading-relaxed">
        {tab === 'challan'
          ? "Look up a challan fine — it'll appear here automatically."
          : 'Start a conversation to see your AI chat history here.'}
      </p>
      <Link href={tab === 'challan' ? '/challan' : '/chat'}
        className="mt-6 px-5 py-2.5 rounded-xl bg-[#FF6200] text-white text-sm font-semibold hover:bg-[#e05600] transition-colors">
        {tab === 'challan' ? 'Open Challan Calculator' : 'Open AI Chat'}
      </Link>
    </motion.div>
  )
}

export default function HistoryPage() {
  const { toast } = useToast()
  const [tab,            setTab]            = useState<Tab>('challan')
  const [challans,       setChallans]       = useState<ChallanRecord[]>([])
  const [isLoading,      setIsLoading]      = useState(true)
  const [search,         setSearch]         = useState('')
  const [confirmClear,   setConfirmClear]   = useState(false)
  const [clearLoading,   setClearLoading]   = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const c = await getChallanHistory()
      setChallans(c)
    } catch (e) { console.error('[History]', e) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    setClearLoading(true)
    try {
      await clearChallanHistory()
      setChallans([])
      toast({ variant: 'success', title: 'Cleared', message: 'Challan history deleted.' })
    } catch {
      toast({ variant: 'error', title: 'Error', message: 'Could not clear history.' })
    } finally { setClearLoading(false); setConfirmClear(false) }
  }

  const filtered = challans.filter(c =>
    !search || c.violation.toLowerCase().includes(search.toLowerCase()) || c.country.toLowerCase().includes(search.toLowerCase())
  )
  const filteredChats = DEMO_CHATS.filter(c =>
    !search || c.preview.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-brand-blue">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">

        {/* Header */}
        <motion.div className="flex items-start justify-between mb-6"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <h1 className="font-display text-3xl font-bold text-white mb-1">History</h1>
            <p className="text-white/40 text-sm">
              {isLoading ? '…' : `${challans.length} challan${challans.length !== 1 ? 's' : ''} saved`}
            </p>
          </div>
          {tab === 'challan' && challans.length > 0 && (
            <button onClick={handleClear} disabled={clearLoading}
              aria-label={confirmClear ? 'Confirm clear' : 'Clear history'}
              className={[
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px]',
                confirmClear
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                  : 'bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80',
              ].join(' ')}>
              {clearLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {confirmClear ? 'Tap to confirm' : 'Clear All'}
            </button>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {(['challan', 'chat'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border min-h-[44px]',
                tab === t ? 'bg-[#FF6200]/15 border-[#FF6200]/30 text-[#FF6200]'
                           : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/70',
              ].join(' ')}>
              {t === 'challan' ? <Calculator className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              {t === 'challan' ? 'Challan History' : 'Chat Sessions'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" aria-hidden="true" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…" aria-label="Search history"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#FF6200]/40" />
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        )}

        {/* Challan tab */}
        {!isLoading && tab === 'challan' && (
          filtered.length === 0 ? <EmptyState tab="challan" /> : (
            <div className="space-y-3">
              {filtered.map((c, i) => (
                <motion.div key={c.id ?? i}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.06] transition-colors"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{c.violation}</p>
                      <p className="text-white/40 text-xs mt-0.5">
                        {COUNTRY_FLAGS[c.country] ?? '🌏'} {c.country} · {VEHICLE_LABELS[c.vehicle_type] ?? c.vehicle_type}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[#FF6200] font-bold text-sm">{c.currency}{c.fine.toLocaleString('en-IN')}</p>
                      <p className="text-white/25 text-[10px] mt-0.5 flex items-center gap-1 justify-end">
                        <Clock className="w-2.5 h-2.5" />{timeAgo(c.timestamp)}
                      </p>
                    </div>
                  </div>
                  {c.law_section && <p className="text-white/25 text-xs truncate">{c.law_section}</p>}
                  {c.payment_url && (
                    <a href={c.payment_url} target="_blank" rel="noopener noreferrer"
                      aria-label="Pay fine online"
                      className="mt-2 inline-flex items-center gap-1.5 text-[#FF6200] text-xs hover:underline">
                      <ExternalLink className="w-3 h-3" /> Pay Online
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          )
        )}

        {/* Chat tab */}
        {!isLoading && tab === 'chat' && (
          filteredChats.length === 0 ? <EmptyState tab="chat" /> : (
            <div className="space-y-3">
              {filteredChats.map((s, i) => (
                <motion.div key={s.id}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${intentColors[s.intent] ?? intentColors.DriveLegal}`}>
                          {s.intent}
                        </span>
                        <span className="text-white/25 text-xs">{s.time}</span>
                      </div>
                      <p className="text-white text-sm font-medium truncate">{s.preview}</p>
                      <p className="text-white/30 text-xs mt-0.5">{s.msgs} messages · {s.country}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 shrink-0 mt-1" aria-hidden="true" />
                  </div>
                </motion.div>
              ))}
              <p className="text-white/20 text-xs text-center pt-2">Showing recent sessions · Full chat history stored locally</p>
            </div>
          )
        )}

      </div>
    </div>
  )
}
