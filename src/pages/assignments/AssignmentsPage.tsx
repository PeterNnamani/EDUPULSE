import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Clock, Users, Check, FileText, ClipboardList } from 'lucide-react';

export default function AssignmentsPage() {
  const [showAddModal, setShowAddModal] = useState(false);

  const mockAssignments = [
    { id: '1', title: 'Quadratic Equations Quiz', subject: 'Mathematics', class: 'SS1A', due: 'Jan 30, 2025', submissions: 28, total: 35, status: 'active' },
    { id: '2', title: 'Essay Writing - Climate Change', subject: 'English', class: 'SS2A', due: 'Feb 1, 2025', submissions: 32, total: 32, status: 'closed' },
    { id: '3', title: 'Physics Lab Report', subject: 'Physics', class: 'SS3A', due: 'Feb 5, 2025', submissions: 15, total: 28, status: 'active' },
    { id: '4', title: 'Chemistry Balancing Equations', subject: 'Chemistry', class: 'SS2B', due: 'Feb 8, 2025', submissions: 0, total: 30, status: 'upcoming' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-secondary-text">Create and manage assignments</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Assignment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Assignments', value: 24, icon: ClipboardList },
          { label: 'Active', value: 8, icon: Clock },
          { label: 'Pending Reviews', value: 12, icon: Users },
          { label: 'Completed', value: 4, icon: Check },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-secondary-bg dark:bg-dark-card">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="stat-value text-xl">{stat.value}</p>
                  <p className="text-xs text-secondary-text">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Assignments List */}
      <div className="space-y-4">
        {mockAssignments.map((assignment, index) => (
          <motion.div
            key={assignment.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="card"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{assignment.title}</h3>
                  <p className="text-sm text-secondary-text">{assignment.subject} • {assignment.class}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs text-secondary-text">
                      <Calendar className="w-3 h-3" />
                      Due: {assignment.due}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-secondary-text">
                      <Users className="w-3 h-3" />
                      {assignment.submissions}/{assignment.total} submitted
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${
                  assignment.status === 'active' ? 'badge-success' :
                  assignment.status === 'closed' ? 'badge-info' :
                  'badge-warning'
                }`}>
                  {assignment.status}
                </span>
                <button className="btn-secondary text-sm py-2">View Details</button>
              </div>
            </div>

            {/* Submission Progress */}
            <div className="mt-4 pt-4 border-t border-border dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-secondary-text">Submissions</span>
                <span className="text-sm font-medium">{assignment.submissions}/{assignment.total}</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black dark:bg-white rounded-full"
                  style={{ width: `${(assignment.submissions / assignment.total) * 100}%` }}
                />
              </div>
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
              <h2 className="text-xl font-bold">Create Assignment</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label mb-1.5 block">Title</label>
                <input className="input-field" placeholder="Assignment title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Subject</label>
                  <select className="input-field">
                    <option>Mathematics</option>
                    <option>English</option>
                    <option>Physics</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Class</label>
                  <select className="input-field">
                    <option>SS1A</option>
                    <option>SS1B</option>
                    <option>SS2A</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Due Date</label>
                  <input type="date" className="input-field" />
                </div>
                <div>
                  <label className="label mb-1.5 block">Total Marks</label>
                  <input type="number" className="input-field" defaultValue={100} />
                </div>
              </div>
              <div>
                <label className="label mb-1.5 block">Description</label>
                <textarea className="input-field min-h-24" placeholder="Assignment instructions..." />
              </div>
            </div>
            <div className="p-6 border-t border-border dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowAddModal(false)} className="btn-primary">Create</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
