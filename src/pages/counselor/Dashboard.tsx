import { motion } from 'framer-motion';
import { AlertTriangle, Users, Calendar, MessageSquare, CheckCircle, Clock, UserX, FileText } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '@/store';

export default function CounselorDashboard() {
  const { user } = useAppStore();

  const [selectedCase, setSelectedCase] = useState<string | null>(null);

  const openCases = [
    { id: 1, student: 'John Doe', class: 'SS1A', risk: 'critical', type: 'Academic', daysOpen: 12, lastContact: '2 days ago' },
    { id: 2, student: 'Jane Smith', class: 'SS2A', risk: 'high', type: 'Attendance', daysOpen: 8, lastContact: 'Today' },
    { id: 3, student: 'Mike Johnson', class: 'SS1B', risk: 'high', type: 'Behaviour', daysOpen: 5, lastContact: '1 day ago' },
    { id: 4, student: 'Sarah Williams', class: 'SS3A', risk: 'medium', type: 'Academic', daysOpen: 3, lastContact: 'Today' },
  ];

  const upcomingMeetings = [
    { time: '10:00 AM', student: 'John Doe', type: 'Follow-up', duration: '30 min' },
    { time: '12:00 PM', student: 'Jane Smith', type: 'Initial Assessment', duration: '45 min' },
    { time: '02:30 PM', student: 'Mike Johnson', type: 'Parent Meeting', duration: '60 min' },
  ];

  const recentInterventions = [
    { student: 'John Doe', intervention: 'Academic Support Plan', status: 'ongoing', date: 'Jan 15' },
    { student: 'Jane Smith', intervention: 'Attendance Monitoring', status: 'ongoing', date: 'Jan 12' },
    { student: 'Emeka Brown', intervention: 'Behavioural Therapy', status: 'completed', date: 'Jan 10' },
  ];

  const riskStats = [
    { label: 'Critical Risk', value: 5, color: 'bg-red-500' },
    { label: 'High Risk', value: 12, color: 'bg-orange-500' },
    { label: 'Medium Risk', value: 28, color: 'bg-yellow-500' },
    { label: 'Low Risk', value: 305, color: 'bg-green-500' },
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
            <h1 className="text-2xl font-bold mb-2">Counselor Dashboard</h1>
            <p className="text-gray-300 dark:text-gray-600">You have {openCases.length} open cases requiring attention</p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="px-4 py-2 rounded-lg bg-white/10 dark:bg-black/10">
              <p className="text-3xl font-bold">17</p>
              <p className="text-xs opacity-70">Total Cases</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open Cases', value: 4, icon: FileText, color: 'bg-blue-100 dark:bg-blue-900/30' },
          { label: 'Critical Risk', value: 5, icon: AlertTriangle, color: 'bg-red-100 dark:bg-red-900/30', isAlert: true },
          { label: 'Meetings Today', value: 3, icon: Calendar, color: 'bg-purple-100 dark:bg-purple-900/30' },
          { label: 'Parent Contacts', value: 8, icon: MessageSquare, color: 'bg-green-100 dark:bg-green-900/30' },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`card ${stat.isAlert ? 'border-red-200 dark:border-red-900' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.color}`}>
                  <Icon className={`w-5 h-5 ${stat.isAlert ? 'text-red-600 dark:text-red-400' : 'text-black dark:text-white'}`} />
                </div>
                <div>
                  <p className="stat-label text-xs">{stat.label}</p>
                  <p className={`stat-value text-xl ${stat.isAlert ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Risk Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Risk Distribution</h3>
        <div className="space-y-3">
          {riskStats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <div className="w-32">
                <span className="text-sm font-medium">{stat.label}</span>
              </div>
              <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${stat.color} rounded-full transition-all flex items-center justify-end pr-2`}
                  style={{ width: `${(stat.value / 350) * 100}%` }}
                >
                  <span className="text-xs font-medium text-white">{stat.value}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Open Cases */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Open Cases</h3>
            <button className="text-sm text-black dark:text-white hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {openCases.map((caseItem) => (
              <div
                key={caseItem.id}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedCase === caseItem.id.toString()
                    ? 'border-black dark:border-white bg-secondary-bg dark:bg-dark-card'
                    : 'border-border dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
                }`}
                onClick={() => setSelectedCase(caseItem.id.toString())}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="font-medium">{caseItem.student.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{caseItem.student}</p>
                      <p className="text-sm text-secondary-text">{caseItem.class} • {caseItem.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${
                      caseItem.risk === 'critical' ? 'badge-danger' :
                      caseItem.risk === 'high' ? 'badge-warning' :
                      'badge-info'
                    }`}>
                      {caseItem.risk}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-secondary-text">Opened {caseItem.daysOpen} days ago</span>
                  <span className="text-secondary-text">Last contact: {caseItem.lastContact}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Upcoming Meetings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Today's Schedule</h3>
            <button className="text-sm text-black dark:text-white hover:underline">Add</button>
          </div>
          <div className="space-y-3">
            {upcomingMeetings.map((meeting, index) => (
              <div key={index} className="p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                <div className="flex items-center gap-3">
                  <div className="w-12 text-center">
                    <p className="text-sm font-medium">{meeting.time}</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{meeting.student}</p>
                    <p className="text-xs text-secondary-text">{meeting.type} • {meeting.duration}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Interventions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Recent Interventions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left rounded-l-lg">Student</th>
                <th className="px-4 py-3 text-left">Intervention</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentInterventions.map((item, index) => (
                <tr key={index} className="table-row">
                  <td className="px-4 py-3 font-medium">{item.student}</td>
                  <td className="px-4 py-3 text-secondary-text">{item.intervention}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      item.status === 'completed' ? 'badge-success' :
                      item.status === 'ongoing' ? 'badge-warning' :
                      'badge-info'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-secondary-text">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <UserX className="w-6 h-6" />
            <span className="text-sm font-medium">New Case</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <Calendar className="w-6 h-6" />
            <span className="text-sm font-medium">Schedule Meeting</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            <span className="text-sm font-medium">Contact Parent</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            <span className="text-sm font-medium">Close Case</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
