'use client'

/**
 * app/settings/page.tsx  (v21)
 * Adds: Emergency Contacts manager (IndexedDB), "Take Tour" button.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from '@/components/shared/Navbar'
import {
  Globe, Trash2, Bell, Shield, Info, ChevronRight, Smartphone,
  Check, AlertCircle, ExternalLink, UserPlus, Phone, X, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getUserEmergencyContacts, saveUserEmergencyContact, deleteUserEmergencyContact,
  type UserEmergencyContact,
} from '@/lib/db'
import { useToast } from '@/lib/hooks/useToast'
import { OnboardingModal } from '@/components/shared/OnboardingModal'

const LANGUAGES = [
  { code: 'en', label: 'English',  native: 'English'   },
  { code: 'hi', label: 'Hindi',    native: 'हिन्दी'     },
  { code: 'bn', label: 'Bengali',  native: 'বাংলা'      },
  { code: 'ta', label: 'Tamil',    native: 'தமிழ்'     },
  { code: 'si', label: 'Sinhala',  native: 'සිංහල'     },
  { code: 'ne', label: 'Nepali',   native: 'नेपाली'     },
]

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className={cn('relative w-11 h-6 rounded-full transition-all duration-250 focus:outline-none active:scale-95', on ? 'bg-[#FF6200]' : 'bg-white/15')}>
      <div className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-250', on ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  )
}

type ClearType = 'chat' | 'all' | null

export default function SettingsPage() {
  const { toast } = useToast()
  const [language,      setLanguage]      = useState('en')
  const [notifications, setNotifications] = useState(true)
  const [locationAuto,  setLocationAuto]  = useState(false)
  const [offlineMode,   setOfflineMode]   = useState(true)
  const [soundAlerts,   setSoundAlerts]   = useState(true)
  const [highContrast,  setHighContrast]  = useState(false)
  const [confirmClear,  setConfirmClear]  = useState<ClearType>(null)
  const [cleared,       setCleared]       = useState<ClearType>(null)

  // v21 Emergency contacts
  const [contacts,      setContacts]      = useState<UserEmergencyContact[]>([])
  const [newName,       setNewName]       = useState('')
  const [newPhone,      setNewPhone]      = useState('')
  const [addLoading,    setAddLoading]    = useState(false)
  const [delLoading,    setDelLoading]    = useState<number | null>(null)

  // v21 Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false)

  const loadContacts = useCallback(async () => {
    try { setContacts(await getUserEmergencyContacts()) } catch {}
  }, [])

  useEffect(() => { loadContacts() }, [loadContacts])

  const handleAdd = async () => {
    const name = newName.trim(), phone = newPhone.trim()
    if (!name || !phone) { toast({ variant: 'warning', title: 'Required', message: 'Enter name and phone.' }); return }
    if (!/^[+\d\s\-()]{7,15}$/.test(phone)) { toast({ variant: 'warning', title: 'Invalid phone', message: 'Enter a valid phone number.' }); return }
    setAddLoading(true)
    try {
      await saveUserEmergencyContact({ name, phone })
      setNewName(''); setNewPhone('')
      await loadContacts()
      toast({ variant: 'success', title: 'Saved', message: `${name} added as emergency contact.` })
    } catch (e: unknown) {
      toast({ variant: 'error', title: 'Error', message: e instanceof Error ? e.message : 'Failed.' })
    } finally { setAddLoading(false) }
  }

  const handleDelete = async (id: number) => {
    setDelLoading(id)
    try {
      await deleteUserEmergencyContact(id)
      await loadContacts()
      toast({ variant: 'success', title: 'Removed', message: 'Contact deleted.' })
    } catch { toast({ variant: 'error', title: 'Error', message: 'Failed to delete.' }) }
    finally { setDelLoading(null) }
  }

  const handleTakeTour = () => {
    try { localStorage.removeItem('rs_onboarded') } catch {}
    setShowOnboarding(true)
  }

  const handleClear = (type: ClearType) => {
    if (confirmClear === type) { setCleared(type); setConfirmClear(null); setTimeout(() => setCleared(null), 2500) }
    else { setConfirmClear(type); setTimeout(() => setConfirmClear(null), 3000) }
  }

  const sv = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

  return (
    <div className="min-h-screen bg-brand-blue">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16 space-y-4">

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-white mb-1">Settings</h1>
          <p className="text-white/35 text-sm">Customize your Road Safety AI experience</p>
        </motion.div>

        {/* ── Emergency Contacts (v21) ── */}
        <motion.div className="glass-card p-5 border border-white/[0.07]" variants={sv} initial="hidden" animate="show" transition={{ delay: 0.04 }}>
          <div className="flex items-center gap-3 mb-2">
            <Phone className="w-5 h-5 text-[#FF6200]" aria-hidden="true" />
            <h2 className="font-display font-semibold text-white text-lg">Emergency Contacts</h2>
            <span className="ml-auto text-white/30 text-xs">{contacts.length}/3</span>
          </div>
          <p className="text-white/35 text-xs mb-4 leading-relaxed">
            Up to 3 contacts. On Crash Mode activation, Road Safety AI sends an SOS SMS deep-link to each contact.
          </p>
          <div className="space-y-2 mb-3">
            {contacts.length === 0 && <p className="text-white/25 text-sm text-center py-3">No contacts saved yet</p>}
            {contacts.map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{c.name}</p>
                  <p className="text-white/40 text-xs">{c.phone}</p>
                </div>
                <button onClick={() => handleDelete(c.id!)} disabled={delLoading === c.id}
                  aria-label={`Delete ${c.name}`}
                  className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors">
                  {delLoading === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                </button>
              </div>
            ))}
          </div>
          {contacts.length < 3 && (
            <div className="space-y-2">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Contact name" aria-label="Emergency contact name" maxLength={40}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#FF6200]/40" />
              <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder="+91 98765 43210" aria-label="Emergency contact phone" maxLength={15}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/25 text-sm focus:outline-none focus:border-[#FF6200]/40" />
              <button onClick={handleAdd} disabled={addLoading || !newName.trim() || !newPhone.trim()}
                aria-label="Add emergency contact"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FF6200] text-white text-sm font-semibold hover:bg-[#e05600] transition-colors disabled:opacity-40 min-h-[44px]">
                {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Add Contact
              </button>
            </div>
          )}
          {contacts.length >= 3 && <p className="text-white/30 text-xs text-center">Maximum 3 contacts. Delete one to add another.</p>}
        </motion.div>

        {/* ── Language ── */}
        <motion.div className="glass-card p-5 border border-white/[0.07]" variants={sv} initial="hidden" animate="show" transition={{ delay: 0.08 }}>
          <div className="flex items-center gap-3 mb-4"><Globe className="w-5 h-5 text-[#FF6200]" aria-hidden="true" /><h2 className="font-display font-semibold text-white text-lg">Language</h2></div>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map(lang => (
              <button key={lang.code} onClick={() => setLanguage(lang.code)} aria-pressed={language === lang.code}
                className={cn('flex flex-col items-start px-4 py-2.5 rounded-xl border text-left transition-all min-h-[44px]',
                  language === lang.code ? 'bg-[#FF6200]/15 border-[#FF6200]/30 text-[#FF6200]' : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.07]')}>
                <span className="text-xs font-medium">{lang.label}</span>
                <span className="text-[10px] opacity-60 mt-0.5">{lang.native}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Notifications ── */}
        <motion.div className="glass-card p-5 border border-white/[0.07]" variants={sv} initial="hidden" animate="show" transition={{ delay: 0.12 }}>
          <div className="flex items-center gap-3 mb-4"><Bell className="w-5 h-5 text-[#FF6200]" aria-hidden="true" /><h2 className="font-display font-semibold text-white text-lg">Notifications & Behaviour</h2></div>
          <div className="flex flex-col divide-y divide-white/[0.05]">
            {[
              { label: 'Push Notifications',  sub: 'Proximity alerts and SLA updates',       value: notifications, set: setNotifications },
              { label: 'Auto-Share Location', sub: 'Share location automatically in emergency', value: locationAuto, set: setLocationAuto },
              { label: 'Offline Mode',        sub: 'Cache map tiles and violations DB',        value: offlineMode,  set: setOfflineMode  },
              { label: 'Sound Alerts',        sub: 'Audio cue on risk radar triggers',         value: soundAlerts,  set: setSoundAlerts  },
            ].map(({ label, sub, value, set }) => (
              <div key={label} className="flex items-center justify-between py-3.5">
                <div><p className="text-white text-sm font-medium">{label}</p><p className="text-white/35 text-xs mt-0.5">{sub}</p></div>
                <Toggle on={value} onChange={set} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Accessibility ── */}
        <motion.div className="glass-card p-5 border border-white/[0.07]" variants={sv} initial="hidden" animate="show" transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-3 mb-4"><Smartphone className="w-5 h-5 text-[#FF6200]" aria-hidden="true" /><h2 className="font-display font-semibold text-white text-lg">Accessibility</h2></div>
          <div className="flex items-center justify-between py-2">
            <div><p className="text-white text-sm font-medium">High Contrast Mode</p><p className="text-white/35 text-xs mt-0.5">Better visibility for outdoor use</p></div>
            <Toggle on={highContrast} onChange={setHighContrast} />
          </div>
        </motion.div>

        {/* ── Data & Privacy ── */}
        <motion.div className="glass-card p-5 border border-white/[0.07]" variants={sv} initial="hidden" animate="show" transition={{ delay: 0.18 }}>
          <div className="flex items-center gap-3 mb-4"><Shield className="w-5 h-5 text-[#FF6200]" aria-hidden="true" /><h2 className="font-display font-semibold text-white text-lg">Data & Privacy</h2></div>
          <div className="flex flex-col gap-2">
            {(['chat', 'all'] as ClearType[]).filter(Boolean).map(key => (
              <button key={key!} onClick={() => handleClear(key)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all min-h-[44px]',
                  key === 'all' ? 'bg-red-500/5 border-red-500/15 hover:bg-red-500/10 text-red-400' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] text-white/60',
                  confirmClear === key && 'border-red-500/40 bg-red-500/10',
                )}>
                <div className="flex items-center gap-2.5 text-sm">
                  {cleared === key ? <Check className="w-4 h-4 text-green-400 shrink-0" /> : confirmClear === key ? <AlertCircle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" /> : <Trash2 className="w-4 h-4 shrink-0" />}
                  <div>
                    <p className="font-medium">{cleared === key ? '✓ Cleared' : confirmClear === key ? 'Tap again to confirm' : key === 'chat' ? 'Clear Chat History' : 'Clear All Data'}</p>
                    <p className="text-xs opacity-50 mt-0.5">{key === 'chat' ? 'Removes all saved conversations' : 'Resets app to factory defaults'}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-35 shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── About ── */}
        <motion.div className="glass-card p-5 border border-white/[0.07]" variants={sv} initial="hidden" animate="show" transition={{ delay: 0.22 }}>
          <div className="flex items-center gap-2 mb-4"><Info className="w-5 h-5 text-[#FF6200]" aria-hidden="true" /><h2 className="font-display font-semibold text-white text-lg">About</h2></div>
          <div className="space-y-2 mb-4">
            {[
              ['Version',  'v21 FINAL — BIMSTEC Hackathon Build'],
              ['Event',    'BIMSTEC Road Safety Hackathon 2026'],
              ['Venue',    'IIT Madras · CoERS + RBG Labs'],
              ['Team',     'Bro Code — VIT Bhopal'],
              ['Nations',  '🇮🇳 🇧🇩 🇱🇰 🇳🇵 🇲🇲 🇧🇹 🇹🇭'],
              ['Model',    'BiLSTM + MiniLM-L6-v2 + Gemini Flash'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 py-1.5 border-b border-white/[0.04] last:border-0 text-sm">
                <span className="text-white/30 w-20 shrink-0">{k}</span>
                <span className="text-white/60">{v}</span>
              </div>
            ))}
          </div>
          {/* Take Tour (v21) */}
          <button onClick={handleTakeTour} aria-label="Restart onboarding tour"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.08] hover:text-white transition-colors min-h-[44px] mb-2">
            🗺️ Take Tour
          </button>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-[#FF6200]/70 hover:text-[#FF6200] text-sm transition-colors">
            <ExternalLink className="w-4 h-4" /> View on GitHub
          </a>
        </motion.div>

      </div>

      {/* Onboarding modal (v21) */}
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  )
}
