import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, MoreVertical, Edit2, Trash2, UserPlus, Download, Upload } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import type { Student } from '@/lib/supabase';

export default function StudentManagement() {
  const { user } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Mock students for demo
  const mockStudents = [
    { id: '1', student_id: 'STU000001', first_name: 'John', last_name: 'Doe', middle_name: 'Michael', class_id: 'SS1A', gender: 'male', status: 'active' },
    { id: '2', student_id: 'STU000002', first_name: 'Jane', last_name: 'Smith', middle_name: '', class_id: 'SS1A', gender: 'female', status: 'active' },
    { id: '3', student_id: 'STU000003', first_name: 'Emeka', last_name: 'Brown', middle_name: 'James', class_id: 'SS2A', gender: 'male', status: 'active' },
    { id: '4', student_id: 'STU000004', first_name: 'Chioma', last_name: 'Okonkwo', middle_name: '', class_id: 'SS2A', gender: 'female', status: 'active' },
    { id: '5', student_id: 'STU000005', first_name: 'Ahmed', last_name: 'Muhammad', middle_name: 'Yusuf', class_id: 'SS3A', gender: 'male', status: 'active' },
  ];

  const classes = ['SS1A', 'SS1B', 'SS2A', 'SS2B', 'SS3A', 'SS3B'];
  const statuses = ['active', 'graduated', 'withdrawn', 'suspended'];

  const filteredStudents = mockStudents.filter((student) => {
    const matchesSearch = `${student.first_name} ${student.last_name} ${student.student_id}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesClass = !selectedClass || student.class_id === selectedClass;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-secondary-text">Manage student records and information</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
              placeholder="Search by name or student ID..."
            />
          </div>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input-field w-full md:w-48"
          >
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
          <button className="btn-secondary flex items-center gap-2">
            <Filter className="w-4 h-4" />
            More Filters
          </button>
        </div>
      </div>

      {/* Students Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left rounded-l-lg">
                  <input type="checkbox" className="w-4 h-4 rounded" />
                </th>
                <th className="px-4 py-3 text-left">Student ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Class</th>
                <th className="px-4 py-3 text-left">Gender</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, index) => (
                <motion.tr
                  key={student.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="table-row"
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="w-4 h-4 rounded" />
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{student.student_id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center font-medium">
                        {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{student.first_name} {student.last_name}</p>
                        {student.middle_name && (
                          <p className="text-xs text-secondary-text">{student.middle_name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge badge-info">{student.class_id}</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{student.gender}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      student.status === 'active' ? 'badge-success' :
                      student.status === 'graduated' ? 'badge-info' :
                      'badge-danger'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border dark:border-gray-800">
          <p className="text-sm text-secondary-text">
            Showing {filteredStudents.length} of {mockStudents.length} students
          </p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors">
              Previous
            </button>
            <button className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm">
              1
            </button>
            <button className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors">
              2
            </button>
            <button className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors">
              Next
            </button>
          </div>
        </div>
      </motion.div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Add New Student</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">First Name</label>
                  <input className="input-field" placeholder="Enter first name" />
                </div>
                <div>
                  <label className="label mb-1.5 block">Last Name</label>
                  <input className="input-field" placeholder="Enter last name" />
                </div>
                <div>
                  <label className="label mb-1.5 block">Middle Name</label>
                  <input className="input-field" placeholder="Enter middle name (optional)" />
                </div>
                <div>
                  <label className="label mb-1.5 block">Gender</label>
                  <select className="input-field">
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Date of Birth</label>
                  <input type="date" className="input-field" />
                </div>
                <div>
                  <label className="label mb-1.5 block">Class</label>
                  <select className="input-field">
                    <option value="">Select class</option>
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Admission Number</label>
                  <input className="input-field" placeholder="Enter admission number" />
                </div>
                <div>
                  <label className="label mb-1.5 block">State of Origin</label>
                  <select className="input-field">
                    <option value="">Select state</option>
                    <option value="Lagos">Lagos</option>
                    <option value="Oyo">Oyo</option>
                    {/* Add other states */}
                  </select>
                </div>
              </div>

              <div>
                <label className="label mb-2 block">Parent/Guardian Information</label>
                <div className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card border border-border dark:border-gray-800 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1 block text-xs">Father's Name</label>
                      <input className="input-field text-sm" placeholder="Enter name" />
                    </div>
                    <div>
                      <label className="label mb-1 block text-xs">Father's Phone</label>
                      <input className="input-field text-sm" placeholder="08012345678" />
                    </div>
                    <div>
                      <label className="label mb-1 block text-xs">Mother's Name</label>
                      <input className="input-field text-sm" placeholder="Enter name" />
                    </div>
                    <div>
                      <label className="label mb-1 block text-xs">Mother's Phone</label>
                      <input className="input-field text-sm" placeholder="08012345678" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border dark:border-gray-800 flex items-center justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={() => setShowAddModal(false)} className="btn-primary">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Student
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
