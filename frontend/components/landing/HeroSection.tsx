'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { AlertTriangle, MapPin, ChevronDown } from 'lucide-react'

function useCounter(target: number, duration = 2200, delay = 0) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setStarted(true), delay); return () => clearTimeout(t) }, [delay])
  useEffect(() => {
    if (!started) return
    const step = target / (duration / 16)
    let cur = 0
    const t = setInterval(() => {
      cur = Math.min(cur + step, target)
      setCount(Math.floor(cur))
      if (cur >= target) clearInterval(t)
    }, 16)
    return () => clearInterval(t)
  }, [started, target, duration])
  return count
}

function TypingText({ texts }: { texts: string[] }) {
  const [idx, setIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const cur = texts[idx]
    if (!deleting && displayed.length < cur.length) {
      const t = setTimeout(() => setDisplayed(cur.slice(0, displayed.length + 1)), 60)
      return () => clearTimeout(t)
    }
    if (!deleting && displayed.length === cur.length) {
      const t = setTimeout(() => setDeleting(true), 2500)
      return () => clearTimeout(t)
    }
    if (deleting && displayed.length > 0) {
      const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 30)
      return () => clearTimeout(t)
    }
    if (deleting && displayed.length === 0) { setDeleting(false); setIdx(i => (i + 1) % texts.length) }
  }, [displayed, deleting, idx, texts])
  return (
    <span className="text-brand-orange">
      {displayed}<span className="animate-pulse text-brand-orange ml-0.5">|</span>
    </span>
  )
}

function RoadScene() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-[#050C18] via-transparent to-transparent" />
      {Array.from({ length: 60 }).map((_, i) => (
        <div key={i} className="absolute rounded-full bg-white"
          style={{ width: `${Math.random()*2+0.5}px`, height: `${Math.random()*2+0.5}px`, left: `${Math.random()*100}%`, top: `${Math.random()*65}%`, opacity: Math.random()*0.5+0.05, animation: `pulse ${2+Math.random()*3}s ease-in-out infinite ${Math.random()*2}s` }}
        />
      ))}
      <div className="absolute bottom-0 left-0 right-0 h-52" style={{ background: 'linear-gradient(to top, #1a1a2e 0%, #0f1420 60%, transparent 100%)' }}>
        <div className="absolute left-1/2 top-0 bottom-0 w-px overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="w-1 bg-brand-gold/60 mx-auto" style={{ height: '28px', marginBottom: '28px', animation: `roadScroll 2s linear infinite ${i * 0.2}s` }} />
          ))}
        </div>
        {[{ delay: '0s', dur: '11s', top: 'top-8', emoji: '🚗', size: 'text-2xl', op: '' }, { delay: '-4s', dur: '8s', top: 'top-16', emoji: '🚙', size: 'text-xl', op: 'opacity-60' }, { delay: '-8s', dur: '15s', top: 'top-5', emoji: '🚕', size: 'text-lg', op: 'opacity-35' }, { delay: '-2s', dur: '13s', top: 'top-20', emoji: '🚑', size: 'text-xl', op: 'opacity-40' }].map((car, i) => (
          <div key={i} className={`absolute ${car.top} ${car.op}`} style={{ animation: `moveRight ${car.dur} linear infinite`, animationDelay: car.delay }}>
            <span className={car.size}>{car.emoji}</span>
          </div>
        ))}
      </div>
      <div className="absolute top-16 right-12 hidden lg:block">
        <motion.div className="flex flex-col items-center gap-1.5 bg-gray-900/80 rounded-xl p-2 border border-white/[0.08]" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.5, repeat: Infinity }}>
          <div className="w-6 h-6 rounded-full" style={{ animation: 'trafficLight 6s steps(1) infinite' }} />
          <div className="w-6 h-6 rounded-full bg-yellow-500/20" />
          <div className="w-6 h-6 rounded-full bg-gray-700" />
          <div className="w-0.5 h-10 bg-gray-700 mx-auto" />
        </motion.div>
      </div>
      <motion.div className="absolute top-24 left-14 hidden lg:block text-5xl" animate={{ y: [-8, 8, -8], rotate: [-4, 4, -4] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>🪖</motion.div>
    </div>
  )
}

