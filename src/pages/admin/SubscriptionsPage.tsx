import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, CreditCard, Loader, AlertCircle } from 'lucide-react';
import { paymentLogger } from '@/services/paymentLogger';
import {
  PaymentVerificationService,
  type SubscriptionPlanPayload,
} from '@/services/paymentVerificationService';
import {
  getSchoolSubscriptionStatus,
  notifySubscriptionActivated,
  type SchoolSubscriptionStatus,
} from '@/services/subscriptionService';
import {
  PLAN_DEFINITIONS,
  PLAN_ORDER,
  annualDiscountPct,
  type PlanDefinition,
  normalizePlan,
  type PlanTier,
} from '@/config/planFeatures';
import { refreshFeatureAccess } from '@/hooks/useFeatureAccess';
import { useAppStore } from '@/store';
import {
  getPaystackPublicKey,
  getPaystackKeyMode,
  paystackModeLabel,
} from '@/config/paystackConfig';
import { loadPaystackInline, openPaystackCheckout } from '@/lib/paystackCheckout';
import PaystackPageOverlay from '@/components/PaystackPageOverlay';

type BillingChoice = 'monthly' | 'annual';

const plans = PLAN_ORDER.map((id) => PLAN_DEFINITIONS[id]);

function isPlanCurrentlyPaid(
  tier: PlanTier,
  activePaidPlans: { tier: PlanTier; endDate: string }[] | undefined
): { active: boolean; endDate?: string } {
  const slot = activePaidPlans?.find((p) => p.tier === tier);
  return slot ? { active: true, endDate: slot.endDate } : { active: false };
}

function priceFor(plan: PlanDefinition, cycle: BillingChoice): number {
  return cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
}

function buildPlanPayload(plan: PlanDefinition, cycle: BillingChoice): SubscriptionPlanPayload {
  const startDate = new Date();
  const endDate = new Date();
  if (cycle === 'annual') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  return {
    plan: plan.id,
    amount: priceFor(plan, cycle),
    currency: 'NGN',
    billingCycle: cycle === 'annual' ? 'annual' : 'monthly',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    maxStudents: Number.isFinite(plan.maxStudents) ? plan.maxStudents : 999999,
    autoRenew: true,
  };
}

