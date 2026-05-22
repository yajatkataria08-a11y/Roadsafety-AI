// app/api/auth/verify-otp/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// MSG91 VerifyOTP — verify the OTP entered by user
// Place this file at:  app/api/auth/verify-otp/route.ts
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY!

// ── Verify OTP via MSG91 ──────────────────────────────────────────────────────
async function verifyMsg91Otp(
  identifier: string,  // phone or email
  otp: string
): Promise<{ success: boolean; message: string }> {
  // Clean phone number if it's a phone (remove +)
  const cleanIdentifier = identifier.startsWith('+')
    ? identifier.replace(/^\+/, '')
    : identifier

  const url = `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${encodeURIComponent(cleanIdentifier)}&authkey=${MSG91_AUTH_KEY}`

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  const data = await res.json()

  // MSG91 returns { type: 'success', message: 'OTP verified successfully' }
  if (data.type === 'success') {
    return { success: true, message: 'OTP verified' }
  }

  return { success: false, message: data.message || 'Invalid OTP' }
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { otp, email, phone, action, name, password } = body

    // Basic validation
    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { message: '6-digit OTP daalna zaroori hai' },
        { status: 400 }
      )
    }

    if (!email && !phone) {
      return NextResponse.json(
        { message: 'Email ya phone zaroori hai verification ke liye' },
        { status: 400 }
      )
    }

    // Verify via phone first, then email as fallback
    const identifier = phone || email
    const result = await verifyMsg91Otp(identifier, otp)

    if (!result.success) {
      return NextResponse.json(
        { message: result.message || 'Invalid OTP — dobara try karo' },
        { status: 400 }
      )
    }

    // ── OTP verified ✓ — now complete login or signup ─────────────────────────

    if (action === 'signup') {
      // TODO: Create user in your DB here
      // Example:
      // await db.user.create({ data: { name, email, phone, password: hashedPassword } })

      return NextResponse.json({
        success: true,
        message: 'Account successfully created!',
        action: 'signup',
      })
    }

    if (action === 'login') {
      // TODO: Fetch user from your DB and return role
      // Example:
      // const user = await db.user.findUnique({ where: { email } })
      // const role = user?.role ?? 'user'

      // Demo: check if admin email
      const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'user'

      // TODO: Generate JWT session token here
      // const token = jwt.sign({ email, role }, process.env.JWT_SECRET!, { expiresIn: '7d' })

      return NextResponse.json({
        success: true,
        message: 'Login successful!',
        role,
        action: 'login',
        // token,  // uncomment when JWT is set up
      })
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error('[verify-otp] Error:', err)
    return NextResponse.json(
      { message: 'Server error — please try again' },
      { status: 500 }
    )
  }
}