export function HeroSection() {
  const lives = useCounter(12450, 2500, 800)
  const challans = useCounter(87000, 2500, 1000)
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 150])
  const opacity = useTransform(scrollY, [0, 400], [1, 0])

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#040B18] via-brand-blue to-[#050C18]">
      <RoadScene />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[700px] h-[700px] rounded-full opacity-[0.18]" style={{ background: 'radial-gradient(circle, rgba(255,98,0,0.35) 0%, transparent 70%)' }} />
      </div>
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <motion.div className="relative z-10 text-center px-4 max-w-5xl mx-auto" style={{ y, opacity }}>
        <motion.div className="inline-flex items-center gap-2 glass border border-brand-orange/20 rounded-full px-4 py-2 mb-6 text-sm" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="w-2 h-2 rounded-full bg-brand-green animate-ping" />
          <span className="text-white/70">Live</span>
          <span className="text-brand-orange font-semibold">BIMSTEC Road Safety Hackathon 2026</span>
          <span className="text-white/50">· Team Bro Code, VIT Bhopal</span>
        </motion.div>

        <motion.h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-tight mb-6" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}>
          <span className="text-white block">AI That Saves Lives</span>
          <span className="block mt-2">
            <TypingText texts={['on Indian Roads', 'across BIMSTEC Nations', 'with Real-Time AI', 'with Emergency Response']} />
          </span>
        </motion.h1>

        <motion.p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed font-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          Know your rights. Report road hazards. Get emergency help instantly.<br />
          <span className="text-brand-orange/80">DriveLegal · RoadWatch · RoadSoS</span>
        </motion.p>

        <motion.div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
          {[
            { value: lives.toLocaleString('en-IN'), suffix: '', label: 'Lives Potentially Saved', icon: '❤️' },
            { value: challans.toLocaleString('en-IN'), suffix: '+', label: 'Challans Explained', icon: '📋' },
            { value: '4.2', suffix: 's', label: 'Avg Emergency Response', icon: '⚡' },
          ].map(stat => (
            <motion.div key={stat.label} className="glass-card px-5 py-3 text-center min-w-[130px]" whileHover={{ y: -3, scale: 1.02 }} transition={{ duration: 0.15 }}>
              <div className="text-xl mb-0.5">{stat.icon}</div>
              <div className="font-display text-2xl font-bold text-brand-orange">{stat.value}{stat.suffix}</div>
              <div className="text-white/50 text-xs">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div className="flex flex-wrap justify-center gap-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
          <Link href="/chat" className="btn-primary flex items-center gap-2 text-base hover:scale-[1.02] active:scale-95">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Start Chat Now
          </Link>
          <Link href="/emergency" className="relative flex items-center gap-2 bg-brand-red text-white font-display font-semibold px-6 py-3 rounded-xl text-base transition-all duration-200 active:scale-95 hover:bg-brand-red-glow overflow-hidden group hover:shadow-glow-red">
            <span className="absolute inset-0 rounded-xl border-2 border-brand-red animate-ping opacity-20" />
            <AlertTriangle className="w-5 h-5 relative z-10" />
            <span className="relative z-10">Activate Emergency Mode</span>
          </Link>
          <Link href="/report" className="btn-ghost flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4" />
            Report Road Issue
          </Link>
        </motion.div>

        <motion.div className="mt-12 flex flex-wrap justify-center items-center gap-3 text-white/30 text-xs font-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
          {['💻 Team Bro Code', '🎓 VIT Bhopal', '🌏 BIMSTEC', '🇮🇳 Govt. of India', '🏛️ @ IIT Madras'].map(badge => (
            <motion.span key={badge} className="flex items-center gap-1 glass px-3 py-1.5 rounded-full border border-white/5 hover:border-white/15 hover:text-white/55 transition-all cursor-default" whileHover={{ y: -2 }}>
              {badge}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>

      <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30" animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
        <ChevronDown className="w-6 h-6" />
      </motion.div>
    </section>
  )
}
