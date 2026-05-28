import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, User, CheckCircle, Clock, AlertTriangle, MessageSquare } from 'lucide-react';

export default function InterventionsPage() {
  const [showAddModal, setShowAddModal] = useState(false);

  const mockInterventions = [
    { id: '1', student: 'John Doe', class: 'SS1A', type: 'Academic Support', status: 'in_progress', priority: 'high', counselor: 'Mrs. Ibrahim', startDate: 'Jan 10, 2025', progress: 60 },
    { id: '2', student: 'Jane Smith', class: 'SS2A', type: 'Attendance Monitoring', status: 'open', priority: 'medium', counselor: 'Mrs. Ibrahim', startDate: 'Jan 15, 2025', progress: 20 },
    { id: '3', student: 'Emeka Brown', class: 'SS1B', type: 'Behaviour Support', status: 'in_progress', priority: 'high', counselor: 'Mrs. Ibrahim', startDate: 'Jan 12, 2025', progress: 45 },
    { id: '4', student: 'Aisha Yusuf', class: 'SS3A', type: 'Academic Support', status: 'completed', priority: 'medium', counselor: 'Mrs. Ibrahim', startDate: 'Dec 5, 2024', progress: 100 },
  ];

  const stats = {
    open: 12,
    inProgress: 8,
    completed: 28,
    escalated: 2,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return 'badge-info';
      case 'in_progress': return 'badge-warning';
      case 'completed': return 'badge-success';
      default: return 'badge-info';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Interventions</h1>
          <p className="text-secondary-text">Manage student intervention plans</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Intervention
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.open}</p>
              <p className="text-xs text-secondary-text">Open</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <User className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.inProgress}</p>
              <p className="text-xs text-secondary-text">In Progress</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.completed}</p>
              <p className="text-xs text-secondary-text">Completed</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.escalated}</p>
              <p className="text-xs text-secondary-text">Escalated</p>
            </div>
          </div>
        </div>
      </div>

      {/* Interventions List */}
      <div className="space-y-4">
        {mockInterventions.map((intervention, index) => (
          <motion.div
            key={intervention.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="card"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center font-bold">
                  {intervention.student.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{intervention.student}</h3>
                    <span className="text-xs text-secondary-text">{intervention.class}</span>
                  </div>
                  <p className="text-sm font-medium">{intervention.type}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-secondary-text">
                    <span>Counselor: {intervention.counselor}</span>
                    <span>Started: {intervention.startDate}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${intervention.priority === 'high' ? 'badge-danger' : intervention.priority === 'medium' ? 'badge-warning' : 'badge-info'}`}>
                  {intervention.priority}
                </span>
                <span className={`badge ${getStatusBadge(intervention.status)}`}>
                  {intervention.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-4 pt-4 border-t border-border dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-secondary-text">Progress</span>
                <span className="text-sm font-medium">{intervention.progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    intervention.progress === 100 ? 'bg-green-500' : 'bg-black dark:bg-white'
                  }`}
                  style={{ width: `${intervention.progress}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1 text-sm text-secondary-text hover:text-black dark:hover:text-white">
                  <MessageSquare className="w-4 h-4" />
                  Notes
                </button>
                <button className="flex items-center gap-1 text-sm text-secondary-text hover:text-black dark:hover:text-white">
                  <Calendar className="w-4 h-4" />
                  Schedule
                </button>
              </div>
              <button className="btn-secondary text-sm py-1.5">View Details</button>
            </div>
          </motion.div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <h2 className="text-xl font-bold">Create Intervention</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label mb-1.5 block">Student</label>
                <input className="input-field" placeholder="Search student..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Intervention Type</label>
                  <select className="input-field">
                    <option>Academic Support</option>
                    <option>Attendance Monitoring</option>
                    <option>Behaviour Support</option>
                    <option>Counseling</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Priority</label>
                  <select className="input-field">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label mb-1.5 block">Description</label>
                <textarea className="input-field min-h-24" placeholder="Intervention plan details..." />
              </div>
              <div>
                <label className="label mb-1.5 block">Notify Parent</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border" defaultChecked />
                  <span className="text-sm">Send notification to parent</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-border dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowAddModal(false)} className="btn-primary">Create Intervention</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