export default function SubscriptionsPage() {
  const { user } = useAppStore();
  const paystackPublicKey = getPaystackPublicKey();
  const paystackKeyMode = getPaystackKeyMode(paystackPublicKey);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SchoolSubscriptionStatus | null>(null);
  const [paystackReady, setPaystackReady] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [billingChoice, setBillingChoice] = useState<BillingChoice>('monthly');
  const paymentCompletedRef = useRef(false);

  useEffect(() => {
    let active = true;
    void loadPaystackInline()
      .then(() => {
        if (active) setPaystackReady(true);
      })
      .catch(() => {
        if (active) setError('Could not load Paystack. Check your internet connection.');
      });
    return () => {
      active = false;
      document.body.classList.remove('paystack-checkout-open');
    };
  }, []);

  const loadBilling = useCallback(async () => {
    if (!user?.schoolId) return;
    const [history, status] = await Promise.all([
      PaymentVerificationService.refreshBillingHistory(user.schoolId),
      getSchoolSubscriptionStatus(user.schoolId),
    ]);
    setBillingHistory(history);
    setSubscriptionStatus(status);
  }, [user?.schoolId]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const completePayment = async (
    reference: string,
    plan: PlanDefinition,
    payerEmail: string
  ) => {
    if (!user?.schoolId) return;

    paymentLogger.initialize(user.schoolId, reference);
    paymentLogger.info('PAYMENT_SUCCESS', 'Paystack payment completed', {
      email: payerEmail,
      plan: plan.name,
      amount: priceFor(plan, billingChoice),
      reference,
    });

    const planPayload = buildPlanPayload(plan, billingChoice);

    const verification = await PaymentVerificationService.verifyPayment(
      reference,
      user.schoolId,
      payerEmail,
      planPayload
    );

    if (!verification.success) {
      throw new Error(verification.error || 'Payment verification failed');
    }

    refreshFeatureAccess(user.schoolId);

    await notifySubscriptionActivated(user.schoolId, plan.name, priceFor(plan, billingChoice));
    await loadBilling();
    await paymentLogger.saveLogs();

    paymentCompletedRef.current = true;
    setSuccess(`Successfully subscribed to ${plan.name}!`);
    setTimeout(() => setSuccess(''), 8000);
  };

  const handlePayment = (plan: PlanDefinition) => {
    if (!user?.schoolId) {
      setError('School not found. Please log in again.');
      return;
    }

    const payerEmail = user.email?.trim();
    if (!payerEmail) {
      setError('Your account needs an email address for Paystack. Log out and sign in with your admin email.');
      return;
    }

    if (!paystackReady) {
      setError('Paystack is still loading. Wait a moment and try again.');
      return;
    }

    if (!paystackPublicKey) {
      setError('Add VITE_PAYSTACK_PUBLIC_KEY to your .env file to enable subscription payments.');
      return;
    }

    if (paystackKeyMode === 'invalid') {
      setError('VITE_PAYSTACK_PUBLIC_KEY must start with pk_live_ or pk_test_.');
      return;
    }

    if (import.meta.env.DEV && paystackKeyMode === 'test') {
      console.warn(
        '[PAYSTACK] Test public key loaded — checkout will show the Paystack sandbox. Use pk_live_ in .env for live payments, then restart npm run dev.'
      );
    }

    if (!import.meta.env.VITE_SUPABASE_URL) {
      setError('VITE_SUPABASE_URL is missing in your .env file.');
      return;
    }

    setProcessing(plan.name);
    setError('');
    paymentCompletedRef.current = false;

    const timeoutId = window.setTimeout(() => {
      setProcessing(null);
      if (!paymentCompletedRef.current) {
        setError('Payment window timed out. If you paid, refresh this page to see billing history.');
      }
    }, 600000);

    const resetProcessing = () => {
      window.clearTimeout(timeoutId);
      setProcessing(null);
    };

    try {
      const reference = `EDU-${user.schoolId.slice(0, 8)}-${plan.id}-${Date.now()}`;

      setCheckoutOpen(true);

      openPaystackCheckout({
        key: paystackPublicKey,
        email: payerEmail,
        amount: priceFor(plan, billingChoice) * 100,
        currency: 'NGN',
        reference,
        metadata: {
          school_id: user.schoolId,
          plan: plan.id,
          billing_cycle: billingChoice,
        },
        onSuccess: (response) => {
          setCheckoutOpen(false);
          void (async () => {
            try {
              await completePayment(response.reference, plan, payerEmail);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              paymentLogger.error('PAYMENT_FLOW_ERROR', 'Post-payment failed', msg);
              await paymentLogger.saveLogs();
              setError(
                `Paystack payment succeeded but activation failed: ${msg}. Reference: ${response.reference}`
              );
            } finally {
              resetProcessing();
            }
          })();
        },
        onCancel: () => {
          setCheckoutOpen(false);
          if (!paymentCompletedRef.current) {
            resetProcessing();
            setError('Payment window closed. No charge was recorded.');
          }
        },
      });
    } catch (err) {
      setCheckoutOpen(false);
      resetProcessing();
      setError(err instanceof Error ? err.message : 'Could not open Paystack checkout.');
    }
  };

  return (
    <div className="space-y-8 relative">
      <PaystackPageOverlay open={checkoutOpen} />
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Subscription Plans</h1>
        <p className="text-secondary-text">Choose the right plan for your school</p>
        {!paystackReady && (
          <p className="text-xs text-secondary-text mt-2">Loading payment gateway…</p>
        )}
        <p
          className={`text-xs mt-2 font-medium ${
            paystackKeyMode === 'live'
              ? 'text-green-700 dark:text-green-400'
              : paystackKeyMode === 'test'
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-secondary-text'
          }`}
        >
          Paystack: {paystackModeLabel(paystackKeyMode)}
          {paystackKeyMode === 'test' && ' — replace pk_test_ with pk_live_ in .env and restart the dev server'}
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900"
        >
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card card-hero"
      >
        <div className="flex items-center justify-between">
          <div>
            <span
              className={`badge mb-2 ${
                subscriptionStatus?.isExpired
                  ? 'badge-danger'
                  : subscriptionStatus?.activePaidPlans?.length || subscriptionStatus?.isTrial
                    ? 'badge-success'
                    : 'badge-warning'
              }`}
            >
              {subscriptionStatus?.activePaidPlans?.length
                ? `${PLAN_DEFINITIONS[normalizePlan(subscriptionStatus.activePlan)].name} in effect`
                : subscriptionStatus?.isTrial
                  ? 'Free trial'
                  : subscriptionStatus?.subscriptionStatus ?? 'Trial'}
            </span>
            <h2 className="text-xl font-bold">{subscriptionStatus?.label ?? 'Loading subscription…'}</h2>
            {subscriptionStatus?.activePaidPlans && subscriptionStatus.activePaidPlans.length > 0 && (
              <div className="text-sm opacity-80 mt-2 space-y-1">
                {subscriptionStatus.activePaidPlans.map((slot) => (
                  <p key={slot.tier}>
                    {PLAN_DEFINITIONS[slot.tier].name}: active until{' '}
                    {new Date(slot.endDate).toLocaleDateString()} ({slot.daysRemaining} day
                    {slot.daysRemaining !== 1 ? 's' : ''} left)
                  </p>
                ))}
              </div>
            )}
            {subscriptionStatus?.trialEndsAt && subscriptionStatus.isTrial && (
              <p className="text-sm opacity-80 mt-1">
                Trial ends: {new Date(subscriptionStatus.trialEndsAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{subscriptionStatus?.daysRemaining ?? '—'}</p>
            <p className="text-xs opacity-70">Days remaining</p>
          </div>
        </div>
      </motion.div>

      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary-bg dark:bg-dark-card">
          <button
            type="button"
            onClick={() => setBillingChoice('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingChoice === 'monthly' ? 'pill-active' : 'text-secondary-text'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingChoice('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingChoice === 'annual' ? 'pill-active' : 'text-secondary-text'
            }`}
          >
            Annual <span className="text-green-500">save up to 17%</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, index) => {
          const price = priceFor(plan, billingChoice);
          const discount = annualDiscountPct(plan);
          const paidSlot = isPlanCurrentlyPaid(plan.id, subscriptionStatus?.activePaidPlans);
          const isActivePlan = paidSlot.active;
          return (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`card relative ${plan.popular ? 'border-2 border-black dark:border-white' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="pill-active px-3 py-1 rounded-full text-xs font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <p className="text-3xl font-bold mt-2">NGN {price.toLocaleString()}</p>
                <p className="text-sm text-secondary-text">
                  {billingChoice === 'annual' ? 'per year' : 'per month'}
                </p>
                {billingChoice === 'annual' && discount > 0 && (
                  <p className="text-xs text-green-600 mt-1">Save {discount}% vs monthly</p>
                )}
                <p className="text-xs text-secondary-text mt-2">{plan.tagline}</p>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.highlights.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handlePayment(plan)}
                disabled={isActivePlan || !paystackReady || processing === plan.name}
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  isActivePlan
                    ? 'bg-secondary-bg dark:bg-dark-card text-secondary-text border border-green-200/70 dark:border-green-900/50 cursor-default'
                    : plan.popular
                      ? 'pill-active hover:opacity-90'
                      : 'border border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5'
                } ${processing === plan.name || !paystackReady ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {processing === plan.name ? (
                  <>
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                    Processing…
                  </>
                ) : isActivePlan && paidSlot.endDate ? (
                  `Active · ${new Date(paidSlot.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    Choose Plan
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <h2 className="font-semibold mb-4">Billing History</h2>
        {billingHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left rounded-l-lg">Date</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left rounded-r-lg">Reference</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.map((transaction) => (
                  <tr key={transaction.id} className="table-row">
                    <td className="px-4 py-3">{new Date(transaction.start_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 capitalize">{transaction.plan}</td>
                    <td className="px-4 py-3">₦{Number(transaction.amount).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const stillActive =
                          transaction.status === 'active' &&
                          new Date(transaction.end_date) >= new Date(new Date().toDateString());
                        const label = stillActive
                          ? `active · ${new Date(transaction.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                          : transaction.status;
                        return (
                          <span
                            className={`badge text-xs ${stillActive ? 'badge-success' : transaction.status === 'expired' ? 'badge-danger' : 'badge-warning'}`}
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-secondary-text">
                      {transaction.payment_reference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-8 text-secondary-text">No billing history yet</p>
        )}
      </motion.div>
    </div>
  );
}
