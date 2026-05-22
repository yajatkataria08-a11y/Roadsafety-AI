import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth — email/password login + signup
 * GET  /api/auth/oauth — initiate OAuth redirect (see below)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (action === 'signup') {
      console.log(`Creating account for: ${name} (${email})`);
      return NextResponse.json(
        { message: 'Account created successfully!' },
        { status: 201 }
      );
    }

    if (action === 'login') {
      console.log(`Attempting login for: ${email}`);
      return NextResponse.json(
        { message: 'Login successful!' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: 'Invalid authentication action.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Auth Route Error:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth?action=oauth_init&provider=<provider>&redirect=<path>
 * Redirects the browser to the OAuth provider's authorization URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Legacy: handle oauth_init via query param
  const action = searchParams.get('action');

  if (action === 'oauth_init' || searchParams.has('provider')) {
    return handleOAuthInit(searchParams);
  }

  return NextResponse.json({ message: 'Not found' }, { status: 404 });
}

function handleOAuthInit(params: URLSearchParams): NextResponse {
  const provider = params.get('provider') as string;
  const redirectPath = params.get('redirect') ?? '/';
  const state = Buffer.from(JSON.stringify({ redirect: redirectPath, ts: Date.now() })).toString('base64url');
  const callbackBase = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const callbackUrl = `${callbackBase}/api/auth/callback?provider=${provider}`;

  switch (provider) {
    case 'google': {
      const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', callbackUrl);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      url.searchParams.set('access_type', 'offline');
      return NextResponse.redirect(url.toString());
    }

    case 'linkedin': {
      const clientId = process.env.LINKEDIN_CLIENT_ID ?? '';
      const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', callbackUrl);
      url.searchParams.set('scope', 'openid profile email');
      url.searchParams.set('state', state);
      return NextResponse.redirect(url.toString());
    }

    case 'github': {
      const clientId = process.env.GITHUB_CLIENT_ID ?? '';
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', callbackUrl);
      url.searchParams.set('scope', 'read:user user:email');
      url.searchParams.set('state', state);
      return NextResponse.redirect(url.toString());
    }

    case 'apple': {
      const clientId = process.env.APPLE_CLIENT_ID ?? '';
      const url = new URL('https://appleid.apple.com/auth/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', callbackUrl);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'name email');
      url.searchParams.set('response_mode', 'form_post');
      url.searchParams.set('state', state);
      return NextResponse.redirect(url.toString());
    }

    default:
      return NextResponse.json({ message: 'Unsupported OAuth provider.' }, { status: 400 });
  }
}
