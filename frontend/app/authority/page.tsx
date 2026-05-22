'use client'

/**
 * app/authority/page.tsx — Ward-Level Authority Analytics Dashboard  (v21)
 * ════════════════════════════════════════════════════════════════════════════
 * Demonstrates government-impact use case for judges.
 * Indore Municipal Corporation ward performance — realistic data.
 * Pure SVG bar chart, animated counters, sortable table, CSV export.
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2, Clock, CheckCircle2, Download, Activity,
  IndianRupee, Users, Building2, ArrowUpDown, AlertTriangle,
} from 'lucide-react'
import { Navbar } from '@/components/shared/Navbar'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WardRow {
  ward:       string
  complaints: number
  resolved:   number
  slaBreach:  number
  budget:     number   // ₹ lakhs allocated
  spent:      number   // ₹ lakhs spent
  authority:  string
  helpline:   string
}
type SortKey = keyof Pick<WardRow, 'ward' | 'complaints' | 'resolved' | 'slaBreach' | 'budget'>
type SortDir = 'asc' | 'desc'

// ── Static data ───────────────────────────────────────────────────────────────

const WARDS: WardRow[] = [
  { ward: 'Vijay Nagar',    complaints: 312, resolved: 218, slaBreach: 12, budget: 48, spent: 31, authority: 'Aditi Sharma',   helpline: '0731-2551001' },
  { ward: 'Rajwada',        complaints: 287, resolved: 190, slaBreach: 18, budget: 42, spent: 29, authority: 'Ramesh Patel',   helpline: '0731-2552002' },
  { ward: 'Palasia',        complaints: 198, resolved: 155, slaBreach:  4, budget: 36, spent: 24, authority: 'Sunita Verma',   helpline: '0731-2553003' },
  { ward: 'Indore Cantt',   complaints: 145, resolved: 112, slaBreach:  3, budget: 28, spent: 18, authority: 'Col. S. Thakur', helpline: '0731-2554004' },
  { ward: 'Sanyogitaganj',  complaints: 231, resolved: 142, slaBreach: 22, budget: 40, spent: 27, authority: 'Deepak Joshi',   helpline: '0731-2555005' },
  { ward: 'Banganga',       complaints: 178, resolved: 130, slaBreach:  7, budget: 32, spent: 20, authority: 'Priya Chouhan',  helpline: '0731-2556006' },
  { ward: 'Aerodrome',      complaints: 110, resolved:  98, slaBreach:  2, budget: 24, spent: 16, authority: 'Ankit Malviya',  helpline: '0731-2557007' },
  { ward: 'Tejaji Nagar',   complaints: 164, resolved: 101, slaBreach:  9, budget: 30, spent: 22, authority: 'Reena Singh',    helpline: '0731-2558008' },
  { ward: 'Malharganj',     complaints: 203, resolved: 138, slaBreach: 14, budget: 38, spent: 26, authority: 'Vikram Rathore', helpline: '0731-2559009' },
  { ward: 'Azad Nagar',     complaints: 142, resolved: 105, slaBreach:  6, budget: 26, spent: 17, authority: 'Kavita Dubey',   helpline: '0731-2560010' },
  { ward: 'Lasudia',        complaints: 189, resolved: 118, slaBreach: 11, budget: 34, spent: 23, authority: 'Mahesh Sharma',  helpline: '0731-2561011' },
  { ward: 'Pardeshipura',   complaints: 122, resolved:  88, slaBreach:  8, budget: 22, spent: 15, authority: 'Geeta Patidar',  helpline: '0731-2562012' },
  { ward: 'Bicholi Hapsi',  complaints: 156, resolved: 110, slaBreach:  5, budget: 28, spent: 19, authority: 'Ajay Pandey',    helpline: '0731-2563013' },
  { ward: 'Khajrana',       complaints: 198, resolved: 132, slaBreach: 16, budget: 36, spent: 25, authority: 'Mohan Yadav',    helpline: '0731-2564014' },
  { ward: 'Kanadiya',       complaints: 112, resolved:  90, slaBreach:  3, budget: 20, spent: 13, authority: 'Sonia Tiwari',   helpline: '0731-2565015' },
]

const ISSUE_TYPES = [
  { label: 'Potholes',       count: 987, color: '#FF6200' },
  { label: 'Traffic Lights', count: 543, color: '#3b82f6' },
  { label: 'Street Lights',  count: 412, color: '#f59e0b' },
  { label: 'Encroachment',   count: 378, color: '#8b5cf6' },
  { label: 'Flooding',       count: 264, color: '#06b6d4' },
  { label: 'Signage',        count: 198, color: '#10b981' },
  { label: 'Speed Bumps',    count:  65, color: '#f43f5e' },
]

const RECENT = [
  { id: 'RS-8821', type: 'Pothole',       status: 'resolved',    ward: 'Vijay Nagar',  time: '5m ago'  },
  { id: 'RS-8820', type: 'Street Light',  status: 'in_progress', ward: 'Palasia',      time: '18m ago' },
  { id: 'RS-8819', type: 'Encroachment',  status: 'pending',     ward: 'Rajwada',      time: '34m ago' },
  { id: 'RS-8818', type: 'Traffic Light', status: 'in_progress', ward: 'Banganga',     time: '1h ago'  },
  { id: 'RS-8817', type: 'Pothole',       status: 'resolved',    ward: 'Aerodrome',    time: '1h ago'  },
  { id: 'RS-8816', type: 'Flooding',      status: 'pending',     ward: 'Malharganj',   time: '2h ago'  },
  { id: 'RS-8815', type: 'Signage',       status: 'resolved',    ward: 'Khajrana',     time: '3h ago'  },
  { id: 'RS-8814', type: 'Speed Bump',    status: 'in_progress', ward: 'Lasudia',      time: '4h ago'  },
  { id: 'RS-8813', type: 'Pothole',       status: 'pending',     ward: 'Sanyogitaganj',time: '5h ago'  },
  { id: 'RS-8812', type: 'Street Light',  status: 'resolved',    ward: 'Azad Nagar',   time: '6h ago'  },
]

// ── useCountUp ────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, suffix = '', sub, Icon, color }: {
  label: string; value: number; suffix?: string; sub?: string
  Icon: React.ElementType; color: string
}) {
  const count = useCountUp(value)
  return (
    <motion.div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5"
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}20` }}>
        <Icon className="w-4.5 h-4.5" style={{ color }} aria-hidden="true" />
      </div>
      <div className="text-3xl font-bold text-white font-mono">
        {count.toLocaleString('en-IN')}<span className="text-lg ml-0.5">{suffix}</span>
      </div>
      <div className="text-white/50 text-sm mt-1">{label}</div>
      {sub && <div className="text-white/30 text-xs mt-0.5">{sub}</div>}
    </motion.div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, string> = {
    resolved:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    in_progress: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    pending:     'text-white/50 bg-white/5 border-white/10',
  }
  const l: Record<string, string> = { resolved: 'Resolved', in_progress: 'In Progress', pending: 'Pending' }
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${s[status] ?? s.pending}`}>
      {l[status] ?? status}
    </span>
  )
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV() {
  const headers = ['Ward','Complaints','Resolved','Resolution%','SLA Breached','Budget(L)','Spent(L)','Utilisation%','Authority','Helpline']
  const rows = WARDS.map(w => [
    w.ward, w.complaints, w.resolved,
    `${((w.resolved / w.complaints) * 100).toFixed(1)}%`,
    w.slaBreach, w.budget, w.spent,
    `${((w.spent / w.budget) * 100).toFixed(1)}%`,
    w.authority, w.helpline,
  ])
  const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `indore-ward-performance-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuthorityPage() {
  const [sortKey, setSortKey] = useState<SortKey>('complaints')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const total     = WARDS.reduce((a, w) => a + w.complaints, 0)
  const resolved  = WARDS.reduce((a, w) => a + w.resolved, 0)
  const budget    = WARDS.reduce((a, w) => a + w.budget, 0)
  const spent     = WARDS.reduce((a, w) => a + w.spent, 0)
  const maxIssue  = Math.max(...ISSUE_TYPES.map(t => t.count))

  const sorted = [...WARDS].sort((a, b) => {
    const av = a[sortKey] as number | string
    const bv = b[sortKey] as number | string
    if (sortDir === 'asc') return av > bv ? 1 : -1
    return av < bv ? 1 : -1
  })

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  return (
    <div className="min-h-screen bg-brand-blue">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 pt-24 pb-16 space-y-8">

        {/* Header */}
        <motion.div className="flex items-start justify-between flex-wrap gap-3"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <h1 className="font-display text-3xl font-bold text-white mb-1 flex items-center gap-3">
              <Building2 className="w-7 h-7 text-[#FF6200]" aria-hidden="true" />
              Authority Dashboard
            </h1>
            <p className="text-white/40 text-sm">Indore Municipal Corporation · Ward-Level Road Safety Performance</p>
          </div>
          <button onClick={exportCSV} aria-label="Export ward data as CSV"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6200] text-white text-sm font-semibold hover:bg-[#e05600] transition-colors active:scale-95 min-h-[44px]">
            <Download className="w-4 h-4" aria-hidden="true" /> Export CSV
          </button>
        </motion.div>

        {/* ── 1. City Overview ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Complaints" value={total}                                        suffix="" sub="all 15 wards"            Icon={Activity}      color="#FF6200" />
          <StatCard label="Resolution Rate"  value={Math.round((resolved / total) * 100)}        suffix="%" sub="target: 75%"            Icon={CheckCircle2}  color="#10b981" />
          <StatCard label="Avg SLA"          value={18}                                           suffix=" days" sub="target: 21 days"   Icon={Clock}         color="#3b82f6" />
          <StatCard label="Budget Utilised"  value={Math.round((spent / budget) * 100)}          suffix="%" sub={`₹${spent}L / ₹${budget}L`} Icon={IndianRupee} color="#f59e0b" />
        </div>

        {/* ── 2. Ward Performance Table ── */}
        <motion.div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-[#FF6200]" aria-hidden="true" /> Ward Performance
            </h2>
            <span className="text-white/30 text-xs">Click headers to sort</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="grid" aria-label="Ward performance">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {([['ward','Ward'],['complaints','Complaints'],['resolved','Resolved %'],['slaBreach','SLA Breach'],['budget','Budget']] as [SortKey,string][]).map(([k, label]) => (
                    <th key={k} onClick={() => handleSort(k)}
                      className="text-left px-4 py-3 text-white/40 text-xs font-medium cursor-pointer hover:text-white/70 transition-colors select-none"
                      role="columnheader" aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      {label}
                      <ArrowUpDown className={`w-3 h-3 ml-1 inline transition-colors ${sortKey === k ? 'text-[#FF6200]' : 'text-white/20'}`} aria-hidden="true" />
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-white/40 text-xs font-medium">Authority</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((w, i) => {
                  const resPct  = Math.round((w.resolved / w.complaints) * 100)
                  const spentPct = Math.round((w.spent / w.budget) * 100)
                  return (
                    <motion.tr key={w.ward}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                      <td className="px-4 py-3 text-white font-medium">{w.ward}</td>
                      <td className="px-4 py-3 text-white/70">{w.complaints}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${resPct}%` }} />
                          </div>
                          <span className="text-white/60 text-xs">{resPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-xs ${w.slaBreach > 5 ? 'text-red-400 font-bold' : 'text-white/50'}`}>
                          {w.slaBreach > 5 && <AlertTriangle className="w-3 h-3 inline mr-1" />}{w.slaBreach}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#FF6200]" style={{ width: `${spentPct}%` }} />
                          </div>
                          <span className="text-white/40 text-xs">₹{w.spent}L</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white/70 text-xs">{w.authority}</p>
                        <a href={`tel:${w.helpline}`} className="text-[#FF6200] text-xs hover:underline">{w.helpline}</a>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── 3. Issue Breakdown — pure SVG ── */}
        <motion.div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#FF6200]" aria-hidden="true" /> Issue Type Breakdown
          </h2>
          <svg viewBox="0 0 460 210" className="w-full" role="img" aria-label="Issue types by count">
            {ISSUE_TYPES.map((item, i) => {
              const barW = (item.count / maxIssue) * 310
              const y    = i * 28 + 10
              return (
                <g key={item.label}>
                  <text x="0" y={y + 13} fill="rgba(255,255,255,0.45)" fontSize={10}>{item.label}</text>
                  <rect x={120} y={y} width={barW} height={16} rx={4} fill={item.color} opacity={0.85} />
                  <text x={120 + barW + 6} y={y + 12} fill="rgba(255,255,255,0.55)" fontSize={10}>{item.count}</text>
                </g>
              )
            })}
          </svg>
        </motion.div>

        {/* ── 4. Recent Activity ── */}
        <motion.div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 px-6 py-4 border-b border-white/[0.06]">
            <Activity className="w-4 h-4 text-[#FF6200]" aria-hidden="true" />
            <h2 className="text-white font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {RECENT.map((item, i) => (
              <motion.div key={item.id} className="flex items-center gap-3 px-6 py-3"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
                <span className="font-mono text-xs text-[#FF6200] shrink-0 w-16">{item.id}</span>
                <span className="text-white/70 text-sm flex-1 truncate">{item.type}</span>
                <StatusBadge status={item.status} />
                <span className="text-white/30 text-xs hidden sm:inline shrink-0">{item.ward}</span>
                <span className="text-white/25 text-xs shrink-0">{item.time}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
