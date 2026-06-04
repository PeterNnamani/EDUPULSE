import { motion } from 'framer-motion';
import { DollarSign, Users, TrendingUp, AlertTriangle, FileText, CreditCard, ArrowUpRight, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAppStore } from '@/store';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAcademicCalendar } from '@/hooks';
import { fetchFinanceDashboard, type FinanceDashboardData } from '@/services/financeDashboardService';

export default function FinanceDashboard() {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const schoolId = user?.schoolId;
  const { sessionName, termName, isLoading: calendarLoading } = useAcademicCalendar();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinanceDashboardData | null>(null);

  const sessionLabel =
    sessionName && termName
      ? `${termName} · ${sessionName}`
      : sessionName || termName || 'Current academic session';

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchFinanceDashboard(schoolId, sessionLabel);
        if (!cancelled) setData(result);
      } catch (e) {
        console.error('[FINANCE_DASHBOARD]', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [schoolId, sessionLabel]);

  const keyMetrics = data
    ? [
        {
          label: 'Total Collected',
          value: data.metrics.totalCollected,
          change: data.metrics.totalCollectedSub,
          icon: DollarSign,
          trend: 'up' as const,
        },
        {
          label: 'Outstanding Fees',
          value: data.metrics.outstanding,
          change: data.metrics.outstandingSub,
          icon: AlertTriangle,
          isAlert: true,
        },
        {
          label: 'Collected Today',
          value: data.metrics.collectedToday,
          change: data.metrics.collectedTodaySub,
          icon: TrendingUp,
          trend: 'up' as const,
        },
        {
          label: 'Collection Rate',
          value: data.metrics.collectionRate,
          change: data.metrics.collectionRateSub,
          icon: CreditCard,
          trend: 'up' as const,
        },
      ]
    : [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-secondary-text" />
      </div>
    );
  }

  const revenueData = data?.monthlyChart ?? [];
  const outstandingFees = data?.outstandingByClass ?? [];
  const recentPayments = data?.recentPayments ?? [];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-white text-white dark:text-black"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Financial Overview</h1>
            <p className="text-gray-300 dark:text-gray-600">
              {calendarLoading ? 'Loading session…' : sessionLabel}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs opacity-70">Today&apos;s collections</p>
              <p className="text-3xl font-bold">{data?.metrics.collectedToday ?? 'NGN 0'}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {keyMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`card ${metric.isAlert ? 'border-yellow-200 dark:border-yellow-900' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`p-2.5 rounded-xl ${metric.isAlert ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-secondary-bg dark:bg-dark-card'}`}
                >
                  <Icon
                    className={`w-5 h-5 ${metric.isAlert ? 'text-yellow-600 dark:text-yellow-400' : 'text-black dark:text-white'}`}
                  />
                </div>
                <span className="text-xs font-medium text-secondary-text">{metric.change}</span>
              </div>
              <p className="stat-value text-xl">{metric.value}</p>
              <p className="text-xs text-secondary-text">{metric.label}</p>
            </motion.div>
          );
        })}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Expected vs collections (last 6 months)</h3>
        </div>
        <div className="h-72">
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => `${value / 1000}K`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`NGN ${Number(value).toLocaleString()}`, '']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6B7280" fill="#6B7280" fillOpacity={0.08} name="Expected (avg)" />
                <Area type="monotone" dataKey="collections" stroke="#16A34A" fill="#16A34A" fillOpacity={0.15} name="Collected" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-secondary-text text-center py-16">No payment history yet.</p>
          )}
        </div>
        <div className="flex justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-xs text-secondary-text">Expected (session avg/month)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-secondary-text">Actual collections</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h3 className="font-semibold mb-4">Outstanding fees by class</h3>
          <div className="h-64">
            {outstandingFees.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outstandingFees} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" stroke="#6B7280" fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
                  <YAxis dataKey="class" type="category" stroke="#6B7280" fontSize={12} width={56} />
                  <Tooltip formatter={(value: number) => [`NGN ${Number(value).toLocaleString()}`, 'Outstanding']} />
                  <Bar dataKey="amount" fill="#EF4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-secondary-text text-center py-16">No outstanding balances.</p>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent payments</h3>
            <button
              type="button"
              onClick={() => navigate('/fees')}
              className="text-sm text-black dark:text-white hover:underline"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-secondary-bg dark:bg-dark-card"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{payment.student}</p>
                    <p className="text-xs text-secondary-text capitalize">
                      {payment.class} · {payment.method}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium text-green-600">+NGN {payment.amount.toLocaleString()}</p>
                    <p className="text-xs text-secondary-text">{payment.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-secondary-text text-center py-8">No payments recorded yet.</p>
            )}
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => navigate('/fees', { state: { openPayment: true } })}
            className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2"
          >
            <DollarSign className="w-6 h-6" />
            <span className="text-sm font-medium">Record Payment</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/fees')}
            className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2"
          >
            <FileText className="w-6 h-6" />
            <span className="text-sm font-medium">Fee records</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/fees')}
            className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2"
          >
            <Users className="w-6 h-6" />
            <span className="text-sm font-medium">Debtor list</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2"
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-sm font-medium">Reports</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
