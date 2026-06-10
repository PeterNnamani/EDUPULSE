export interface PaystackTransactionOptions {
  key: string;
  email: string;
  amount: number;
  currency?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  onSuccess: (transaction: { reference: string }) => void;
  onCancel: () => void;
}

type PaystackPopV2 = {
  newTransaction: (options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    PaystackPop?: PaystackPopV2 | { setup: (options: Record<string, unknown>) => { openIframe: () => void } };
  }
}

let scriptPromise: Promise<void> | null = null;

function isPaystackV2(): boolean {
  return typeof window.PaystackPop === 'function';
}

/** Load Paystack Inline v2 (modal overlay). Falls back to v1 script if needed. */
export function loadPaystackInline(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.PaystackPop) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v2/inline.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load Paystack checkout.'));
      };
      document.body.appendChild(script);
    });
  }

  return scriptPromise;
}

export function openPaystackCheckout(options: PaystackTransactionOptions): void {
  document.body.classList.add('paystack-checkout-open');

  const cleanup = () => {
    document.body.classList.remove('paystack-checkout-open');
  };

  const wrapSuccess = (tx: { reference: string }) => {
    cleanup();
    options.onSuccess(tx);
  };

  const wrapCancel = () => {
    cleanup();
    options.onCancel();
  };

  if (isPaystackV2()) {
    const PaystackCtor = window.PaystackPop as unknown as new () => PaystackPopV2;
    const paystack = new PaystackCtor();
    paystack.newTransaction({
      key: options.key,
      email: options.email,
      amount: options.amount,
      currency: options.currency ?? 'NGN',
      reference: options.reference,
      metadata: options.metadata,
      onSuccess: wrapSuccess,
      onCancel: wrapCancel,
    });
    return;
  }

  // Legacy v1 fallback
  const legacy = window.PaystackPop as {
    setup: (opts: Record<string, unknown>) => { openIframe: () => void };
  };
  const handler = legacy.setup({
    key: options.key,
    email: options.email,
    amount: options.amount,
    currency: options.currency ?? 'NGN',
    ref: options.reference,
    metadata: options.metadata,
    callback: (response: { reference: string }) => wrapSuccess(response),
    onClose: wrapCancel,
  });
  handler.openIframe();
}
