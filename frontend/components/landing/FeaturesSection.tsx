'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Scale, Radio, MapPin, Zap, Globe, ShieldCheck, Map } from 'lucide-react'

const modules = [
  {
    icon: Scale,
    emoji: '⚖️',
    name: 'DriveLegal',
    tagline: 'Know Your Rights',
    description: 'Instant answers on traffic fines, challans, and motor vehicle laws across 7 BIMSTEC nations. Search by city, state, or country.',
    color: 'from-blue-500/20 to-cyan-500/10',
    border: 'border-blue-500/20 hover:border-blue-400/40',
    glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]',
    href: '/chat',
    features: ['No Helmet Fine', 'Signal Jumping', 'Drunk Driving', 'Over-speeding'],
    badge: '7 Countries',
    badgeColor: 'bg-blue-500/20 text-blue-400',
  },
  {
    icon: Radio,
    emoji: '🚨',
    name: 'RoadSoS',
    tagline: 'Emergency Response',
    description: 'GPS-powered emergency locator. Find nearest hospitals, ambulances, and police in seconds. Crash Mode for instant help.',
    color: 'from-red-500/20 to-orange-500/10',
    border: 'border-red-500/20 hover:border-red-400/40',
    glow: 'hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]',
    href: '/emergency',
    features: ['Call 112', 'Nearest Hospital', 'Ambulance Tracker', 'Crash Mode'],
    badge: '24/7 Live',
    badgeColor: 'bg-red-500/20 text-red-400',
  },
  {
    icon: Map,
    emoji: '🗺️',
    name: 'AI Map',
    tagline: 'Intelligent Road Intelligence',
    description: 'Unified live map: emergency services, issue heatmap, speed cameras, black spots, and geo-fence violation alerts as you drive.',
    color: 'from-violet-500/20 to-fuchsia-500/10',
    border: 'border-violet-500/20 hover:border-violet-400/40',
    glow: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.2)]',
    href: '/map',
    features: ['Live Heatmap', 'Camera Alerts', 'Black Spots', 'SOS Beacon'],
    badge: '3 Layers',
    badgeColor: 'bg-violet-500/20 text-violet-400',
  },
  {
    icon: MapPin,
    emoji: '📍',
    name: 'RoadWatch',
    tagline: 'Fix Our Roads',
    description: 'Report potholes, broken signals, dangerous roads. GPS-tagged complaints sent directly to municipal corporations.',
    color: 'from-orange-500/20 to-yellow-500/10',
    border: 'border-orange-500/20 hover:border-orange-400/40',
    glow: 'hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]',
    href: '/report',
    features: ['Report Pothole', 'Broken Signal', 'Photo Upload', 'Ticket Tracking'],
    badge: 'GPS Tagged',
    badgeColor: 'bg-orange-500/20 text-orange-400',
  },
]

const stats = [
  { icon: Zap, value: '< 4s', label: 'Emergency Response', sub: 'Average detection time' },
  { icon: Globe, value: '7', label: 'BIMSTEC Nations', sub: 'India, BD, LK, NP, MM, BT, TH' },
  { icon: ShieldCheck, value: '99.2%', label: 'Uptime', sub: 'Production-grade reliability' },
  { icon: Scale, value: '50,000+', label: 'Laws Indexed', sub: 'Traffic violations database' },
]

export function FeaturesSection() {
  return (
    <section className="relative py-24 px-4 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050C18] to-brand-blue" />
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 glass border border-brand-orange/20 rounded-full px-4 py-1.5 text-sm text-brand-orange/80 mb-4">
            Three Modules, One Platform
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Every Road Safety Need,<br />
            <span className="text-gradient-orange">Covered</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            AI-powered assistance from legal queries to life-saving emergencies.
          </p>
        </motion.div>

        {/* Module cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              <Link href={mod.href} className="block group">
                <div className={`glass-card p-6 border ${mod.border} ${mod.glow} transition-all duration-300 h-full
                                 bg-gradient-to-br ${mod.color}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl">{mod.emoji}</div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${mod.badgeColor}`}>
                      {mod.badge}
                    </span>
                  </div>

                  <h3 className="font-display text-2xl font-bold text-white mb-1">{mod.name}</h3>
                  <div className="text-brand-orange text-sm font-medium mb-3">{mod.tagline}</div>
                  <p className="text-white/60 text-sm leading-relaxed mb-5">{mod.description}</p>

                  {/* Feature pills */}
                  <div className="flex flex-wrap gap-2">
                    {mod.features.map((f) => (
                      <span key={f} className="glass text-white/60 text-xs px-2.5 py-1 rounded-full border border-white/5">
                        {f}
                      </span>
                    ))}
                  </div>

                  {/* Arrow */}
                  <div className="mt-4 flex items-center gap-1 text-white/30 group-hover:text-white/70 transition-colors text-sm">
                    <span>Try now</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Stats row */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          {stats.map(({ icon: Icon, value, label, sub }) => (
            <div key={label} className="glass-card p-5 text-center border border-white/5">
              <Icon className="w-6 h-6 text-brand-orange mx-auto mb-3 opacity-80" />
              <div className="font-display text-2xl font-bold text-white mb-1">{value}</div>
              <div className="text-white/70 text-sm font-medium">{label}</div>
              <div className="text-white/30 text-xs mt-1">{sub}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
