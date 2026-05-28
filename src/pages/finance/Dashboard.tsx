import { motion } from 'framer-motion';
import { DollarSign, Users, TrendingUp, AlertTriangle, FileText, CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAppStore } from '@/store';

export default function FinanceDashboard() {
  const { user } = useAppStore();

  const revenueData = [
    { month: 'Sep', revenue: 1200000, collections: 1100000 },
    { month: 'Oct', revenue: 1250000, collections: 1180000 },
    { month: 'Nov', revenue: 1300000, collections: 1250000 },
    { month: 'Dec', revenue: 1280000, collections: 1200000 },
    { month: 'Jan', revenue: 1350000, collections: 1300000 },
    { month: 'Feb', revenue: 1400000, collections: 1350000 },
  ];

  const outstandingFees = [
    { class: 'SS1A', amount: 245000, students: 12 },
    { class: 'SS1B', amount: 198000, students: 10 },
    { class: 'SS2A', amount: 156000, students: 8 },
    { class: 'SS2B', amount: 178000, students: 9 },
    { class: 'SS3A', amount: 320000, students: 15 },
  ];

  const recentPayments = [
    { student: 'John Doe', class: 'SS1A', amount: 45000, method: 'Transfer', time: '10 min ago' },
    { student: 'Jane Smith', class: 'SS2A', amount: 32000, method: 'Cash', time: '25 min ago' },
    { student: 'Mike Johnson', class: 'SS3A', amount: 55000, method: 'Card', time: '1 hour ago' },
    { student: 'Sarah Williams', class: 'SS1B', amount: 28000, method: 'Transfer', time: '2 hours ago' },
  ];

  const keyMetrics = [
    { label: 'Total Revenue', value: 'NGN 7.8M', change: '+12%', icon: DollarSign, trend: 'up' },
    { label: 'Outstanding Fees', value: 'NGN 1.1M', change: '45 students', icon: AlertTriangle, isAlert: true },
    { label: 'Collected Today', value: 'NGN 160K', change: '+8%', icon: TrendingUp, trend: 'up' },
    { label: 'Collection Rate', value: '92%', change: '+5%', icon: CreditCard, trend: 'up' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-white text-white dark:text-black"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Financial Overview</h1>
            <p className="text-gray-300 dark:text-gray-600">First Term 2024/2025 Academic Session</p>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs opacity-70">Today's Collections</p>
              <p className="text-3xl font-bold">NGN 160K</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Key Metrics */}
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
                <div className={`p-2.5 rounded-xl ${metric.isAlert ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-secondary-bg dark:bg-dark-card'}`}>
                  <Icon className={`w-5 h-5 ${metric.isAlert ? 'text-yellow-600 dark:text-yellow-400' : 'text-black dark:text-white'}`} />
                </div>
                <span className={`text-xs font-medium ${
                  metric.trend === 'up' ? 'text-green-600' : 'text-secondary-text'
                }`}>
                  {metric.change}
                </span>
              </div>
              <p className="stat-value text-xl">{metric.value}</p>
              <p className="text-xs text-secondary-text">{metric.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Revenue Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Revenue vs Collections</h3>
          <select className="px-3 py-1.5 border border-border rounded-lg text-sm bg-white dark:bg-dark-card">
            <option>This Session</option>
            <option>Last Session</option>
          </select>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => `${value/1000}K`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`NGN ${(value/1000).toFixed(0)}K`, '']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#000" fill="#000" fillOpacity={0.1} />
              <Area type="monotone" dataKey="collections" stroke="#16A34A" fill="#16A34A" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-black" />
            <span className="text-xs text-secondary-text">Expected Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-secondary-text">Actual Collections</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding by Class */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Outstanding Fees by Class</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outstandingFees} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" stroke="#6B7280" fontSize={12} tickFormatter={(value) => `${value/1000}K`} />
                <YAxis dataKey="class" type="category" stroke="#6B7280" fontSize={12} width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`NGN ${(value/1000).toFixed(0)}K`, 'Outstanding']}
                />
                <Bar dataKey="amount" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Payments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Payments</h3>
            <button className="text-sm text-black dark:text-white hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {recentPayments.map((payment, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{payment.student}</p>
                  <p className="text-xs text-secondary-text">{payment.class} • {payment.method}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">+NGN {(payment.amount/1000).toFixed(0)}K</p>
                  <p className="text-xs text-secondary-text">{payment.time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <DollarSign className="w-6 h-6" />
            <span className="text-sm font-medium">Record Payment</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <FileText className="w-6 h-6" />
            <span className="text-sm font-medium">Generate Invoice</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <Users className="w-6 h-6" />
            <span className="text-sm font-medium">Debtor List</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            <span className="text-sm font-medium">Reports</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
