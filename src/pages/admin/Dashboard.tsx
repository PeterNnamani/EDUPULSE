import { motion } from 'framer-motion';
import {
  Users,
  GraduationCap,
  Building,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  CalendarDays,
  ClipboardCheck,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';

interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  attendanceRate: number;
  averageGrade: number;
  highRiskStudents: number;
  pendingFees: number;
  openInterventions: number;
}

const COLORS = ['#16A34A', '#F59E0B', '#EF4444', '#22C55E'];

export default function AdminDashboard() {
  const { user } = useAppStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalStaff: 0,
    totalClasses: 0,
    attendanceRate: 0,
    averageGrade: 0,
    highRiskStudents: 0,
    pendingFees: 0,
    openInterventions: 0,
  });
  const [loading, setLoading] = useState(true);

  const attendanceData = [
    { day: 'Mon', present: 95, absent: 5 },
    { day: 'Tue', present: 92, absent: 8 },
    { day: 'Wed', present: 88, absent: 12 },
    { day: 'Thu', present: 94, absent: 6 },
    { day: 'Fri', present: 91, absent: 9 },
  ];

  const riskDistribution = [
    { name: 'Low Risk', value: 65, color: '#22C55E' },
    { name: 'Medium Risk', value: 25, color: '#F59E0B' },
    { name: 'High Risk', value: 8, color: '#EF4444' },
    { name: 'Critical', value: 2, color: '#DC2626' },
  ];

  const performanceData = [
    { month: 'Sep', score: 68 },
    { month: 'Oct', score: 72 },
    { month: 'Nov', score: 71 },
    { month: 'Dec', score: 75 },
    { month: 'Jan', score: 78 },
    { month: 'Feb', score: 80 },
  ];

  useEffect(() => {
    fetchStats();
  }, [user?.schoolId]);

  const fetchStats = async () => {
    if (!user?.schoolId) return;

    try {
      const [studentsRes, staffRes, classesRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', user.schoolId),
        supabase.from('staff').select('id', { count: 'exact', head: true }).eq('school_id', user.schoolId),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', user.schoolId),
      ]);

      setStats({
        totalStudents: studentsRes.count || 0,
        totalStaff: staffRes.count || 0,
        totalClasses: classesRes.count || 0,
        attendanceRate: 92,
        averageGrade: 68,
        highRiskStudents: 12,
        pendingFees: 245000,
        openInterventions: 8,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, change: '+12 this term' },
    { label: 'Total Staff', value: stats.totalStaff, icon: GraduationCap, change: 'All active' },
    { label: 'Classes', value: stats.totalClasses, icon: Building, change: '24 students avg' },
    { label: 'Attendance Rate', value: `${stats.attendanceRate}%`, icon: CalendarDays, change: '+2.5%', trend: 'up' },
    { label: 'Average Grade', value: `${stats.averageGrade}%`, icon: ClipboardCheck, change: '+5%', trend: 'up' },
    { label: 'High Risk Students', value: stats.highRiskStudents, icon: AlertTriangle, change: '-3', trend: 'down', isAlert: true },
    { label: 'Pending Fees', value: `NGN ${stats.pendingFees.toLocaleString()}`, icon: DollarSign, change: '45 students' },
    { label: 'Open Interventions', value: stats.openInterventions, icon: TrendingUp, change: '4 urgent' },
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
            <h1 className="text-2xl font-bold mb-2">Welcome back, {user?.fullName?.split(' ')[0]}</h1>
            <p className="text-gray-300 dark:text-gray-600">Here's your school overview for today</p>
          </div>
          <div className="hidden md:block">
            <div className="text-right">
              <p className="text-sm text-gray-400 dark:text-gray-500">Trial ends in</p>
              <p className="text-2xl font-bold">30 days</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`card ${stat.isAlert ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl ${
                  stat.isAlert ? 'bg-red-100 dark:bg-red-900/30' : 'bg-secondary-bg dark:bg-dark-card'
                }`}>
                  <Icon className={`w-5 h-5 ${stat.isAlert ? 'text-red-600 dark:text-red-400' : 'text-black dark:text-white'}`} />
                </div>
                <span className={`text-xs font-medium ${
                  stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-green-600' : 'text-secondary-text'
                }`}>
                  {stat.change}
                </span>
              </div>
              <div className="mt-3">
                <p className="stat-label">{stat.label}</p>
                <p className={`stat-value ${stat.isAlert ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {stat.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Weekly Attendance</h3>
            <span className="text-sm text-secondary-text">This week</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="present" fill="#16A34A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Risk Distribution</h3>
            <span className="text-sm text-secondary-text">All students</span>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <p className="text-3xl font-bold">350</p>
              <p className="text-xs text-secondary-text">Total Students</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {riskDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-secondary-text">{item.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Performance Trend */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Academic Performance Trend</h3>
          <select className="px-3 py-1.5 border border-border rounded-lg text-sm bg-white dark:bg-dark-card">
            <option>This Session</option>
            <option>Last Session</option>
          </select>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#000"
                strokeWidth={2}
                dot={{ fill: '#000', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-left">
              <Users className="w-5 h-5 mb-2" />
              <p className="font-medium text-sm">Add Student</p>
            </button>
            <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-left">
              <GraduationCap className="w-5 h-5 mb-2" />
              <p className="font-medium text-sm">Add Staff</p>
            </button>
            <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-left">
              <CalendarDays className="w-5 h-5 mb-2" />
              <p className="font-medium text-sm">Mark Attendance</p>
            </button>
            <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-left">
              <DollarSign className="w-5 h-5 mb-2" />
              <p className="font-medium text-sm">Record Payment</p>
            </button>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[
              { text: 'Attendance marked for SS1A', time: '2 min ago', type: 'attendance' },
              { text: 'New student John Doe registered', time: '15 min ago', type: 'student' },
              { text: 'Risk alert triggered for 3 students', time: '1 hour ago', type: 'risk' },
              { text: 'Fee payment received - NGN 45,000', time: '2 hours ago', type: 'payment' },
            ].map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-xl bg-secondary-bg dark:bg-dark-card"
              >
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'risk' ? 'bg-red-500' :
                  activity.type === 'payment' ? 'bg-green-500' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.text}</p>
                  <p className="text-xs text-secondary-text">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
