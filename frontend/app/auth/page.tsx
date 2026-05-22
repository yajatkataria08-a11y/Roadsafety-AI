'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, Shield, ArrowRight, CheckCircle2, Phone, MessageSquare, RefreshCw } from 'lucide-react'
import { useNetworkStatus } from '@/components/PWAProvider'
import { initiateOAuth, type OAuthProvider } from '@/lib/auth'

type Mode = 'login' | 'signup'

// ── Validation helpers ────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormErrors {
  name?: string
  email?: string
  phone?: string
  otp?: string
  password?: string
  confirm?: string
}

function validateForm(
  mode: Mode,
  form: { name: string; email: string; password: string; confirm: string }
): FormErrors {
  const errors: FormErrors = {}
  if (mode === 'signup' && !form.name.trim()) {
    errors.name = 'Full name is required'
  }
  if (!EMAIL_RE.test(form.email)) {
    errors.email = 'Enter a valid email address'
  }
  if (mode === 'signup' && form.phone && !/^\+?[1-9]\d{9,14}$/.test(form.phone.replace(/\s/g,''))) {
    errors.phone = 'Enter a valid phone number with country code'
  }
  if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }
  if (mode === 'signup' && form.confirm !== form.password) {
    errors.confirm = 'Passwords do not match'
  }
  return errors
}

