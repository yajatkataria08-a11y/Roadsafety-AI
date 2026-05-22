import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/callback?provider=<provider>&code=<code>&state=<state>
 *
 * Receives the OAuth authorization code, exchanges it for a token,
 * fetches the user's profile, sets an httpOnly session cookie, and
 * redirects to the path stored in state.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') ?? '';
  const code     = searchParams.get('code') ?? '';
  const state    = searchParams.get('state') ?? '';

  if (!code || !provider) {
    return NextResponse.json({ message: 'Missing code or provider.' }, { status: 400 });
  }

  // Decode state to get redirect path
  let redirectPath = '/';
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
    redirectPath = decoded.redirect ?? '/';
  } catch {
    // malformed state — default redirect
  }

  const siteBase = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const callbackUrl = `${siteBase}/api/auth/callback?provider=${provider}`;

  try {
    const session = await exchangeCodeForSession(provider, code, callbackUrl);

    // Set httpOnly session cookie (no DB needed yet — payload is the session itself)
    const cookieStore = cookies();
    cookieStore.set('roadsos_session', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.redirect(`${siteBase}${redirectPath}`);
  } catch (err) {
    console.error('[OAuth callback] Error:', err);
    return NextResponse.redirect(`${siteBase}/auth?error=oauth_failed`);
  }
}

// ── Provider-specific token exchange + profile fetch ─────────────────────────

interface SessionPayload {
  userId:   string;
  email:    string;
  name:     string;
  provider: string;
}

async function exchangeCodeForSession(
  provider: string,
  code: string,
  callbackUrl: string
): Promise<SessionPayload> {
  switch (provider) {
    case 'google':    return googleExchange(code, callbackUrl);
    case 'linkedin':  return linkedinExchange(code, callbackUrl);
    case 'github':    return githubExchange(code, callbackUrl);
    case 'apple':     return appleExchange(code, callbackUrl);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// ── Google ────────────────────────────────────────────────────────────────────
async function googleExchange(code: string, redirectUri: string): Promise<SessionPayload> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Google token exchange failed');

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json();

  return {
    userId:   profile.sub,
    email:    profile.email ?? '',
    name:     profile.name ?? '',
    provider: 'google',
  };
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────
async function linkedinExchange(code: string, redirectUri: string): Promise<SessionPayload> {
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     process.env.LINKEDIN_CLIENT_ID ?? '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('LinkedIn token exchange failed');

  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json();

  return {
    userId:   profile.sub,
    email:    profile.email ?? '',
    name:     profile.name ?? '',
    provider: 'linkedin',
  };
}

// ── GitHub ────────────────────────────────────────────────────────────────────
async function githubExchange(code: string, redirectUri: string): Promise<SessionPayload> {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.GITHUB_CLIENT_ID ?? '',
      client_secret: process.env.GITHUB_CLIENT_SECRET ?? '',
      code,
      redirect_uri:  redirectUri,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('GitHub token exchange failed');

  const [profileRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'RoadSafetyAI' },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'RoadSafetyAI' },
    }),
  ]);
  const profile = await profileRes.json();
  const emails: Array<{ email: string; primary: boolean; verified: boolean }> = await emailsRes.json();
  const primaryEmail = emails.find(e => e.primary && e.verified)?.email ?? profile.email ?? '';

  return {
    userId:   String(profile.id),
    email:    primaryEmail,
    name:     profile.name ?? profile.login ?? '',
    provider: 'github',
  };
}

// ── Apple ─────────────────────────────────────────────────────────────────────
async function appleExchange(code: string, redirectUri: string): Promise<SessionPayload> {
  // Apple uses signed JWTs for client_secret — generate it from the private key
  const clientSecret = await generateAppleClientSecret();

  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.APPLE_CLIENT_ID ?? '',
      client_secret: clientSecret,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  redirectUri,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.id_token) throw new Error('Apple token exchange failed');

  // Decode the id_token (JWT) — payload is base64url encoded middle segment
  const payload = JSON.parse(
    Buffer.from(tokenData.id_token.split('.')[1], 'base64url').toString('utf-8')
  );

  return {
    userId:   payload.sub,
    email:    payload.email ?? '',
    name:     '', // Apple only sends name on first auth via form_post body param
    provider: 'apple',
  };
}

/** Generate a signed JWT client_secret for Apple OAuth */
async function generateAppleClientSecret(): Promise<string> {
  const teamId    = process.env.APPLE_TEAM_ID ?? '';
  const keyId     = process.env.APPLE_KEY_ID ?? '';
  const clientId  = process.env.APPLE_CLIENT_ID ?? '';
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '';

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claimsPayload = Buffer.from(JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + 86400, // 24h
    aud: 'https://appleid.apple.com',
    sub: clientId,
  })).toString('base64url');

  const signingInput = `${header}.${claimsPayload}`;

  // Use Web Crypto (available in Node 18+ / Edge runtime)
  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    Buffer.from(keyData, 'base64'),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    Buffer.from(signingInput)
  );

  const sigBase64 = Buffer.from(signature).toString('base64url');
  return `${signingInput}.${sigBase64}`;
}
