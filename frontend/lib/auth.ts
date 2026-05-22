/**
 * lib/auth.ts — OAuth initiation helper
 * ════════════════════════════════════════════════════════
 * Client-side only. Redirects to the API route that kicks
 * off the OAuth flow for the given provider.
 */

export type OAuthProvider = 'google' | 'linkedin' | 'github' | 'apple';

/**
 * Redirect the browser to /api/auth/oauth?provider=<provider>&redirect=/
 * The API route validates the provider and sends the user to the correct
 * OAuth authorization URL.
 */
export function initiateOAuth(provider: OAuthProvider): void {
  const params = new URLSearchParams({
    provider,
    redirect: '/',
  });
  window.location.href = `/api/auth/oauth?${params.toString()}`;
}