// ── Input ─────────────────────────────────────────────────────────────────────
function Input({
  icon, type, placeholder, value, onChange,
  showToggle, visible, onToggle, error,
}: {
  icon: React.ReactNode; type: string; placeholder: string; value: string
  onChange: (v: string) => void; showToggle?: boolean; visible?: boolean
  onToggle?: () => void; error?: string
}) {
  const [focused, setFocused] = useState(false)
  const hasError = Boolean(error)
  return (
    <div style={{ marginBottom: hasError ? 4 : 11 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${hasError ? '#ff4d4d' : focused ? '#FF6200' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 11, padding: '11px 14px', transition: 'all 0.25s',
        boxShadow: focused
          ? hasError ? '0 0 0 3px rgba(255,77,77,0.12)' : '0 0 0 3px rgba(255,98,0,0.12)'
          : 'none',
      }}>
        <span style={{
          color: hasError ? '#ff6b6b' : focused ? '#FF6200' : 'rgba(255,255,255,0.3)',
          display: 'flex', flexShrink: 0, transition: 'color 0.25s',
        }}>
          {icon}
        </span>
        <input
          type={showToggle ? (visible ? 'text' : 'password') : type}
          placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#fff', fontSize: 14, fontFamily: 'Outfit,system-ui,sans-serif', minWidth: 0,
          }}
        />
        {showToggle && (
          <button type="button" onClick={onToggle}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', padding: 0, flexShrink: 0 }}>
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {hasError && (
        <p style={{ color: '#ff6b6b', fontSize: 11, marginTop: 4, marginBottom: 7, paddingLeft: 2 }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ── Submit Button ─────────────────────────────────────────────────────────────
function Btn({ loading, success, label, onClick }: {
  loading: boolean; success: boolean; label: string; onClick: () => void
}) {
  return (
    <motion.button onClick={onClick}
      whileHover={{ scale: loading || success ? 1 : 1.02 }}
      whileTap={{ scale: 0.97 }}
      disabled={loading || success}
      style={{
        position: 'relative', width: '100%', padding: '13px', borderRadius: 11,
        border: 'none', cursor: loading || success ? 'not-allowed' : 'pointer',
        fontWeight: 700, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
        overflow: 'hidden', marginTop: 6, fontFamily: 'Rajdhani,sans-serif',
        background: success ? 'linear-gradient(135deg,#00E676,#69F0AE)' : 'linear-gradient(135deg,#FF6200,#FF8C42)',
        boxShadow: success ? '0 0 24px rgba(0,230,118,0.4)' : '0 0 28px rgba(255,98,0,0.4)',
        opacity: loading ? 0.85 : 1,
      }}>
      {!loading && !success && (
        <motion.div
          style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)', transform: 'skewX(-12deg)' }}
          animate={{ x: ['-120%', '220%'] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
        />
      )}
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff' }}>
        {loading
          ? <motion.div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
          : success
            ? <><CheckCircle2 size={16} />{label === 'Sign In' ? ' Welcome Back!' : ' Account Created!'}</>
            : <>{label} <ArrowRight size={15} /></>
        }
      </span>
    </motion.button>
  )
}

// ── Social OAuth Buttons ──────────────────────────────────────────────────────
const SOCIAL_PROVIDERS: {
  id: OAuthProvider
  label: string
  icon: React.ReactNode
}[] = [
  {
    id: 'google',
    label: 'Google',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="3" fill="#0A66C2"/>
        <path d="M7.75 9.5H5.25v9h2.5v-9zm-1.25-1a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM19 18.5h-2.5v-4.4c0-1.05-.02-2.4-1.46-2.4-1.47 0-1.7 1.14-1.7 2.32v4.48H10.84v-9h2.4v1.23h.03c.33-.63 1.15-1.3 2.37-1.3 2.53 0 3 1.67 3 3.83v5.24z" fill="#fff"/>
      </svg>
    ),
  },
  {
    id: 'github',
    label: 'GitHub',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" fill="#fff"/>
      </svg>
    ),
  },
  {
    id: 'apple',
    label: 'Apple',
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.3.07 2.2.72 2.96.75.9-.17 1.76-.84 3.14-.9 1.4-.05 2.52.52 3.33 1.5-3.07 1.77-2.55 5.66.11 6.97-.58 1.5-1.31 2.98-2.54 4.56zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="#fff"/>
      </svg>
    ),
  },
]

function Socials({ disabled }: { disabled: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
      {SOCIAL_PROVIDERS.map(({ id, label, icon }) => (
        <div key={id} style={{ position: 'relative' }}>
          <button
            disabled={disabled}
            onClick={() => !disabled && initiateOAuth(id)}
            title={disabled ? 'Unavailable offline' : `Sign in with ${label}`}
            aria-label={disabled ? `${label} — unavailable offline` : `Sign in with ${label}`}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: disabled ? 0.4 : 1,
            }}
            onMouseEnter={e => {
              if (disabled) return
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'rgba(255,255,255,0.1)'
              el.style.borderColor = 'rgba(255,98,0,0.5)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'rgba(255,255,255,0.05)'
              el.style.borderColor = 'rgba(255,255,255,0.12)'
            }}
          >
            {icon}
          </button>
          {disabled && (
            <span style={{
              position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: 10, whiteSpace: 'nowrap',
              padding: '3px 7px', borderRadius: 5, pointerEvents: 'none',
              opacity: 0, transition: 'opacity 0.2s',
            }}
              className="offline-tooltip"
            >
              Unavailable offline
            </span>
          )}
        </div>
      ))}
      <style>{`
        div:hover .offline-tooltip { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

// ── Admin Login Modal ────────────────────────────────────────────────────────
function AdminLoginModal({ onClose }: { onClose: () => void }) {
  const [adminForm, setAdminForm] = useState({ email: '', password: '' })
  const [adminErrors, setAdminErrors] = useState<{ email?: string; password?: string }>({})
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminSuccess, setAdminSuccess] = useState(false)
  const [adminShowPw, setAdminShowPw] = useState(false)
  const [adminMsg, setAdminMsg] = useState('')
  const [showHint, setShowHint] = useState(false)

  const DEMO_EMAIL = 'admin@roadsafety.ai'
  const DEMO_PASSWORD = 'Admin@1234'

  const setA = (k: 'email' | 'password') => (v: string) => {
    setAdminForm(f => ({ ...f, [k]: v }))
    if (adminErrors[k]) setAdminErrors(e => ({ ...e, [k]: undefined }))
    setAdminMsg('')
  }

  const submitAdmin = async () => {
    const errs: { email?: string; password?: string } = {}
    if (!EMAIL_RE.test(adminForm.email)) errs.email = 'Enter a valid email address'
    if (adminForm.password.length < 6) errs.password = 'At least 6 characters'
    if (Object.keys(errs).length) { setAdminErrors(errs); return }
    setAdminErrors({})
    setAdminLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    if (adminForm.email === DEMO_EMAIL && adminForm.password === DEMO_PASSWORD) {
      setAdminLoading(false)
      setAdminSuccess(true)
      setAdminMsg('✓ Access granted — redirecting...')
      await new Promise(r => setTimeout(r, 1200))
      window.location.href = '/admin'
    } else {
      setAdminLoading(false)
      setAdminMsg('✗ Invalid admin credentials')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="admin-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(6,14,31,0.82)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
      >
        <motion.div
          key="admin-modal"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 360,
            background: 'linear-gradient(160deg,#0D1F3C 0%,#0A1628 100%)',
            border: '1px solid rgba(255,98,0,0.28)',
            borderRadius: 20,
            padding: '28px 28px 24px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 32px rgba(255,98,0,0.08), 0 0 0 1px rgba(255,98,0,0.1)',
            fontFamily: 'Outfit,system-ui,sans-serif',
            position: 'relative',
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'rgba(255,255,255,0.06)', border: 'none',
              borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)', fontSize: 16, lineHeight: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg,#FF6200,#FF8C42)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(255,98,0,0.4)', flexShrink: 0,
            }}>
              <Shield size={14} color="#fff" />
            </div>
            <span style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>
              Admin <span style={{ color: '#FF6200' }}>Portal</span>
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, marginBottom: 20, paddingLeft: 2 }}>
            Restricted access · Authorised personnel only
          </p>

          <Input icon={<Mail size={14} />} type="email" placeholder="Admin Email"
            value={adminForm.email} onChange={setA('email')} error={adminErrors.email} />
          <Input icon={<Lock size={14} />} type="password" placeholder="Admin Password"
            value={adminForm.password} onChange={setA('password')}
            showToggle visible={adminShowPw} onToggle={() => setAdminShowPw(v => !v)}
            error={adminErrors.password} />

          {adminMsg && (
            <p style={{ fontSize: 11, marginBottom: 8, color: adminSuccess ? '#00E676' : '#ff6b6b' }}>
              {adminMsg}
            </p>
          )}

          <Btn loading={adminLoading} success={adminSuccess} label="Sign In as Admin" onClick={submitAdmin} />

          {/* Demo hint — toggled */}
          <button
            onClick={() => setShowHint(v => !v)}
            style={{
              display: 'block', margin: '14px auto 0', background: 'none', border: 'none',
              color: 'rgba(255,140,66,0.55)', fontSize: 10, cursor: 'pointer',
              letterSpacing: 0.5, textDecoration: 'underline dotted',
              fontFamily: 'Outfit,system-ui,sans-serif', transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FF8C42')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,140,66,0.55)')}
          >
            {showHint ? 'Hide demo credentials' : 'Show demo credentials'}
          </button>

          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{
                  marginTop: 10, background: 'linear-gradient(135deg,rgba(255,98,0,0.08),rgba(255,140,66,0.04))',
                  border: '1px dashed rgba(255,140,66,0.3)',
                  borderRadius: 8, padding: '9px 12px',
                  fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.8,
                }}>
                  <span style={{ color: 'rgba(255,98,0,0.65)', fontWeight: 600 }}>Demo</span>
                  <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 10, marginLeft: 6 }}>— click to autofill</span>
                  <br />
                  <code
                    onClick={() => setAdminForm(f => ({ ...f, email: DEMO_EMAIL }))}
                    style={{
                      color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
                      borderBottom: '1px dashed rgba(255,98,0,0.35)',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#FF6200')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                    title="Click to autofill email"
                  >{DEMO_EMAIL}</code><br />
                  <code
                    onClick={() => setAdminForm(f => ({ ...f, password: DEMO_PASSWORD }))}
                    style={{
                      color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
                      borderBottom: '1px dashed rgba(255,98,0,0.35)',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#FF6200')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                    title="Click to autofill password"
                  >{DEMO_PASSWORD}</code>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10, textAlign: 'center', marginTop: 14 }}>
            All access attempts are logged and monitored
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showCpw, setShowCpw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [otpStep, setOtpStep] = useState(false)       // true = OTP entry screen
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpSuccess, setOtpSuccess] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [pendingData, setPendingData] = useState<Record<string,string>>({})  // store form data while OTP pending
  const [errors, setErrors] = useState<FormErrors>({})

  const networkStatus = useNetworkStatus()
  const isOffline = networkStatus === 'offline'

  const set = (k: keyof typeof form) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    // Clear the error for that field as the user types
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }))
  }
  const isSignup = mode === 'signup'

  // ── Start resend countdown ──────────────────────────────────────────────────
  const startResendTimer = () => {
    setResendTimer(30)
    const iv = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(iv); return 0 } return t - 1 })
    }, 1000)
  }

  // ── FastAPI backend base URL ─────────────────────────────────────────────
  const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

  // ── Send OTP via MSG91 (SMS + Email) ────────────────────────────────────
  const sendOtp = async (payload: Record<string,string>) => {
    setOtpLoading(true)
    setOtpError('')
    try {
      // POST /api/auth/send-otp  →  calls MSG91 SendOTP API
      const res = await fetch(`${API}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email,
          phone: payload.phone,   // MSG91 SMS
          action: payload.action, // 'login' | 'signup'
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPendingData(payload)
        setOtpStep(true)
        startResendTimer()
      } else {
        setErrors(e => ({ ...e, email: data.message || 'Failed to send OTP' }))
      }
    } catch {
      setErrors(e => ({ ...e, email: 'Network error — could not send OTP' }))
    } finally {
      setOtpLoading(false)
    }
  }

  // ── Verify OTP + complete auth ───────────────────────────────────────────
  const verifyOtp = async () => {
    if (otp.length < 6) { setOtpError('Enter the 6-digit OTP'); return }
    setOtpError('')
    setOtpLoading(true)
    try {
      // POST /api/auth/verify-otp  →  MSG91 verify + complete login/signup
      const res = await fetch(`${API}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp, ...pendingData }),
      })
      const data = await res.json()
      if (res.ok) {
        setOtpLoading(false)
        setOtpSuccess(true)
        await new Promise(r => setTimeout(r, 1200))
        if (pendingData.action === 'signup') {
          setOtpStep(false); setOtp(''); setOtpSuccess(false)
          switchMode('login')
        } else {
          window.location.href = data?.role === 'admin' ? '/admin' : '/'
        }
      } else {
        setOtpLoading(false)
        setOtpError(data.message || 'Invalid OTP — try again')
      }
    } catch {
      setOtpLoading(false)
      setOtpError('Network error — try again')
    }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const resendOtp = async () => {
    if (resendTimer > 0) return
    setOtp('')
    setOtpError('')
    await sendOtp(pendingData)
  }

  // ── Main submit → validates then triggers send OTP ────────────────────────
  const submit = async () => {
    const validationErrors = validateForm(mode, form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setLoading(true)
    await sendOtp({ action: mode, ...form })
    setLoading(false)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setSuccess(false)
    setErrors({})
    setForm({ name: '', email: '', password: '', confirm: '' })
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#060E1F',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', position: 'relative', overflow: 'hidden',
      fontFamily: 'Outfit,system-ui,sans-serif',
    }}>
      {/* Glows */}
      <div style={{ position: 'absolute', top: '-10%', left: '20%', width: 500, height: 500, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle,rgba(255,98,0,0.09) 0%,transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '15%', width: 400, height: 400, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle,rgba(30,144,255,0.07) 0%,transparent 70%)' }} />

      {/* Road strip */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(to top,#060E1F,transparent)' }} />
        <motion.div style={{ display: 'flex', gap: 40, position: 'absolute', bottom: 18, width: '200%' }}
          animate={{ x: ['0%', '-50%'] }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} style={{ width: 60, height: 6, background: 'rgba(255,98,0,0.35)', borderRadius: 4, flexShrink: 0 }} />
          ))}
        </motion.div>
      </div>

      <div style={{
        position: 'relative', width: '100%', maxWidth: 920,
        height: isSignup ? 630 : 530,
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
        transition: 'height 0.65s cubic-bezier(0.4,0,0.2,1)',
        background: '#0D1F3C',
      }}>

        {/* LOGIN form — left 60% */}
        <motion.div animate={{ opacity: isSignup ? 0 : 1 }} transition={{ duration: 0.3 }}
          style={{ position: 'absolute', top: 0, left: 0, width: '60%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 44px', pointerEvents: isSignup ? 'none' : 'auto', boxSizing: 'border-box' }}>
          <AnimatePresence mode="wait">
            {!isSignup && (
              <motion.div key="lf" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.3 }}>
                <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 4, fontFamily: 'Rajdhani,sans-serif' }}>Login Account</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>Sign in with your social account</p>
                <Socials disabled={isOffline} />
                {isOffline && (
                  <p style={{ color: 'rgba(255,180,50,0.8)', fontSize: 11, marginBottom: 10, textAlign: 'center' }}>
                    📡 Social login requires internet — use email below
                  </p>
                )}
                <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, textAlign: 'center', marginBottom: 14, letterSpacing: 1.2, textTransform: 'uppercase' }}>or use your email or password</p>
                {!otpStep ? (
                  <>
                    <Input icon={<Mail size={15} />} type="email" placeholder="Email" value={form.email} onChange={set('email')} error={errors.email} />
                    <Input icon={<Lock size={15} />} type="password" placeholder="Password" value={form.password} onChange={set('password')} showToggle visible={showPw} onToggle={() => setShowPw(v => !v)} error={errors.password} />
                    <div style={{ textAlign: 'right', marginBottom: 12 }}>
                      <button style={{ background: 'none', border: 'none', color: 'rgba(255,98,0,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>Forgot your password?</button>
                    </div>
                    <Btn loading={loading} success={success} label="Sign In" onClick={submit} />
                  </>
                ) : (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,98,0,0.08)', border: '1px solid rgba(255,98,0,0.2)', borderRadius: 20, padding: '6px 14px', marginBottom: 10 }}>
                        <MessageSquare size={13} color="#FF6200" />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>OTP sent to <b style={{ color: '#FF8C42' }}>{pendingData.email}</b> & SMS</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>Enter the 6-digit code to verify</p>
                    </div>
                    <OtpInput value={otp} onChange={v => { setOtp(v); setOtpError('') }} error={otpError} />
                    <Btn loading={otpLoading} success={otpSuccess} label="Verify & Sign In" onClick={verifyOtp} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                      <button onClick={resendOtp} disabled={resendTimer > 0}
                        style={{ background: 'none', border: 'none', cursor: resendTimer > 0 ? 'not-allowed' : 'pointer', color: resendTimer > 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,140,66,0.7)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <RefreshCw size={11} /> {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                      </button>
                      <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>·</span>
                      <button onClick={() => { setOtpStep(false); setOtp(''); setOtpError('') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>← Back</button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* SIGNUP form — right 60% */}
        <motion.div animate={{ opacity: isSignup ? 1 : 0 }} transition={{ duration: 0.3 }}
          style={{ position: 'absolute', top: 0, right: 0, width: '60%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 44px', pointerEvents: isSignup ? 'auto' : 'none', boxSizing: 'border-box' }}>
          <AnimatePresence mode="wait">
            {isSignup && (
              <motion.div key="sf" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.3 }}>
                <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 4, fontFamily: 'Rajdhani,sans-serif' }}>Create Account</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 14 }}>Register with your social account</p>
                <Socials disabled={isOffline} />
                {isOffline && (
                  <p style={{ color: 'rgba(255,180,50,0.8)', fontSize: 11, marginBottom: 8, textAlign: 'center' }}>
                    📡 Social login requires internet — use email below
                  </p>
                )}
                <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, textAlign: 'center', marginBottom: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>or use your email to register</p>
                {!otpStep ? (
                  <>
                    <Input icon={<User size={15} />} type="text" placeholder="Full Name" value={form.name} onChange={set('name')} error={errors.name} />
                    <Input icon={<Mail size={15} />} type="email" placeholder="Email" value={form.email} onChange={set('email')} error={errors.email} />
                    <Input icon={<Phone size={15} />} type="tel" placeholder="Phone (+91...)" value={form.phone} onChange={set('phone')} error={errors.phone} />
                    <Input icon={<Lock size={15} />} type="password" placeholder="Password" value={form.password} onChange={set('password')} showToggle visible={showPw} onToggle={() => setShowPw(v => !v)} error={errors.password} />
                    <Input icon={<Lock size={15} />} type="password" placeholder="Confirm Password" value={form.confirm} onChange={set('confirm')} showToggle visible={showCpw} onToggle={() => setShowCpw(v => !v)} error={errors.confirm} />
                    <Btn loading={loading} success={success} label="Sign Up & Send OTP" onClick={submit} />
                  </>
                ) : (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,98,0,0.08)', border: '1px solid rgba(255,98,0,0.2)', borderRadius: 20, padding: '6px 14px', marginBottom: 10 }}>
                        <MessageSquare size={13} color="#FF6200" />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>OTP sent to <b style={{ color: '#FF8C42' }}>{pendingData.email}</b> & SMS</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>Enter the 6-digit code below</p>
                    </div>
                    <OtpInput value={otp} onChange={v => { setOtp(v); setOtpError('') }} error={otpError} />
                    <Btn loading={otpLoading} success={otpSuccess} label="Verify & Create Account" onClick={verifyOtp} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                      <button onClick={resendOtp} disabled={resendTimer > 0}
                        style={{ background: 'none', border: 'none', cursor: resendTimer > 0 ? 'not-allowed' : 'pointer', color: resendTimer > 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,140,66,0.7)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <RefreshCw size={11} /> {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                      </button>
                      <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>·</span>
                      <button onClick={() => { setOtpStep(false); setOtp(''); setOtpError('') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>← Back</button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* SLIDING PANEL */}
        <motion.div
          animate={{ left: isSignup ? '0%' : '60%' }}
          transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'absolute', top: 0, width: '40%', height: '100%',
            borderRadius: 20, zIndex: 20, overflow: 'hidden',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '0 36px', boxSizing: 'border-box',
            background: 'linear-gradient(145deg,#1E3A5C 0%,#0A1628 50%,#0F1F3C 100%)',
            boxShadow: isSignup ? '8px 0 50px rgba(0,0,0,0.65)' : '-8px 0 50px rgba(0,0,0,0.65)',
          }}>

          <div style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', opacity: 0.25, pointerEvents: 'none', background: 'radial-gradient(circle,#FF6200 0%,transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -40, width: 140, height: 140, borderRadius: '50%', opacity: 0.1, pointerEvents: 'none', background: 'radial-gradient(circle,#1E90FF 0%,transparent 70%)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 30 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FF6200', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(255,98,0,0.55)', flexShrink: 0 }}>
              <Shield size={18} color="#fff" />
            </div>
            <span style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
              Road<span style={{ color: '#FF6200' }}>Safety</span> AI
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ color: '#fff', fontSize: 32, fontWeight: 700, fontFamily: 'Rajdhani,sans-serif', lineHeight: 1.2, marginBottom: 12, whiteSpace: 'pre-line' }}>
                {isSignup ? 'Welcome\nBack!' : 'Hello,\nFriend!'}
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13, lineHeight: 1.7, marginBottom: 28, whiteSpace: 'pre-line' }}>
                {isSignup
                  ? 'Enter your personal\ndetails to access\nthe site features'
                  : 'Register with your\npersonal details to\naccess the site features'}
              </p>
              <motion.button
                onClick={() => switchMode(isSignup ? 'login' : 'signup')}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                style={{ padding: '10px 32px', borderRadius: 999, border: '1.5px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Rajdhani,sans-serif', transition: 'all 0.25s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,98,0,0.6)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.35)' }}>
                {isSignup ? 'SIGN IN' : 'SIGN UP'}
              </motion.button>
            </motion.div>
          </AnimatePresence>

          <div style={{ position: 'absolute', bottom: 20, display: 'flex', gap: 6 }}>
            <div style={{ width: 20, height: 6, background: '#FF6200', borderRadius: 3 }} />
            <div style={{ width: 6, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />
            <div style={{ width: 6, height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }} />
          </div>
        </motion.div>
      </div>

      {/* ── Admin Shield Icon — Top Right ── */}
      <motion.button
        onClick={() => setShowAdminModal(true)}
        title="Admin Portal"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'fixed', top: 18, right: 20, zIndex: 900,
          background: 'linear-gradient(135deg,rgba(255,98,0,0.18),rgba(255,140,66,0.12))',
          border: '1px solid rgba(255,98,0,0.35)',
          borderRadius: 10, padding: '7px 14px',
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer', backdropFilter: 'blur(10px)',
          color: 'rgba(255,255,255,0.6)', fontSize: 11,
          fontFamily: 'Outfit,system-ui,sans-serif',
          transition: 'all 0.2s',
          boxShadow: '0 2px 12px rgba(255,98,0,0.12)',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'linear-gradient(135deg,#FF6200,#FF8C42)'
          el.style.color = '#fff'
          el.style.borderColor = '#FF6200'
          el.style.boxShadow = '0 0 20px rgba(255,98,0,0.45)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'linear-gradient(135deg,rgba(255,98,0,0.18),rgba(255,140,66,0.12))'
          el.style.color = 'rgba(255,255,255,0.6)'
          el.style.borderColor = 'rgba(255,98,0,0.35)'
          el.style.boxShadow = '0 2px 12px rgba(255,98,0,0.12)'
        }}
      >
        <Shield size={13} style={{ color: 'rgba(255,98,0,0.7)' }} />
        <span>Admin</span>
      </motion.button>

      {/* ── Admin Login Modal ── */}
      {showAdminModal && <AdminLoginModal onClose={() => setShowAdminModal(false)} />}

    </div>
  )
}