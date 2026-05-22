// app/api/auth/send-otp/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// MSG91 SendOTP — SMS (phone) + Email OTP
// Place this file at:  app/api/auth/send-otp/route.ts
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'

const MSG91_AUTH_KEY  = process.env.MSG91_AUTH_KEY!       // MSG91 dashboard → API keys
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID!  // MSG91 dashboard → OTP template ID
const MSG91_SENDER_ID   = process.env.MSG91_SENDER_ID || 'RDSAFE'

// ── Send SMS OTP via MSG91 ────────────────────────────────────────────────────
async function sendSmsOtp(phone: string): Promise<{ success: boolean; message: string }> {
  // MSG91 expects phone with country code, no + sign
  // e.g. +919876543210 → 919876543210
  const cleanPhone = phone.replace(/^\+/, '')

  const url = `https://control.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=${cleanPhone}&authkey=${MSG91_AUTH_KEY}&sender=${MSG91_SENDER_ID}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  const data = await res.json()

  // MSG91 returns { type: 'success', message: '...' } on success
  if (data.type === 'success') {
    return { success: true, message: 'OTP sent via SMS' }
  }

  return { success: false, message: data.message || 'Failed to send SMS OTP' }
}

// ── Send Email OTP via MSG91 ──────────────────────────────────────────────────
async function sendEmailOtp(email: string): Promise<{ success: boolean; message: string }> {
  const url = `https://control.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=${encodeURIComponent(email)}&authkey=${MSG91_AUTH_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  const data = await res.json()

  if (data.type === 'success') {
    return { success: true, message: 'OTP sent via Email' }
  }

  return { success: false, message: data.message || 'Failed to send Email OTP' }
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, phone, action } = body

    // Basic validation
    if (!email && !phone) {
      return NextResponse.json(
        { message: 'Email ya phone number dono mein se ek zaroori hai' },
        { status: 400 }
      )
    }

    const results: string[] = []
    const errors: string[] = []

    // Send SMS OTP (if phone provided)
    if (phone) {
      const smsResult = await sendSmsOtp(phone)
      if (smsResult.success) {
        results.push('SMS')
      } else {
        errors.push(`SMS: ${smsResult.message}`)
      }
    }

    // Send Email OTP (if email provided)
    if (email) {
      const emailResult = await sendEmailOtp(email)
      if (emailResult.success) {
        results.push('Email')
      } else {
        errors.push(`Email: ${emailResult.message}`)
      }
    }

    // If at least one channel succeeded → return success
    if (results.length > 0) {
      return NextResponse.json({
        success: true,
        message: `OTP sent via ${results.join(' & ')}`,
        channels: results,
        action,
      })
    }

    // All channels failed
    return NextResponse.json(
      { message: errors.join(', ') || 'OTP send karne mein problem aayi' },
      { status: 500 }
    )

  } catch (err) {
    console.error('[send-otp] Error:', err)
    return NextResponse.json(
      { message: 'Server error — please try again' },
      { status: 500 }
    )
  }
}