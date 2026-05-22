'use client'

/**
 * NearbyIssuesPanel
 * ─────────────────
 * Shows a compact list of recent road reports near the user,
 * seeded from the local roadwatch_projects.json demo dataset.
 */

import { motion } from 'framer-motion'
import type { RoadWatchReportCardData } from './RoadWatchReportCard'
import projectsRaw from '@/data/roadwatch_projects.json'

const PROJECTS = (projectsRaw as { projects: RoadWatchReportCardData[] }).projects

const STATUS_STYLE: Record<string, string> = {
  pending:     'text-amber-400  bg-amber-400/10  border-amber-400/20',
  in_progress: 'text-blue-400   bg-blue-400/10   border-blue-400/20',
  resolved:    'text-green-400  bg-green-400/10  border-green-400/20',
  rejected:    'text-red-400    bg-red-400/10    border-red-400/20',
}

const STATUS_LABEL: Record<string, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  rejected:    'Rejected',
}

interface Props {
  max?: number
}

export function NearbyIssuesPanel({ max = 3 }: Props) {
  const issues = PROJECTS.slice(0, max)

  if (!issues.length) return null

  return (
    <div className="space-y-2">
      <p className="text-white/30 text-xs flex items-center gap-1.5">
        <span>📍</span> Recent reports near you
      </p>
      {issues.map((issue, i) => (
        <motion.div
          key={issue.ticket_id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06]
                     bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
        >
          <span className="text-xl shrink-0 mt-0.5">{issue.issue_emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-white/80 text-xs font-semibold truncate">{issue.issue_type}</div>
            <div className="text-white/35 text-[11px] truncate">{issue.address}</div>
            {issue.contractor && (
              <div className="text-white/25 text-[10px] mt-0.5 truncate">
                🏗️ {issue.contractor}
              </div>
            )}
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${STATUS_STYLE[issue.status] ?? ''}`}>
            {STATUS_LABEL[issue.status] ?? issue.status}
          </span>
        </motion.div>
      ))}
    </div>
  )
}
