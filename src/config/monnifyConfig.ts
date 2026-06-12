import { SUPABASE_URL } from '@/lib/supabase';

export const MONNIFY_WEBHOOK_FUNCTION = 'monnify-webhook';

export const MONNIFY_LIVE_BASE_URL = 'https://api.monnify.com';
export const MONNIFY_SANDBOX_BASE_URL = 'https://sandbox.monnify.com';

/** Pick sandbox vs live base URL from the API key when possible. */
export function resolveMonnifyBaseUrl(apiKey: string, configured?: string | null): string {
  const trimmed = configured?.trim().replace(/\/$/, '') ?? '';
  const key = apiKey.trim().toUpperCase();
  const isSandboxKey = key.includes('TEST') || key.includes('SANDBOX') || key.startsWith('MK_TEST');

  if (!trimmed) {
    return isSandboxKey ? MONNIFY_SANDBOX_BASE_URL : MONNIFY_LIVE_BASE_URL;
  }
  if (isSandboxKey && trimmed.includes('api.monnify.com')) {
    return MONNIFY_SANDBOX_BASE_URL;
  }
  if (!isSandboxKey && trimmed.includes('sandbox.monnify.com')) {
    return MONNIFY_LIVE_BASE_URL;
  }
  return trimmed;
}

/** Public webhook URL to register in the Monnify dashboard. */
export function getMonnifyWebhookUrl(): string {
  const base = SUPABASE_URL.replace(/\/$/, '');
  return `${base}/functions/v1/${MONNIFY_WEBHOOK_FUNCTION}`;
}
