import { motion } from 'framer-motion';
import { CalendarDays, ClipboardList, Users, AlertTriangle, BookOpen, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';
import { useAppStore } from '@/store';

export default function TeacherDashboard() {
  const { user } = useAppStore();

  const todayClasses = [
    { subject: 'Mathematics', class: 'SS1A', time: '08:00 AM', students: 35 },
    { subject: 'Further Mathematics', class: 'SS2A', time: '10:00 AM', students: 28 },
    { subject: 'Mathematics', class: 'SS1B', time: '12:00 PM', students: 32 },
    { subject: 'Further Mathematics', class: 'SS2B', time: '02:00 PM', students: 25 },
  ];

  const performanceData = [
    { subject: 'SS1A', average: 72 },
    { subject: 'SS1B', average: 68 },
    { subject: 'SS2A', average: 75 },
    { subject: 'SS2B', average: 71 },
  ];

  const recentAssignments = [
    { title: 'Quadratic Equations Quiz', class: 'SS1A', due: 'Tomorrow', submissions: '28/35' },
    { title: 'Calculus Practice Test', class: 'SS2A', due: 'In 3 days', submissions: '15/28' },
    { title: 'Algebra Homework', class: 'SS1B', due: 'Completed', submissions: '32/32' },
  ];

  const riskStudents = [
    { name: 'John Doe', class: 'SS1A', risk: 'high', reason: 'Low attendance' },
    { name: 'Jane Smith', class: 'SS2A', risk: 'medium', reason: 'Declining grades' },
    { name: 'Mike Johnson', class: 'SS1B', risk: 'critical', reason: 'Multiple issues' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Good Morning, {user?.fullName?.split(' ')[0]}</h1>
            <p className="text-secondary-text">You have 4 classes scheduled today</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-secondary-text">Today</p>
              <p className="font-medium">{new Date().toLocaleDateString('en-NG', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Classes Today', value: 4, icon: BookOpen },
          { label: 'Students to Teach', value: 120, icon: Users },
          { label: 'Pending Assignments', value: 12, icon: ClipboardList },
          { label: 'Risk Alerts', value: 3, icon: AlertTriangle, isAlert: true },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`card ${stat.isAlert ? 'border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.isAlert ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-secondary-bg dark:bg-dark-card'}`}>
                  <Icon className={`w-5 h-5 ${stat.isAlert ? 'text-yellow-600 dark:text-yellow-400' : 'text-black dark:text-white'}`} />
                </div>
                <div>
                  <p className="stat-label text-xs">{stat.label}</p>
                  <p className={`stat-value text-xl ${stat.isAlert ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Today's Classes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Today's Classes</h3>
            <button className="text-sm text-black dark:text-white hover:underline">View Schedule</button>
          </div>
          <div className="space-y-3">
            {todayClasses.map((cls, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                <div className="w-12 text-center">
                  <p className="text-xs text-secondary-text">{cls.time}</p>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{cls.subject}</p>
                  <p className="text-sm text-secondary-text">{cls.class} • {cls.students} students</p>
                </div>
                <button className="p-2 rounded-lg bg-black dark:bg-white text-white dark:text-black text-sm font-medium">
                  Take Attendance
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Class Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Class Performance</h3>
            <span className="text-sm text-secondary-text">Average scores</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#6B7280" fontSize={12} />
                <YAxis dataKey="subject" type="category" stroke="#6B7280" fontSize={12} width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="average" fill="#000" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Recent Assignments & Risk Students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Assignments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Assignments</h3>
            <button className="btn-secondary text-sm py-2">Create New</button>
          </div>
          <div className="space-y-3">
            {recentAssignments.map((assignment, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-xl border border-border dark:border-gray-800">
                <div className="w-10 h-10 rounded-lg bg-secondary-bg dark:bg-dark-card flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{assignment.title}</p>
                  <p className="text-xs text-secondary-text">{assignment.class}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{assignment.submissions}</p>
                  <p className="text-xs text-secondary-text">Due {assignment.due}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Risk Students */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card border-red-200 dark:border-red-900"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Students at Risk
            </h3>
            <button className="text-sm text-red-600 hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {riskStudents.map((student, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10">
                <div className="flex-1">
                  <p className="font-medium text-sm">{student.name}</p>
                  <p className="text-xs text-secondary-text">{student.class} • {student.reason}</p>
                </div>
                <div className={`badge ${
                  student.risk === 'critical' ? 'badge-danger' :
                  student.risk === 'high' ? 'badge-warning' :
                  'badge-info'
                }`}>
                  {student.risk}
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
        transition={{ delay: 0.7 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <CalendarDays className="w-6 h-6" />
            <span className="text-sm font-medium">Take Attendance</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            <span className="text-sm font-medium">Enter Grades</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <BookOpen className="w-6 h-6" />
            <span className="text-sm font-medium">Create Assignment</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            <span className="text-sm font-medium">View Reports</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
