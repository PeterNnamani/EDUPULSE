import { motion } from 'framer-motion';
import { Check, CreditCard, Calendar, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store';

const plans = [
  {
    name: 'Starter',
    price: 'NGN 15,000',
    period: 'Monthly',
    students: 'Up to 300 students',
    features: ['Attendance tracking', 'Grade management', 'Basic reports', 'Parent portal', 'Email support'],
    current: false,
    popular: false,
  },
  {
    name: 'Professional',
    price: 'NGN 75,000',
    period: 'Every 6 Months',
    students: 'Up to 1,000 students',
    features: ['Everything in Starter', 'Risk analysis', 'Intervention tracking', 'Advanced analytics', 'SMS notifications', 'Priority support'],
    current: false,
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'NGN 120,000',
    period: 'Yearly',
    students: 'Unlimited students',
    features: ['Everything in Professional', 'Multiple campuses', 'Custom branding', 'API access', 'Dedicated support', 'Training sessions'],
    current: false,
    popular: false,
  },
  {
    name: 'Lifetime',
    price: 'NGN 500,000',
    period: 'One-Time',
    students: 'Unlimited students',
    features: ['Everything in Enterprise', 'Lifetime updates', 'No renewal fees', 'Priority feature requests', 'Dedicated account manager'],
    current: false,
    popular: false,
  },
];

export default function SubscriptionsPage() {
  const { user } = useAppStore();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Subscription Plans</h1>
        <p className="text-secondary-text">Choose the right plan for your school</p>
      </div>

      {/* Current Subscription */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-white text-white dark:text-black"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="badge badge-warning mb-2">Free Trial</span>
            <h2 className="text-xl font-bold">You're on a 30-day free trial</h2>
            <p className="text-sm opacity-80 mt-1">Trial ends: February 25, 2025</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-3xl font-bold">30</p>
              <p className="text-xs opacity-70">Days remaining</p>
            </div>
            <button className="btn-primary bg-white text-black dark:bg-black dark:text-white">
              Upgrade Now
            </button>
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
              <p className="text-3xl font-bold mt-2">{plan.price}</p>
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
              className={`w-full py-3 rounded-xl font-medium transition-colors ${
                plan.popular
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'border-2 border-black dark:border-white hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black'
              }`}
            >
              {plan.current ? 'Current Plan' : 'Choose Plan'}
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left rounded-l-lg">Date</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Receipt</th>
              </tr>
            </thead>
            <tbody>
              <tr className="table-row">
                <td className="px-4 py-3">Jan 26, 2025</td>
                <td className="px-4 py-3">Free Trial Started</td>
                <td className="px-4 py-3">NGN 0</td>
                <td className="px-4 py-3">
                  <span className="badge badge-success">Active</span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-sm text-black dark:text-white hover:underline">View</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
