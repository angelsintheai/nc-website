// Cloudflare Turnstile verification helper for Vercel serverless functions

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verify a Turnstile token server-side
 * @param token - The cf-turnstile-response token from the client
 * @param secretKey - The Turnstile secret key (from process.env)
 * @param remoteip - Optional IP address of the client
 * @returns Promise<boolean> - true if verification passed
 */
export async function verifyTurnstileToken(
  token: string,
  secretKey: string | undefined,
  remoteip?: string
): Promise<boolean> {
  if (!secretKey) {
    console.warn('Turnstile secret key not configured - skipping verification');
    return true; // Allow through if not configured (dev mode)
  }

  if (!token) {
    console.log('No Turnstile token provided');
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result: TurnstileVerifyResponse = await response.json();

    if (!result.success) {
      console.log('Turnstile verification failed:', result['error-codes']);
    }

    return result.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}
