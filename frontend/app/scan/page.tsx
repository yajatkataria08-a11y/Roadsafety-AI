'use client'

import { Navbar } from '@/components/shared/Navbar'
import { OCRScanner } from '@/components/ocr/OCRScanner'
import { motion } from 'framer-motion'
import { ScanLine, Zap, Globe, FileText } from 'lucide-react'

const FEATURES = [
  {
    icon: <Zap className="w-4 h-4 text-brand-orange" />,
    label: 'AI-Powered',
    desc: 'Server OCR with instant client-side fallback',
  },
  {
    icon: <Globe className="w-4 h-4 text-brand-green" />,
    label: 'Hindi + English',
    desc: 'Bilingual challan recognition via pytesseract',
  },
  {
    icon: <FileText className="w-4 h-4 text-blue-400" />,
    label: '7 BIMSTEC Nations',
    desc: 'MV Act 2019 + regional traffic law coverage',
  },
]

export default function ScanPage() {
  return (
    <div className="flex flex-col min-h-screen bg-brand-blue overflow-x-hidden">
      <Navbar />

      {/* Road-pattern bg */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 48px, rgba(255,255,255,0.5) 48px, rgba(255,255,255,0.5) 50px)',
        }}
      />

      <div className="flex-1 pt-20 pb-10 px-4 max-w-5xl mx-auto w-full">
        {/* Page header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-brand-orange/10 border border-brand-orange/20 text-brand-orange text-xs font-semibold mb-4">
            <ScanLine className="w-3.5 h-3.5" />
            AI-Powered
          </div>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-white">
            📸 OCR Challan Scanner
          </h1>
          <p className="text-white/50 text-base mt-2 max-w-xl mx-auto font-body">
            Upload a photo of any traffic challan — our server extracts the violation
            in Hindi and English, calculates the fine, and shows the full law hierarchy.
          </p>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          className="flex flex-wrap justify-center gap-3 mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {FEATURES.map(f => (
            <div key={f.label}
              className="flex items-center gap-2 px-3 py-2 rounded-xl
                bg-white/[0.04] border border-white/[0.08] text-sm">
              {f.icon}
              <div>
                <span className="text-white/80 font-semibold font-body">{f.label}</span>
                <span className="text-white/40 font-body ml-1.5 hidden sm:inline">— {f.desc}</span>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Main scanner */}
        <motion.div
          className="max-w-xl mx-auto bg-brand-blue-mid border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,98,0,0.08)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="min-h-[600px] flex flex-col">
            <OCRScanner embedded />
          </div>
        </motion.div>

        {/* Bottom note */}
        <motion.p
          className="text-center text-white/25 text-xs mt-6 font-body"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Powered by pytesseract (server) · Tesseract.js (offline fallback) ·
          Supports MV Act 2019 violations for 7 BIMSTEC nations
        </motion.p>
      </div>
    </div>
  )
}
