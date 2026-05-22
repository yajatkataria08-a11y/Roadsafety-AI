'use client'
/**
 * BIMSTECDialer.tsx v2 — 7-Nation Emergency Quick-Dial
 * Uses inline SVG <CountryFlag> instead of emoji strings (offline-safe, retina-crisp)
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, ChevronDown } from 'lucide-react'
import { CountryFlag, type BIMSTECCountryName } from '@/components/shared/CountryFlag'

interface Num { service: string; emoji: string; number: string }
interface Country { name: BIMSTECCountryName; numbers: Num[] }

const DATA: Country[] = [
  { name:'India',      numbers:[{service:'Emergency',emoji:'🆘',number:'112'},{service:'Police',emoji:'🚔',number:'100'},{service:'Ambulance',emoji:'🚑',number:'108'},{service:'Fire',emoji:'🚒',number:'101'}] },
  { name:'Bangladesh', numbers:[{service:'Emergency',emoji:'🆘',number:'999'},{service:'Police',emoji:'🚔',number:'999'},{service:'Ambulance',emoji:'🚑',number:'199'},{service:'Fire',emoji:'🚒',number:'199'}] },
  { name:'Sri Lanka',  numbers:[{service:'Emergency',emoji:'🆘',number:'119'},{service:'Police',emoji:'🚔',number:'118'},{service:'Ambulance',emoji:'🚑',number:'110'},{service:'Fire',emoji:'🚒',number:'111'}] },
  { name:'Nepal',      numbers:[{service:'Emergency',emoji:'🆘',number:'100'},{service:'Police',emoji:'🚔',number:'100'},{service:'Ambulance',emoji:'🚑',number:'102'},{service:'Fire',emoji:'🚒',number:'101'}] },
  { name:'Myanmar',    numbers:[{service:'Emergency',emoji:'🆘',number:'199'},{service:'Police',emoji:'🚔',number:'199'},{service:'Ambulance',emoji:'🚑',number:'192'},{service:'Fire',emoji:'🚒',number:'191'}] },
  { name:'Bhutan',     numbers:[{service:'Emergency',emoji:'🆘',number:'113'},{service:'Police',emoji:'🚔',number:'113'},{service:'Ambulance',emoji:'🚑',number:'112'},{service:'Fire',emoji:'🚒',number:'110'}] },
  { name:'Thailand',   numbers:[{service:'Emergency',emoji:'🆘',number:'191'},{service:'Police',emoji:'🚔',number:'191'},{service:'Ambulance',emoji:'🚑',number:'1669'},{service:'Fire',emoji:'🚒',number:'199'}] },
]

export function BIMSTECDialer({ activeCountry = 'India' }: { activeCountry?: string }) {
  const [expanded, setExpanded] = useState<string>(activeCountry)
  const toggle = (name: string) => setExpanded(p => p === name ? '' : name)

  return (
    <motion.div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden"
      initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}>
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <Phone className="w-4 h-4 text-[#FF6200]" />
        <span className="text-white font-semibold text-sm">BIMSTEC Emergency Numbers</span>
        <span className="ml-auto text-white/30 text-xs">7 nations</span>
      </div>

      {/* Country chips with SVG flags */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
        {DATA.map(c => {
          const isActive = c.name === activeCountry
          const isOpen   = c.name === expanded
          return (
            <motion.button key={c.name} onClick={() => toggle(c.name)}
              whileHover={{ scale:1.04 }} whileTap={{ scale:0.94 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium shrink-0 transition-all ${
                isActive ? 'border-[#FF6200] bg-[#FF6200]/10 text-[#FF6200]'
                : isOpen  ? 'border-white/20 bg-white/10 text-white'
                : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.08]'}`}>
              <span className="rounded-[2px] overflow-hidden" style={{ lineHeight:0 }}>
                <CountryFlag country={c.name} size={16} />
              </span>
              <span className="hidden sm:inline">{c.name}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180':''}`} />
            </motion.button>
          )
        })}
      </div>

      {/* Expanded number grid */}
      <AnimatePresence>
        {expanded && (() => {
          const country = DATA.find(c => c.name === expanded)
          if (!country) return null
          return (
            <motion.div key={expanded}
              initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
              exit={{ height:0, opacity:0 }} transition={{ duration:0.22 }} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <CountryFlag country={country.name} size={20} />
                <span className="text-white/70 text-xs font-semibold">{country.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                {country.numbers.map(n => (
                  <a key={n.service} href={`tel:${n.number}`}
                    className="flex items-center gap-3 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-3 min-h-[44px] hover:bg-white/[0.09] active:scale-95 transition-all">
                    <span className="text-xl">{n.emoji}</span>
                    <div>
                      <p className="text-white/50 text-[10px] truncate">{n.service}</p>
                      <p className="text-white font-bold text-base font-mono leading-tight">{n.number}</p>
                    </div>
                  </a>
                ))}
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </motion.div>
  )
}
