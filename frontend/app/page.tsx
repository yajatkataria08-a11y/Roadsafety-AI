'use client'

/**
 * app/page.tsx — Landing Page (integrated v1+v2)
 * Adds first-run onboarding detection from v1 via localStorage 'rs_onboarded'.
 */

import { useEffect, useState } from 'react'
import { Navbar } from '@/components/shared/Navbar'
import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { OnboardingModal } from '@/components/shared/OnboardingModal'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function HomePage() {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    // Show onboarding on first visit only (v1 feature)
    try {
      if (!localStorage.getItem('rs_onboarded')) {
        const t = setTimeout(() => setShowOnboarding(true), 800)
        return () => clearTimeout(t)
      }
    } catch {}
  }, [])

  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <section className="py-24 px-4 text-center bg-gradient-to-b from-brand-blue to-[#040B18]">
        <div className="max-w-2xl mx-auto">
          <div className="text-4xl mb-4">🚦</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Ready to Make Roads{' '}
            <span className="text-gradient-orange">Safer?</span>
          </h2>
          <p className="text-white/50 mb-8">Join thousands using AI to navigate traffic laws, report hazards, and stay safe.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/chat" className="btn-primary text-lg px-8 py-4">Start Chat — It&apos;s Free</Link>
            <Link
              href="/auth"
              className="flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all border rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:border-brand-orange"
            >
              Sign In
            </Link>
            <Link href="/emergency" className="btn-danger flex items-center gap-2 text-lg px-8 py-4">
              <AlertTriangle className="w-5 h-5" />Emergency Mode
            </Link>
          </div>
        </div>
      </section>
      <footer className="border-t border-white/[0.05] py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4 text-white/30 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-brand-orange font-display font-bold">Road Safety AI</span>
            <span>— BIMSTEC Hackathon 2026</span>
          </div>
          <div>Made with ❤️ by Team Bro Code · VIT Bhopal · Competing at IIT Madras</div>
        </div>
      </footer>

      {/* v1: First-run onboarding modal */}
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </main>
  )
}
