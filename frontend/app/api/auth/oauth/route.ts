import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/oauth?provider=<provider>&redirect=<path>
 *
 * Entry point for OAuth flows. Redirects to the correct provider
 * authorization URL. Called by lib/auth.ts initiateOAuth().
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const provider     = searchParams.get('provider') as string;
  const redirectPath = searchParams.get('redirect') ?? '/';
  const state = Buffer.from(
    JSON.stringify({ redirect: redirectPath, ts: Date.now() })
  ).toString('base64url');

  const siteBase   = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const callbackUrl = `${siteBase}/api/auth/callback?provider=${provider}`;

  switch (provider) {
    case 'google': {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id',     process.env.GOOGLE_CLIENT_ID ?? '');
      url.searchParams.set('redirect_uri',  callbackUrl);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope',         'openid email profile');
      url.searchParams.set('state',         state);
      url.searchParams.set('access_type',   'offline');
      return NextResponse.redirect(url.toString());
    }
    case 'linkedin': {
      const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id',     process.env.LINKEDIN_CLIENT_ID ?? '');
      url.searchParams.set('redirect_uri',  callbackUrl);
      url.searchParams.set('scope',         'openid profile email');
      url.searchParams.set('state',         state);
      return NextResponse.redirect(url.toString());
    }
    case 'github': {
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id',    process.env.GITHUB_CLIENT_ID ?? '');
      url.searchParams.set('redirect_uri', callbackUrl);
      url.searchParams.set('scope',        'read:user user:email');
      url.searchParams.set('state',        state);
      return NextResponse.redirect(url.toString());
    }
    case 'apple': {
      const url = new URL('https://appleid.apple.com/auth/authorize');
      url.searchParams.set('client_id',     process.env.APPLE_CLIENT_ID ?? '');
      url.searchParams.set('redirect_uri',  callbackUrl);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope',         'name email');
      url.searchParams.set('response_mode', 'form_post');
      url.searchParams.set('state',         state);
      return NextResponse.redirect(url.toString());
    }
    default:
      return NextResponse.json(
        { message: 'Unsupported OAuth provider.' },
        { status: 400 }
      );
  }
}
