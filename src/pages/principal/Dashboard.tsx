import { motion } from 'framer-motion';
import { Users, GraduationCap, AlertTriangle, TrendingUp, DollarSign, BookOpen, CalendarDays, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useAppStore } from '@/store';

export default function PrincipalDashboard() {
  const { user } = useAppStore();

  const monthlyTrends = [
    { month: 'Sep', attendance: 94, performance: 68, behaviour: 85 },
    { month: 'Oct', attendance: 92, performance: 71, behaviour: 88 },
    { month: 'Nov', attendance: 90, performance: 69, behaviour: 82 },
    { month: 'Dec', attendance: 95, performance: 73, behaviour: 90 },
    { month: 'Jan', attendance: 91, performance: 76, behaviour: 87 },
    { month: 'Feb', attendance: 89, performance: 78, behaviour: 84 },
  ];

  const classRankings = [
    { class: 'SS2A', average: 78, students: 32 },
    { class: 'SS1A', average: 75, students: 35 },
    { class: 'SS3A', average: 73, students: 28 },
    { class: 'SS2B', average: 71, students: 30 },
    { class: 'SS1B', average: 68, students: 32 },
  ];

  const riskTrend = [
    { week: 'W1', high: 12, medium: 25, low: 313 },
    { week: 'W2', high: 10, medium: 28, low: 312 },
    { week: 'W3', high: 8, medium: 24, low: 318 },
    { week: 'W4', high: 7, medium: 22, low: 321 },
  ];

  const keyMetrics = [
    { label: 'Total Students', value: 350, change: '+5', icon: Users },
    { label: 'Total Staff', value: 42, change: '+2', icon: GraduationCap },
    { label: 'Attendance Rate', value: '92%', change: '+2.5%', icon: CalendarDays, trend: 'up' },
    { label: 'Avg Performance', value: '72%', change: '+4%', icon: Activity, trend: 'up' },
    { label: 'High Risk', value: 12, change: '-5', icon: AlertTriangle, trend: 'down', isAlert: true },
    { label: 'Open Cases', value: 8, change: '-2', icon: BookOpen, trend: 'down' },
  ];

  const subjectPerformance = [
    { subject: 'Mathematics', score: 72 },
    { subject: 'English', score: 78 },
    { subject: 'Physics', score: 69 },
    { subject: 'Chemistry', score: 71 },
    { subject: 'Biology', score: 75 },
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
            <h1 className="text-2xl font-bold mb-2">Principal's Overview</h1>
            <p className="text-gray-300 dark:text-gray-600">Academic session 2024/2025 • First Term</p>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold">92%</p>
              <p className="text-xs text-gray-300 dark:text-gray-600">Attendance</p>
            </div>
            <div className="w-px h-12 bg-gray-700 dark:bg-gray-300" />
            <div className="text-center">
              <p className="text-3xl font-bold">72%</p>
              <p className="text-xs text-gray-300 dark:text-gray-600">Performance</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {keyMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`card ${metric.isAlert ? 'border-yellow-200 dark:border-yellow-900' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${metric.isAlert ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-secondary-bg dark:bg-dark-card'}`}>
                  <Icon className={`w-4 h-4 ${metric.isAlert ? 'text-yellow-600 dark:text-yellow-400' : 'text-black dark:text-white'}`} />
                </div>
                <span className={`text-xs font-medium ${
                  metric.trend === 'up' ? 'text-green-600' :
                  metric.trend === 'down' ? 'text-green-600' :
                  'text-secondary-text'
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

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Performance Trends</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrends}>
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
                <Line type="monotone" dataKey="attendance" stroke="#16A34A" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="performance" stroke="#000" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="behaviour" stroke="#6B7280" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-secondary-text">Attendance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-black" />
              <span className="text-xs text-secondary-text">Performance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-xs text-secondary-text">Behaviour</span>
            </div>
          </div>
        </motion.div>

        {/* Risk Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Risk Distribution Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="week" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
                <Area type="monotone" dataKey="low" stackId="1" stroke="#22C55E" fill="#22C55E" fillOpacity={0.3} />
                <Area type="monotone" dataKey="medium" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.3} />
                <Area type="monotone" dataKey="high" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Class Rankings & Subject Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Rankings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Class Rankings</h3>
          <div className="space-y-3">
            {classRankings.map((cls, index) => (
              <div key={cls.class} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-600' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-secondary-bg text-secondary-text'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{cls.class}</p>
                  <p className="text-xs text-secondary-text">{cls.students} students</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{cls.average}%</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Subject Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Subject Performance</h3>
          <div className="space-y-3">
            {subjectPerformance.map((subject) => (
              <div key={subject.subject} className="flex items-center gap-3">
                <div className="w-24">
                  <p className="text-sm font-medium truncate">{subject.subject}</p>
                </div>
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black dark:bg-white rounded-full transition-all"
                    style={{ width: `${subject.score}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-10">{subject.score}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Recent Alerts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="font-medium text-red-700 dark:text-red-400">Critical Risk Alert</span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-300">3 students flagged for immediate intervention</p>
          </div>
          <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-700 dark:text-yellow-400">Performance Drop</span>
            </div>
            <p className="text-sm text-yellow-600 dark:text-yellow-300">SS3A shows 5% decline in Physics</p>
          </div>
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-700 dark:text-green-400">Improvement</span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-300">8 students moved from high to medium risk</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
