import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Edit2, Trash2, UserPlus } from 'lucide-react';

export default function StaffManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const mockStaff = [
    { id: '1', staff_id: 'TCH0001', full_name: 'Dr. Adebayo Johnson', email: 'adebayo@school.com', phone: '08012345678', role: 'teacher', department: 'Mathematics', is_active: true },
    { id: '2', staff_id: 'PRN0001', full_name: 'Prof. Chioma Okonkwo', email: 'chioma@school.com', phone: '08023456789', role: 'principal', department: 'Administration', is_active: true },
    { id: '3', staff_id: 'CNS0001', full_name: 'Mrs. Fatima Ibrahim', email: 'fatima@school.com', phone: '08034567890', role: 'counselor', department: 'Guidance', is_active: true },
    { id: '4', staff_id: 'FIN0001', full_name: 'Mr. Emeka Obi', email: 'emeka@school.com', phone: '08045678901', role: 'finance', department: 'Finance', is_active: true },
    { id: '5', staff_id: 'TCH0002', full_name: 'Mrs. Grace Nwosu', email: 'grace@school.com', phone: '08056789012', role: 'teacher', department: 'English', is_active: true },
  ];

  const filteredStaff = mockStaff.filter((staff) =>
    `${staff.full_name} ${staff.staff_id} ${staff.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'badge-info';
      case 'principal': return 'badge-warning';
      case 'teacher': return 'badge-success';
      case 'counselor': return 'badge-info';
      case 'finance': return 'badge-warning';
      default: return 'badge-info';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-secondary-text">Manage staff accounts and roles</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
              placeholder="Search by name, ID, or email..."
            />
          </div>
          <select className="input-field w-full md:w-48">
            <option value="">All Roles</option>
            <option value="teacher">Teachers</option>
            <option value="principal">Principals</option>
            <option value="counselor">Counselors</option>
            <option value="finance">Finance</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((staff, index) => (
            <motion.div
              key={staff.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card-hover"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center font-bold text-lg">
                  {staff.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{staff.full_name}</h3>
                    <span className={`badge ${getRoleBadge(staff.role)}`}>{staff.role}</span>
                  </div>
                  <p className="text-xs text-secondary-text font-mono mt-1">{staff.staff_id}</p>
                  <p className="text-sm text-secondary-text mt-1">{staff.department}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <button className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <h2 className="text-xl font-bold">Add New Staff</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label mb-1.5 block">Full Name</label>
                  <input className="input-field" placeholder="Enter full name" />
                </div>
                <div>
                  <label className="label mb-1.5 block">Email</label>
                  <input type="email" className="input-field" placeholder="staff@school.com" />
                </div>
                <div>
                  <label className="label mb-1.5 block">Phone</label>
                  <input className="input-field" placeholder="08012345678" />
                </div>
                <div>
                  <label className="label mb-1.5 block">Role</label>
                  <select className="input-field">
                    <option value="teacher">Teacher</option>
                    <option value="principal">Principal</option>
                    <option value="counselor">Counselor</option>
                    <option value="finance">Finance Officer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Department</label>
                  <input className="input-field" placeholder="e.g., Mathematics" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setShowAddModal(false)} className="btn-primary">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Staff
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
