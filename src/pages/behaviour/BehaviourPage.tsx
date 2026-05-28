import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, TrendingUp, TrendingDown, AlertTriangle, Award, Search, Filter } from 'lucide-react';

export default function BehaviourPage() {
  const [showAddModal, setShowAddModal] = useState(false);

  const mockRecords = [
    { id: '1', student: 'John Doe', class: 'SS1A', type: 'merit', category: 'Class Participation', description: 'Excellent participation in group discussion', points: 5, date: 'Jan 25, 2025' },
    { id: '2', student: 'Jane Smith', class: 'SS2A', type: 'demerit', category: 'Discipline', description: 'Late submission of assignment', points: -2, date: 'Jan 24, 2025' },
    { id: '3', student: 'Emeka Brown', class: 'SS1A', type: 'commendation', category: 'Academic Excellence', description: 'Top performer in Mathematics test', points: 10, date: 'Jan 23, 2025' },
    { id: '4', student: 'Chioma Okonkwo', class: 'SS3A', type: 'warning', category: 'Attendance', description: 'Three consecutive late coming', points: -1, date: 'Jan 22, 2025' },
  ];

  const stats = {
    merits: 128,
    demerits: 45,
    commendations: 12,
    warnings: 23,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Behaviour Records</h1>
          <p className="text-secondary-text">Track merits, demerits, and behaviour incidents</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Record
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.merits}</p>
              <p className="text-xs text-secondary-text">Merits</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.demerits}</p>
              <p className="text-xs text-secondary-text">Demerits</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.commendations}</p>
              <p className="text-xs text-secondary-text">Commendations</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.warnings}</p>
              <p className="text-xs text-secondary-text">Warnings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
            <input className="input-field pl-10" placeholder="Search students..." />
          </div>
          <select className="input-field w-full md:w-40">
            <option value="">All Types</option>
            <option value="merit">Merits</option>
            <option value="demerit">Demerits</option>
            <option value="warning">Warnings</option>
            <option value="commendation">Commendations</option>
          </select>
        </div>
      </div>

      {/* Records List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left rounded-l-lg">Date</th>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-center">Points</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockRecords.map((record) => (
                <tr key={record.id} className="table-row">
                  <td className="px-4 py-3 text-sm">{record.date}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{record.student}</span>
                    <span className="text-xs text-secondary-text ml-2">{record.class}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      record.type === 'merit' ? 'badge-success' :
                      record.type === 'commendation' ? 'bg-yellow-100 text-yellow-800' :
                      record.type === 'warning' ? 'badge-warning' :
                      'badge-danger'
                    }`}>
                      {record.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{record.category}</td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate">{record.description}</td>
                  <td className="px-4 py-3 text-center font-medium">
                    <span className={record.points > 0 ? 'text-green-600' : 'text-red-600'}>
                      {record.points > 0 ? '+' : ''}{record.points}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-sm text-black dark:text-white hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <h2 className="text-xl font-bold">Add Behaviour Record</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label mb-1.5 block">Student</label>
                <input className="input-field" placeholder="Search student..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Type</label>
                  <select className="input-field">
                    <option value="merit">Merit</option>
                    <option value="demerit">Demerit</option>
                    <option value="warning">Warning</option>
                    <option value="commendation">Commendation</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Category</label>
                  <select className="input-field">
                    <option>Class Participation</option>
                    <option>Discipline</option>
                    <option>Academic Excellence</option>
                    <option>Attendance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label mb-1.5 block">Description</label>
                <textarea className="input-field min-h-24" placeholder="Details of the incident..." />
              </div>
              <div>
                <label className="label mb-1.5 block">Points</label>
                <input type="number" className="input-field" placeholder="Positive or negative points" />
              </div>
            </div>
            <div className="p-6 border-t border-border dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowAddModal(false)} className="btn-primary">Save Record</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
