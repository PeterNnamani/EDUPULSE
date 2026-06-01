import { motion } from 'framer-motion';
import { DollarSign, Users, TrendingUp, AlertTriangle, FileText, CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

export default function FinanceDashboard() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;

  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [outstandingFees, setOutstandingFees] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [collectedToday, setCollectedToday] = useState(0);
  const [keyMetrics, setKeyMetrics] = useState([
    { label: 'Total Revenue', value: 'NGN 0', change: '+0%', icon: DollarSign, trend: 'up' as const },
    { label: 'Outstanding Fees', value: 'NGN 0', change: '0 students', icon: AlertTriangle, isAlert: true },
    { label: 'Collected Today', value: 'NGN 0', change: '+0%', icon: TrendingUp, trend: 'up' as const },
    { label: 'Collection Rate', value: '0%', change: '+0%', icon: CreditCard, trend: 'up' as const },
  ]);

  useEffect(() => {
    if (schoolId) {
      fetchFinanceData();
    }
  }, [schoolId]);

  const fetchFinanceData = async () => {
    if (!schoolId) return;

    try {
      console.log('🔄 Fetching finance data for schoolId:', schoolId);

      // 1. Fetch all payments
      let allPayments: any[] = [];
      try {
        const { data: payments, error } = await supabase
          .from('payments')
          .select('id, student_id, amount, payment_method, status, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        allPayments = payments || [];
        console.log('✓ Payments:', allPayments.length);
      } catch (e) {
        console.warn('⚠️ Payments error:', e);
      }

      // 2. Fetch students with class info for outstanding fees breakdown
      let students: any[] = [];
      try {
        const { data: studentsData, error } = await supabase
          .from('students')
          .select('id, first_name, last_name, class_id, student_id')
          .eq('school_id', schoolId);
        if (error) throw error;
        students = studentsData || [];
        console.log('✓ Students:', students.length);
      } catch (e) {
        console.warn('⚠️ Students error:', e);
      }

      // 3. Fetch classes
      let classes: any[] = [];
      try {
        const { data: classesData, error } = await supabase
          .from('classes')
          .select('id, class_name')
          .eq('school_id', schoolId);
        if (error) throw error;
        classes = classesData || [];
        console.log('✓ Classes:', classes.length);
      } catch (e) {
        console.warn('⚠️ Classes error:', e);
      }

      // Calculate metrics from payments
      const totalRevenue = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const completedPayments = allPayments.filter(p => p.status === 'completed');
      const collectedAmount = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const pendingPayments = allPayments.filter(p => p.status === 'pending');
      const outstandingAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const collectionRate = totalRevenue > 0 ? ((collectedAmount / totalRevenue) * 100).toFixed(0) : '0';
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const collectedToday = completedPayments
        .filter(p => new Date(p.created_at) >= todayStart)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      // Store for banner display
      setCollectedToday(collectedToday);

      // Update key metrics
      setKeyMetrics([
        {
          label: 'Total Revenue',
          value: `NGN ${(totalRevenue / 1000000).toFixed(1)}M`,
          change: `${allPayments.length} transactions`,
          icon: DollarSign,
          trend: 'up' as const
        },
        {
          label: 'Outstanding Fees',
          value: `NGN ${(outstandingAmount / 1000).toFixed(0)}K`,
          change: `${pendingPayments.length} students`,
          icon: AlertTriangle,
          isAlert: true
        },
        {
          label: 'Collected Today',
          value: `NGN ${(collectedToday / 1000).toFixed(0)}K`,
          change: `${completedPayments.filter(p => new Date(p.created_at) >= todayStart).length} payments`,
          icon: TrendingUp,
          trend: 'up' as const
        },
        {
          label: 'Collection Rate',
          value: `${collectionRate}%`,
          change: totalRevenue > 0 ? '+0%' : 'N/A',
          icon: CreditCard,
          trend: 'up' as const
        },
      ]);

      // 4. Generate monthly revenue data (last 6 months)
      const monthlyData: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const monthlyPayments = allPayments.filter(p => {
          const pDate = new Date(p.created_at);
          return pDate >= monthStart && pDate <= monthEnd;
        });

        const monthlyTotal = monthlyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const monthlyCollected = monthlyPayments
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + (p.amount || 0), 0);

        monthlyData.push({
          month: monthStart.toLocaleString('default', { month: 'short' }),
          revenue: monthlyTotal,
          collections: monthlyCollected,
        });
      }
      setRevenueData(monthlyData);
      console.log('✓ Revenue data:', monthlyData.length, 'months');

      // 5. Calculate outstanding fees by class
      const outstandingByClass: any[] = [];
      classes.forEach(cls => {
        const classStudents = students.filter(s => s.class_id === cls.id);
        const classUnpaidPayments = pendingPayments.filter(p =>
          classStudents.some(s => s.id === p.student_id)
        );
        const classOutstandingAmount = classUnpaidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        if (classOutstandingAmount > 0 || classStudents.length > 0) {
          outstandingByClass.push({
            class: cls.class_name || 'Unknown',
            amount: classOutstandingAmount,
            students: classUnpaidPayments.length,
          });
        }
      });
      outstandingByClass.sort((a, b) => b.amount - a.amount).slice(0, 5);
      setOutstandingFees(outstandingByClass.slice(0, 5));
      console.log('✓ Outstanding fees by class:', outstandingByClass.length);

      // 6. Get recent payments with student info
      const recentPaymentsData: any[] = [];
      for (const payment of allPayments.slice(0, 10)) {
        const student = students.find(s => s.id === payment.student_id);
        const studentClass = student ? classes.find(c => c.id === student.class_id) : null;
        const timeDiff = new Date().getTime() - new Date(payment.created_at).getTime();
        let timeStr = '';
        if (timeDiff < 60000) timeStr = 'Just now';
        else if (timeDiff < 3600000) timeStr = `${Math.floor(timeDiff / 60000)} min ago`;
        else if (timeDiff < 86400000) timeStr = `${Math.floor(timeDiff / 3600000)} hours ago`;
        else timeStr = `${Math.floor(timeDiff / 86400000)} days ago`;

        recentPaymentsData.push({
          student: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
          class: studentClass?.class_name || 'Unknown',
          amount: payment.amount,
          method: payment.payment_method || 'Transfer',
          time: timeStr,
          status: payment.status,
        });
      }
      setRecentPayments(recentPaymentsData.slice(0, 4));
      console.log('✓ Recent payments:', recentPaymentsData.length);

      console.log('========================================');
      console.log('📊 Finance data loaded successfully');
      console.log('========================================');
    } catch (error) {
      console.error('Fatal error fetching finance data:', error);
    }
  };

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
              <p className="text-3xl font-bold">NGN {(collectedToday / 1000).toFixed(0)}K</p>
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
                <span className={`text-xs font-medium ${metric.trend === 'up' ? 'text-green-600' : 'text-secondary-text'
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
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => `${value / 1000}K`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`NGN ${(value / 1000).toFixed(0)}K`, '']}
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
                <XAxis type="number" stroke="#6B7280" fontSize={12} tickFormatter={(value) => `${value / 1000}K`} />
                <YAxis dataKey="class" type="category" stroke="#6B7280" fontSize={12} width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`NGN ${(value / 1000).toFixed(0)}K`, 'Outstanding']}
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
                  <p className="font-medium text-green-600">+NGN {(payment.amount / 1000).toFixed(0)}K</p>
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
