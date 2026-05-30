import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Edit2, Trash2, UserPlus, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '@/store';
import { createStaff, updateStaff } from '@/services/authService';
import { supabase } from '@/lib/supabase';

interface Staff {
  id: string;
  staff_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  role: string;
  department: string | null;
  is_active: boolean;
}

export default function StaffManagement() {
  const user = useAppStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'teacher',
    department: '',
  });

  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'teacher',
    department: '',
    pin: '',
  });

  const [successData, setSuccessData] = useState<{
    staffId: string;
    temporaryPin: string;
    fullName: string;
    role: string;
  } | null>(null);

  // Fetch staff list
  useEffect(() => {
    if (user?.schoolId) {
      fetchStaff();
    }
  }, [user?.schoolId]);

  const fetchStaff = async () => {
    if (!user?.schoolId) return;

    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('school_id', user.schoolId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStaffList(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) {
      alert('School ID not found');
      return;
    }

    setLoading(true);
    try {
      const response = await createStaff(
        user.schoolId,
        formData.fullName,
        formData.email || undefined,
        formData.phone,
        formData.role,
        formData.department || undefined
      );

      if (response.success && response.data) {
        setSuccessData(response.data);
        setShowAddModal(false);
        setShowSuccessModal(true);
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          role: 'teacher',
          department: '',
        });
        // Refresh staff list
        await fetchStaff();
      } else {
        alert(`Error creating staff: ${response.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create staff');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (staff: Staff) => {
    setEditingStaff(staff);
    setEditFormData({
      fullName: staff.full_name,
      email: staff.email || '',
      phone: staff.phone,
      role: staff.role,
      department: staff.department || '',
      pin: '',
    });
    setShowPin(false);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setLoading(true);
    try {
      const response = await updateStaff(
        editingStaff.id,
        editFormData.fullName,
        editFormData.email || undefined,
        editFormData.phone,
        editFormData.role,
        editFormData.pin || editingStaff.pin || '',
        editFormData.department || undefined
      );

      if (response.success) {
        setShowEditModal(false);
        setEditingStaff(null);
        setEditFormData({
          fullName: '',
          email: '',
          phone: '',
          role: 'teacher',
          department: '',
          pin: '',
        });
        // Refresh staff list
        await fetchStaff();
        alert('Staff updated successfully');
      } else {
        alert(`Error updating staff: ${response.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update staff');
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = staffList.filter((staff) =>
    `${staff.full_name} ${staff.staff_id} ${staff.email || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
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

  const copyToClipboard = (text: string, type: 'id' | 'pin') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
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

        {filteredStaff.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-secondary-text">No staff members found. Create one to get started.</p>
          </div>
        ) : (
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
                    {staff.department && <p className="text-sm text-secondary-text mt-1">{staff.department}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => handleEditClick(staff)}
                        className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
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
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="col-span-2">
                <label className="label mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="input-field"
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    placeholder="staff@school.com"
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                    placeholder="08012345678"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="teacher">Teacher</option>
                    <option value="principal">Principal</option>
                    <option value="counselor">Counselor</option>
                    <option value="finance">Finance Officer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Mathematics"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  {loading ? 'Creating...' : 'Add Staff'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <h2 className="text-xl font-bold text-green-600 dark:text-green-400">Staff Created Successfully</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                <p className="text-sm text-secondary-text mb-4">Share these credentials with the staff member:</p>

                <div className="space-y-4">
                  <div>
                    <label className="label text-xs mb-2 block">Staff ID</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white dark:bg-black/30 rounded-lg p-3 font-mono font-bold text-lg">
                        {successData.staffId}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(successData.staffId, 'id')}
                        className="p-3 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors"
                      >
                        {copiedId === successData.staffId ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs mb-2 block">Temporary PIN</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white dark:bg-black/30 rounded-lg p-3 font-mono font-bold text-lg tracking-widest">
                        {successData.temporaryPin}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(successData.temporaryPin, 'pin')}
                        className="p-3 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors"
                      >
                        {copiedPin ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-green-200 dark:border-green-800">
                    <p className="text-xs text-secondary-text">
                      <strong>Name:</strong> {successData.fullName}
                    </p>
                    <p className="text-xs text-secondary-text mt-1">
                      <strong>Role:</strong> {successData.role.charAt(0).toUpperCase() + successData.role.slice(1)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-secondary-text">
                  The staff member can log in with their Staff ID and PIN. They can change the PIN after their first login.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-border dark:border-gray-800">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="btn-primary w-full"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <h2 className="text-xl font-bold">Edit Staff: {editingStaff.full_name}</h2>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="col-span-2">
                <label className="label mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  className="input-field"
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="input-field"
                    placeholder="staff@school.com"
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Phone</label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="input-field"
                    placeholder="08012345678"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Role</label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="teacher">Teacher</option>
                    <option value="principal">Principal</option>
                    <option value="counselor">Counselor</option>
                    <option value="finance">Finance Officer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Department</label>
                  <input
                    type="text"
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Mathematics"
                  />
                </div>
              </div>

              <div className="border-t border-border dark:border-gray-800 pt-4">
                <label className="label mb-1.5 block">PIN (Leave empty to keep current)</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={editFormData.pin}
                    onChange={(e) => setEditFormData({ ...editFormData, pin: e.target.value })}
                    className="input-field flex-1"
                    placeholder="Enter new 4-digit PIN"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="p-3 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors"
                  >
                    {showPin ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-secondary-text mt-2">Current PIN: <span className="font-mono font-bold">{editingStaff.pin || 'N/A'}</span></p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingStaff(null);
                    setShowPin(false);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Edit2 className="w-4 h-4" />
                  )}
                  {loading ? 'Updating...' : 'Update Staff'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
