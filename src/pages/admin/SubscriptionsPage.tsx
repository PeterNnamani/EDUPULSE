import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, CreditCard, Calendar, TrendingUp, Loader, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { paymentLogger } from '@/services/paymentLogger';
import { PaymentVerificationService } from '@/services/paymentVerificationService';
import {
  getSchoolSubscriptionStatus,
  notifySubscriptionActivated,
  type SchoolSubscriptionStatus,
} from '@/services/subscriptionService';

const PAYSTACK_PUBLIC_KEY =
  import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_b2b96677589473d60b1a57c9b0ed6923973ebe6c';

const plans = [
  {
    name: 'Starter',
    price: 15000,
    displayPrice: 'NGN 15,000',
    period: 'Monthly',
    students: 'Up to 300 students',
    features: ['Attendance tracking', 'Grade management', 'Basic reports', 'Parent portal', 'Email support'],
    current: false,
    popular: false,
  },
  {
    name: 'Professional',
    price: 75000,
    displayPrice: 'NGN 75,000',
    period: 'Every 6 Months',
    students: 'Up to 1,000 students',
    features: ['Everything in Starter', 'Risk analysis', 'Intervention tracking', 'Advanced analytics', 'SMS notifications', 'Priority support'],
    current: false,
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 120000,
    displayPrice: 'NGN 120,000',
    period: 'Yearly',
    students: 'Unlimited students',
    features: ['Everything in Professional', 'Multiple campuses', 'Custom branding', 'API access', 'Dedicated support', 'Training sessions'],
    current: false,
    popular: false,
  },
  {
    name: 'Lifetime',
    price: 500000,
    displayPrice: 'NGN 500,000',
    period: 'One-Time',
    students: 'Unlimited students',
    features: ['Everything in Enterprise', 'Lifetime updates', 'No renewal fees', 'Priority feature requests', 'Dedicated account manager'],
    current: false,
    popular: false,
  },
];

