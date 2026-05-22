'use client'

import { motion } from 'framer-motion'
import { QUICK_CHIPS } from '@/lib/utils'

interface QuickChipsProps {
  onSelect: (query: string) => void
}

export function QuickChips({ onSelect }: QuickChipsProps) {
  return (
    <div className="py-2">
      <div className="text-white/30 text-xs px-4 mb-2 font-body">Quick Questions</div>
      <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide pb-1"
        style={{ scrollbarWidth: 'none' }}>
        {QUICK_CHIPS.map((chip, i) => (
          <motion.button
            key={chip.label}
            onClick={() => onSelect(chip.query)}
            className="chip-hover shrink-0 glass border border-white/10 hover:border-brand-orange/30
                       text-white/70 hover:text-white bg-white/[0.03] hover:bg-brand-orange/5
                       text-sm px-3.5 py-2 rounded-full whitespace-nowrap transition-colors duration-150"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            {chip.label}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
