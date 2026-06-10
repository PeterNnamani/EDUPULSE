/** Resolve Paystack public key from Vite env (trimmed). */
export function getPaystackPublicKey(): string | undefined {
  const raw = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;
  const key = raw?.trim();
  return key || undefined;
}

export type PaystackKeyMode = 'live' | 'test' | 'missing' | 'invalid';

export function getPaystackKeyMode(key = getPaystackPublicKey()): PaystackKeyMode {
  if (!key) return 'missing';
  if (key.startsWith('pk_live_')) return 'live';
  if (key.startsWith('pk_test_')) return 'test';
  return 'invalid';
}

export function paystackModeLabel(mode: PaystackKeyMode): string {
  switch (mode) {
    case 'live':
      return 'Live payments';
    case 'test':
      return 'Test mode (sandbox)';
    case 'invalid':
      return 'Invalid Paystack key';
    default:
      return 'Paystack not configured';
  }
}
