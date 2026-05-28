import { motion } from 'framer-motion';
import { CalendarDays, ClipboardList, AlertTriangle, BookOpen, TrendingUp, MessageSquare, User } from 'lucide-react';
import { useAppStore } from '@/store';

export default function ParentDashboard() {
  const { user } = useAppStore();

  const children = [
    { id: 1, name: 'John Doe', class: 'SS1A', status: 'active', risk: 'medium' },
    { id: 2, name: 'Jane Doe', class: 'SS3A', status: 'active', risk: 'low' },
  ];

  const childStats = {
    attendance: { present: 45, absent: 5, late: 3 },
    averageGrade: 72,
    assignments: { completed: 12, pending: 2, total: 14 },
    behaviour: { merits: 8, demerits: 2 },
    feeStatus: 'paid',
  };

  const recentActivities = [
    { type: 'attendance', message: 'John arrived late today', time: 'Today, 8:15 AM' },
    { type: 'grade', message: 'Mathematics test scored: 75/100', time: 'Yesterday' },
    { type: 'assignment', message: 'English assignment submitted', time: '2 days ago' },
    { type: 'behaviour', message: 'Merit: Excellent class participation', time: '3 days ago' },
  ];

  const upcomingEvents = [
    { event: 'Parent-Teacher Meeting', date: 'Jan 20, 2025', time: '10:00 AM' },
    { event: 'Mid-Term Exams Begin', date: 'Feb 1, 2025', time: '9:00 AM' },
    { event: 'Sports Day', date: 'Feb 15, 2025', time: '8:00 AM' },
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
            <h1 className="text-2xl font-bold mb-2">Welcome, {user?.fullName}</h1>
            <p className="text-gray-300 dark:text-gray-600">Monitor your children's academic progress</p>
          </div>
        </div>
      </motion.div>

      {/* Children Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {children.map((child, index) => (
          <motion.div
            key={child.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center">
                <User className="w-8 h-8 text-black dark:text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{child.name}</h3>
                <p className="text-sm text-secondary-text">{child.class}</p>
              </div>
              <span className={`badge ${
                child.risk === 'low' ? 'badge-success' :
                child.risk === 'medium' ? 'badge-warning' :
                'badge-danger'
              }`}>
                {child.risk} risk
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-4 h-4 text-secondary-text" />
                  <span className="text-xs text-secondary-text">Attendance</span>
                </div>
                <p className="text-xl font-bold">87%</p>
                <div className="flex gap-1 mt-2">
                  <div className="flex-1 h-1.5 rounded-full bg-green-500" title="Present: 87%" style={{ width: '87%' }} />
                  <div className="flex-1 h-1.5 rounded-full bg-red-500" title="Absent: 10%" style={{ width: '10%' }} />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-secondary-text" />
                  <span className="text-xs text-secondary-text">Avg Grade</span>
                </div>
                <p className="text-xl font-bold">72%</p>
                <p className="text-xs text-green-600 mt-2">+5% from last term</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border dark:border-gray-800">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold">{childStats.assignments.completed}</p>
                  <p className="text-xs text-secondary-text">Submitted</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{childStats.assignments.pending}</p>
                  <p className="text-xs text-secondary-text">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{childStats.behaviour.merits}</p>
                  <p className="text-xs text-secondary-text">Merits</p>
                </div>
              </div>
              <button className="btn-secondary text-sm py-2 px-4">View Details</button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Recent Activities</h3>
          <div className="space-y-3">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  activity.type === 'attendance' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  activity.type === 'grade' ? 'bg-green-100 dark:bg-green-900/30' :
                  activity.type === 'assignment' ? 'bg-purple-100 dark:bg-purple-900/30' :
                  'bg-yellow-100 dark:bg-yellow-900/30'
                }`}>
                  {activity.type === 'attendance' && <CalendarDays className="w-4 h-4 text-blue-600" />}
                  {activity.type === 'grade' && <ClipboardList className="w-4 h-4 text-green-600" />}
                  {activity.type === 'assignment' && <BookOpen className="w-4 h-4 text-purple-600" />}
                  {activity.type === 'behaviour' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.message}</p>
                  <p className="text-xs text-secondary-text">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Upcoming Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Upcoming Events</h3>
          <div className="space-y-3">
            {upcomingEvents.map((event, index) => (
              <div key={index} className="flex items-center gap-4 p-3 rounded-xl border border-border dark:border-gray-800">
                <div className="w-12 h-12 rounded-lg bg-secondary-bg dark:bg-dark-card flex flex-col items-center justify-center">
                  <span className="text-xs font-medium">{event.date.split(' ')[1]}</span>
                  <span className="text-lg font-bold">{event.date.split(' ')[0].replace(',', '')}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{event.event}</p>
                  <p className="text-sm text-secondary-text">{event.time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Teacher Messages / Announcements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Messages from School</h3>
          <button className="text-sm text-black dark:text-white hover:underline">View All</button>
        </div>
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-border dark:border-gray-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium">Class Teacher (SS1A)</p>
                  <span className="text-xs text-secondary-text">Today</span>
                </div>
                <p className="text-sm text-secondary-text">
                  Please remind John to submit his Mathematics assignment tomorrow. He is doing well in class but needs to improve on timely submissions.
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border dark:border-gray-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium">School Administration</p>
                  <span className="text-xs text-secondary-text">2 days ago</span>
                </div>
                <p className="text-sm text-secondary-text">
                  Parent-Teacher Conference scheduled for January 20th. Please confirm your attendance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
