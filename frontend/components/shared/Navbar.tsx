'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, Shield, MessageSquare, AlertTriangle, MapPin, Settings, History, ScanLine, Zap, Map, Calculator, LogIn, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { ConnectionDot } from '@/components/shared/OfflineBanner'

const navLinks = [
  { href: '/chat',      label: 'DriveLegal',  icon: MessageSquare },
  { href: '/challan',   label: '🧾 Challan',  icon: Calculator    },
  { href: '/map',       label: '🗺 Map',      icon: Map           },
  { href: '/dashboard', label: '📊 Dashboard',icon: Map           },
  { href: '/scan',      label: '📸 Scan',     icon: ScanLine      },
  { href: '/report',    label: 'RoadWatch',   icon: MapPin        },
  { href: '/authority', label: '🏛 Authority',icon: Building2     },
  { href: '/history',   label: 'History',     icon: History       },
  { href: '/settings',  label: 'Settings',    icon: Settings      },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <nav className={cn(
      'fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300',
      scrolled
        ? 'bg-brand-blue/96 backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.05)]'
        : 'bg-brand-blue/75 backdrop-blur-xl border-b border-white/[0.05]',
    )}>
      <div className="relative max-w-7xl mx-auto px-4 h-full flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute inset-0 bg-brand-orange rounded-lg opacity-20 group-hover:opacity-40 transition-opacity duration-200" />
            <Shield className="w-5 h-5 text-brand-orange relative z-10 group-hover:scale-110 transition-transform duration-200" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-xl tracking-wide hidden sm:inline">
            <span className="text-white">Road</span><span className="text-brand-orange">Safety</span>
            <span className="text-white/40 text-sm font-medium ml-1">AI</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-0.5">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 relative group',
                pathname === href
                  ? 'text-brand-orange'
                  : 'text-white/55 hover:text-white hover:bg-white/[0.05]',
              )}
            >
              {pathname === href && (
                <span className="absolute inset-0 rounded-xl bg-brand-orange/10 border border-brand-orange/20" />
              )}
              <Icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
              <span className="relative z-10">{label}</span>
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5">
          {/* Live badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-green/10 border border-brand-green/20">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
            <span className="text-brand-green text-xs font-semibold">LIVE</span>
          </div>

          {/* Sign In */}
          <Link href="/auth"
            className={cn(
              'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200',
              pathname === '/auth'
                ? 'bg-brand-orange text-white border border-brand-orange'
                : 'bg-brand-orange/10 border border-brand-orange/30 text-brand-orange hover:bg-brand-orange hover:text-white hover:border-brand-orange',
            )}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </Link>

          <ThemeToggle />

          {/* Connection quality dot — green/amber/red with pending-sync badge */}
          <ConnectionDot className="hidden sm:flex" />

          <Link href="/emergency"
            className={cn(
              'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200',
              pathname === '/emergency'
                ? 'bg-brand-red text-white border border-brand-red'
                : 'bg-brand-red/10 border border-brand-red/30 text-brand-red hover:bg-brand-red hover:text-white hover:border-brand-red animate-pulse-red',
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            Emergency
          </Link>

          <button onClick={() => setOpen(o => !o)}
            className="md:hidden p-2 rounded-xl hover:bg-white/[0.06] transition-all duration-150 text-white/70 hover:text-white active:scale-90"
          >
            <div className="relative w-5 h-5 flex items-center justify-center">
              <Menu className={cn('w-5 h-5 absolute transition-all duration-200', open ? 'opacity-0 rotate-90 scale-75' : 'opacity-100')} />
              <X    className={cn('w-5 h-5 absolute transition-all duration-200', open ? 'opacity-100'              : 'opacity-0 -rotate-90 scale-75')} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={cn(
        'md:hidden absolute top-16 inset-x-0 overflow-hidden transition-all duration-300 ease-in-out',
        open ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0',
      )}>
        <div className="bg-brand-blue-mid/98 backdrop-blur-2xl border-b border-white/[0.06] px-4 py-3 flex flex-col gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150',
                pathname === href
                  ? 'bg-brand-orange/12 text-brand-orange border border-brand-orange/20'
                  : 'text-white/65 hover:text-white hover:bg-white/[0.05]',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {pathname === href && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-orange" />}
            </Link>
          ))}
          <Link href="/emergency"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-red/10 border border-brand-red/25 text-brand-red font-bold mt-1 hover:bg-brand-red/20 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            Emergency Mode
            <span className="ml-auto text-xs opacity-60">112 / 108</span>
          </Link>
          <Link href="/auth"
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-orange/10 border border-brand-orange/25 text-brand-orange font-bold hover:bg-brand-orange/20 transition-all"
          >
            <LogIn className="w-4 h-4" />
            Sign In / Sign Up
          </Link>
        </div>
      </div>
    </nav>
  )
}