export default function SubscriptionsPage() {
  const { user } = useAppStore();
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SchoolSubscriptionStatus | null>(null);

  // Load Paystack script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const loadBilling = async () => {
    if (!user?.schoolId) return;
    const [history, status] = await Promise.all([
      PaymentVerificationService.refreshBillingHistory(user.schoolId),
      getSchoolSubscriptionStatus(user.schoolId),
    ]);
    setBillingHistory(history);
    setSubscriptionStatus(status);
  };

  useEffect(() => {
    void loadBilling();
  }, [user?.schoolId]);

  const handlePayment = async (plan: any) => {
    if (!user?.id || !user?.email || !user?.schoolId) {
      setError('User information not found');
      return;
    }

    setProcessing(plan.name);
    setError('');

    // Safety timeout to reset button after 10 minutes if callbacks don't fire
    const timeoutId = setTimeout(() => {
      setProcessing(null);
      setError('Payment processing timed out. Please refresh and try again.');
    }, 600000);

    try {
      // Initialize Paystack payment
      const PaystackPop = (window as any).PaystackPop;
      if (!PaystackPop) {
        clearTimeout(timeoutId);
        setError('Paystack payment gateway not loaded. Please refresh and try again.');
        setProcessing(null);
        return;
      }

      const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount: plan.price * 100, // Convert to kobo
        currency: 'NGN',
        ref: `${user.schoolId}-${plan.name}-${Date.now()}`,
        onClose: () => {
          clearTimeout(timeoutId);
          setProcessing(null);
          setError('Payment cancelled');
        },
        onError: (error: any) => {
          clearTimeout(timeoutId);
          console.error('Paystack error:', error);
          setProcessing(null);
          setError(`Payment error: ${error?.message || 'Unknown error'}`);
        },
        onSuccess: async (response: any) => {
          clearTimeout(timeoutId);
          try {
            console.log('Payment successful, reference:', response.reference);
            paymentLogger.initialize(user.schoolId, response.reference);
            paymentLogger.info('PAYMENT_SUCCESS', 'Paystack payment completed', {
              email: user.email,
              plan: plan.name,
              amount: plan.price,
            });

            // Determine plan settings
            const startDate = new Date();
            const endDate = new Date();
            let billingCycle = 'monthly';
            let maxStudents = 300;
            const planNameLower = plan.name.toLowerCase();

            if (plan.period === 'Monthly') {
              endDate.setMonth(endDate.getMonth() + 1);
              billingCycle = 'monthly';
              maxStudents = 300;
            } else if (plan.period === 'Every 6 Months') {
              endDate.setMonth(endDate.getMonth() + 6);
              billingCycle = 'biannual';
              maxStudents = 1000;
            } else if (plan.period === 'Yearly') {
              endDate.setFullYear(endDate.getFullYear() + 1);
              billingCycle = 'yearly';
              maxStudents = 999999;
            } else if (plan.period === 'One-Time') {
              endDate.setFullYear(endDate.getFullYear() + 100);
              billingCycle = 'lifetime';
              maxStudents = 999999;
            }

            paymentLogger.info('PLAN_CONFIGURATION', 'Plan settings configured', {
              plan: planNameLower,
              billingCycle,
              maxStudents,
              startDate,
              endDate,
            });

            // Step 1: Create initial subscription record with 'pending' status
            paymentLogger.info('SUPABASE_INSERT_PENDING', 'Creating pending subscription record');
            const { data: subscriptionData, error: subscriptionError } = await supabase
              .from('subscriptions')
              .insert({
                school_id: user.schoolId,
                plan: planNameLower,
                amount: plan.price,
                currency: 'NGN',
                payment_reference: response.reference,
                status: 'pending', // Set to pending until verified
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                billing_cycle: billingCycle,
                max_students: maxStudents,
                auto_renew: plan.period !== 'One-Time',
              })
              .select('id');

            if (subscriptionError) {
              paymentLogger.supabaseInsert('error', 'subscriptions', null, subscriptionError);
              throw subscriptionError;
            }

            paymentLogger.supabaseInsert('success', 'subscriptions', subscriptionData);

            const subscriptionId = subscriptionData?.[0]?.id;
            if (!subscriptionId) {
              throw new Error('Subscription creation failed - no ID returned');
            }

            // Step 2: Call server-side Paystack verification endpoint
            paymentLogger.info('PAYSTACK_VERIFICATION', 'Calling server-side verification', {
              reference: response.reference,
            });

            const verification = await PaymentVerificationService.verifyPayment(
              response.reference,
              user.schoolId,
              user.email
            );

            if (!verification.success) {
              throw new Error(verification.error || 'Payment verification failed');
            }

            paymentLogger.info('SUBSCRIPTION_ACTIVATED', 'Subscription activated after verification', {
              subscriptionId,
              verificationSuccess: true,
            });

            // Step 4: Create invoice record for billing tracking
            const invoiceNumber = `INV-${user.schoolId}-${Date.now()}`;
            paymentLogger.info('INVOICE_CREATION', 'Creating invoice record', {
              invoiceNumber,
            });

            const { error: invoiceError } = await supabase
              .from('invoices')
              .insert({
                school_id: user.schoolId,
                subscription_id: subscriptionId,
                invoice_number: invoiceNumber,
                amount: plan.price,
                currency: 'NGN',
                due_date: startDate.toISOString().split('T')[0],
                paid_at: new Date().toISOString(),
                status: 'paid',
                payment_method: 'paystack',
                payment_reference: response.reference,
              });

            if (invoiceError) {
              paymentLogger.supabaseInsert('error', 'invoices', null, invoiceError);
              // Don't throw - invoice creation shouldn't block the flow
              paymentLogger.info(
                'INVOICE_WARNING',
                'Invoice creation failed but subscription is active',
                { error: invoiceError.message }
              );
            } else {
              paymentLogger.supabaseInsert('success', 'invoices', { invoiceNumber });
            }

            // Step 5: Update school subscription status (optional)
            try {
              await supabase
                .from('schools')
                .update({
                  subscription_status: 'active',
                })
                .eq('id', user.schoolId);
            } catch (err) {
              paymentLogger.info(
                'SCHOOL_UPDATE_SKIPPED',
                'Schools table update skipped (column may not exist)'
              );
            }

            await notifySubscriptionActivated(user.schoolId, plan.name, plan.price);
            await loadBilling();

            await paymentLogger.saveLogs();

            // Step 7: Display success and update UI
            const summary = paymentLogger.getSummary();
            setSuccess(`✓ Successfully subscribed to ${plan.name} plan!`);
            paymentLogger.info('COMPLETE', 'Payment flow completed successfully');

            console.log('Payment Summary:', summary);
            console.log('Payment Logs:', paymentLogger.getLogs());

            setTimeout(() => setSuccess(''), 5000);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            paymentLogger.error(
              'PAYMENT_FLOW_ERROR',
              'Payment processing failed',
              errorMsg,
              { error: err }
            );
            await paymentLogger.saveLogs();

            setError(
              `Payment processing failed: ${errorMsg}. Payment was successful on Paystack but subscription update failed. Please contact support with reference: ${response.reference}`
            );

            console.error('Payment Error Details:', {
              message: errorMsg,
              logs: paymentLogger.getLogs(),
              summary: paymentLogger.getSummary(),
            });
          } finally {
            setProcessing(null);
          }
        },
      });

      // Open the Paystack modal
      handler.openIframe();
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Subscription Plans</h1>
        <p className="text-secondary-text">Choose the right plan for your school</p>
      </div>

      {/* Error Message */}
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

      {/* Success Message */}
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

      {/* Current Subscription */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-white text-white dark:text-black"
      >
        <div className="flex items-center justify-between">
          <div>
            <span
              className={`badge mb-2 ${
                subscriptionStatus?.isExpired
                  ? 'badge-danger'
                  : subscriptionStatus?.activePlan
                    ? 'badge-success'
                    : 'badge-warning'
              }`}
            >
              {subscriptionStatus?.activePlan
                ? `${subscriptionStatus.activePlan} plan`
                : subscriptionStatus?.isTrial
                  ? 'Free trial'
                  : subscriptionStatus?.subscriptionStatus ?? 'Trial'}
            </span>
            <h2 className="text-xl font-bold">{subscriptionStatus?.label ?? 'Loading subscription…'}</h2>
            {subscriptionStatus?.trialEndsAt && subscriptionStatus.isTrial && (
              <p className="text-sm opacity-80 mt-1">
                Trial ends: {new Date(subscriptionStatus.trialEndsAt).toLocaleDateString()}
              </p>
            )}
            {subscriptionStatus?.activeEndDate && subscriptionStatus.activePlan && (
              <p className="text-sm opacity-80 mt-1">
                Renews / ends: {new Date(subscriptionStatus.activeEndDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-3xl font-bold">{subscriptionStatus?.daysRemaining ?? '—'}</p>
              <p className="text-xs opacity-70">Days remaining</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`card relative ${plan.popular ? 'border-2 border-black dark:border-white' : ''}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-full text-xs font-medium">
                  Most Popular
                </span>
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="font-semibold text-lg">{plan.name}</h3>
              <p className="text-3xl font-bold mt-2">{plan.displayPrice}</p>
              <p className="text-sm text-secondary-text">{plan.period}</p>
            </div>

            <p className="text-sm text-center mb-4 font-medium">{plan.students}</p>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handlePayment(plan)}
              disabled={processing === plan.name}
              className={`w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${plan.popular
                ? 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'
                : 'border-2 border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black'
                } ${processing === plan.name ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {processing === plan.name ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  {plan.current ? 'Current Plan' : 'Choose Plan'}
                </>
              )}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Billing History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
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
                    <td className="px-4 py-3">{transaction.plan}</td>
                    <td className="px-4 py-3">₦{transaction.amount.toLocaleString()} {transaction.currency}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${transaction.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-secondary-text">{transaction.payment_reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-secondary-text">No billing history yet</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
