import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Edit2, Trash2, UserPlus, Copy, Check, Eye, EyeOff, BookOpen, X, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import { createStaff, updateStaff } from '@/services/authService';
import { notificationTriggerService } from '@/services/notificationTriggerService';
import { supabase } from '@/lib/supabase';
import { getInitialsFromName } from '@/utils/displayUtils';
import StaffTeachingAssignments from '@/components/admin/StaffTeachingAssignments';
import { buildStaffTeachingMap } from '@/utils/staffTeachingMap';

interface Staff {
  id: string;
  user_id: string | null;
  staff_id: string;
  full_name: string;
  email: string | null;
  phone: string;
  role: string;
  department: string | null;
  is_active: boolean;
  pin?: string;
}

interface Class {
  id: string;
  name: string;
  grade_level: string;
  class_teacher_id: string | null;
  class_teacher_name?: string;
}

interface Subject {
  id: string;
  name: string;
}

export default function StaffManagement() {
  const user = useAppStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAssignClassModal, setShowAssignClassModal] = useState(false);
  const [showAssignSubjectModal, setShowAssignSubjectModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [classList, setClassList] = useState<Class[]>([]);
  const [subjectList, setSubjectList] = useState<Subject[]>([]);
  const [staffSubjects, setStaffSubjects] = useState<Record<string, string[]>>({});
  const [classSubjectRows, setClassSubjectRows] = useState<
    Array<{
      teacher_id: string | null;
      class_id: string;
      subject_id: string;
      classes?: { id: string; name: string; grade_level?: string } | null;
      subjects?: { id: string; name: string } | null;
    }>
  >([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [visiblePins, setVisiblePins] = useState<Set<string>>(new Set());
  const [copiedPins, setCopiedPins] = useState<Set<string>>(new Set());
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [assigningStaff, setAssigningStaff] = useState<Staff | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [assignError, setAssignError] = useState<string>('');
  const [assignSuccess, setAssignSuccess] = useState<string>('');

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

  // Fetch staff list, classes, and assignments
  useEffect(() => {
    if (user?.schoolId) {
      fetchStaff();
      fetchClasses();
      fetchSubjects();
      fetchStaffSubjects();
      fetchClassSubjects();
    }
  }, [user?.schoolId]);

  const staffTeachingMap = useMemo(
    () =>
      buildStaffTeachingMap(
        classList,
        classSubjectRows,
        staffSubjects,
        Object.fromEntries(subjectList.map((s) => [s.id, s.name]))
      ),
    [classList, classSubjectRows, staffSubjects, subjectList]
  );

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

  const fetchClasses = async () => {
    if (!user?.schoolId) return;

    try {
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          grade_level,
          class_teacher_id,
          staff!class_teacher_id(full_name)
        `)
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const formattedClasses = (data || []).map((cls: any) => ({
        id: cls.id,
        name: cls.name,
        grade_level: cls.grade_level,
        class_teacher_id: cls.class_teacher_id,
        class_teacher_name: cls.staff?.full_name,
      }));

      setClassList(formattedClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchSubjects = async () => {
    if (!user?.schoolId) return;

    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSubjectList(data || []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const fetchClassSubjects = async () => {
    if (!user?.schoolId) return;

    try {
      const { data, error } = await supabase
        .from('class_subjects')
        .select(
          'teacher_id, class_id, subject_id, classes(id, name, grade_level), subjects(id, name)'
        )
        .eq('school_id', user.schoolId);

      if (error) throw error;
      setClassSubjectRows((data as typeof classSubjectRows) || []);
    } catch (error) {
      console.error('Error fetching class subjects:', error);
      setClassSubjectRows([]);
    }
  };

  const fetchStaffSubjects = async () => {
    if (!user?.schoolId) return;

    try {
      const { data, error } = await supabase
        .from('staff_subjects')
        .select('staff_id, subject_id')
        .eq('school_id', user.schoolId);

      if (error) throw error;

      const mapping: Record<string, string[]> = {};
      (data || []).forEach((record: any) => {
        if (!mapping[record.staff_id]) {
          mapping[record.staff_id] = [];
        }
        mapping[record.staff_id].push(record.subject_id);
      });

      setStaffSubjects(mapping);
    } catch (error) {
      console.error('Error fetching staff subjects:', error);
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

  const handleAssignClassClick = async (staff: Staff) => {
    setAssigningStaff(staff);
    setSelectedClasses(new Set());
    setAssignError('');
    setAssignSuccess('');
    await fetchClasses();
    setShowAssignClassModal(true);
  };

  const handleAssignSubjectClick = async (staff: Staff) => {
    setAssigningStaff(staff);
    setSelectedSubjects(new Set(staffSubjects[staff.id] || []));
    setAssignError('');
    setAssignSuccess('');
    await fetchSubjects();
    setShowAssignSubjectModal(true);
  };

  const handleAssignClasses = async () => {
    if (!assigningStaff || !user?.schoolId) return;

    if (selectedClasses.size === 0) {
      setAssignError('Please select at least one class');
      return;
    }

    setLoading(true);
    setAssignError('');

    try {
      // First, unassign any other staff from the selected classes
      await supabase
        .from('classes')
        .update({ class_teacher_id: null })
        .eq('school_id', user.schoolId)
        .in('id', Array.from(selectedClasses));

      // Then assign the selected classes to this staff
      await supabase
        .from('classes')
        .update({ class_teacher_id: assigningStaff.id })
        .in('id', Array.from(selectedClasses));

      // Trigger notifications for each assigned class (if user_id exists)
      if (assigningStaff.user_id) {
        for (const classId of selectedClasses) {
          const classData = classList.find(c => c.id === classId);
          if (classData) {
            try {
              await notificationTriggerService.onTeacherClassAssignment(
                user.schoolId,
                assigningStaff.user_id,
                assigningStaff.full_name,
                classData.name,
                classId
              );
            } catch (notifError) {
              console.error('[STAFF_MANAGEMENT] Error triggering notification:', notifError);
              // Don't fail the assignment if notification fails
            }
          }
        }
      }

      setAssignSuccess(`Successfully assigned ${selectedClasses.size} class(es) to ${assigningStaff.full_name}`);

      setTimeout(() => {
        setShowAssignClassModal(false);
        setAssigningStaff(null);
        setSelectedClasses(new Set());
        fetchStaff();
        fetchClasses();
        fetchClassSubjects();
      }, 1500);
    } catch (error) {
      console.error('Error assigning classes:', error);
      setAssignError('Failed to assign classes');
    } finally {
      setLoading(false);
    }
  };

  const toggleClassSelection = (classId: string) => {
    const newSet = new Set(selectedClasses);
    if (newSet.has(classId)) {
      newSet.delete(classId);
    } else {
      newSet.add(classId);
    }
    setSelectedClasses(newSet);
  };

  const toggleSubjectSelection = (subjectId: string) => {
    const newSet = new Set(selectedSubjects);
    if (newSet.has(subjectId)) {
      newSet.delete(subjectId);
    } else {
      newSet.add(subjectId);
    }
    setSelectedSubjects(newSet);
  };

  const handleAssignSubjects = async () => {
    if (!assigningStaff || !user?.schoolId) return;

    setLoading(true);
    setAssignError('');

    try {
      // Delete all existing subject assignments for this staff
      const { error: deleteError } = await supabase
        .from('staff_subjects')
        .delete()
        .eq('staff_id', assigningStaff.id);

      if (deleteError) throw deleteError;

      // Add new subject assignments
      if (selectedSubjects.size > 0) {
        const assignments = Array.from(selectedSubjects).map((subjectId) => ({
          school_id: user.schoolId,
          staff_id: assigningStaff.id,
          subject_id: subjectId,
        }));

        const { error } = await supabase
          .from('staff_subjects')
          .insert(assignments);

        if (error) throw error;

        // Trigger notification for subject assignments (if user_id exists)
        if (assigningStaff.user_id) {
          try {
            const subjectNames = Array.from(selectedSubjects)
              .map(subjectId => subjectList.find(s => s.id === subjectId)?.name)
              .filter(Boolean)
              .join(', ');

            if (subjectNames) {
              await notificationTriggerService.onTeacherClassAssignment(
                user.schoolId,
                assigningStaff.user_id,
                assigningStaff.full_name,
                `Subjects: ${subjectNames}`,
                '' // No specific class ID for subjects
              );
            }
          } catch (notifError) {
            console.error('[STAFF_MANAGEMENT] Error triggering subject notification:', notifError);
            // Don't fail the assignment if notification fails
          }
        }
      }

      setAssignSuccess(`Successfully assigned ${selectedSubjects.size} subject(s) to ${assigningStaff.full_name}`);

      setTimeout(() => {
        setShowAssignSubjectModal(false);
        setAssigningStaff(null);
        setSelectedSubjects(new Set());
        fetchStaffSubjects();
        fetchClassSubjects();
      }, 1500);
    } catch (error: any) {
      console.error('Error assigning subjects:', error);
      setAssignError(error?.message || 'Failed to assign subjects. Ensure the staff_subjects table exists in Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = staffList.filter((staff) =>
    staff.role !== 'admin' && // Hide admins from list
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

  const togglePinVisibility = (staffId: string) => {
    const newSet = new Set(visiblePins);
    if (newSet.has(staffId)) {
      newSet.delete(staffId);
    } else {
      newSet.add(staffId);
    }
    setVisiblePins(newSet);
  };

  const copyStaffPin = (staffId: string, pin: string) => {
    navigator.clipboard.writeText(pin);
    const newSet = new Set(copiedPins);
    newSet.add(staffId);
    setCopiedPins(newSet);
    setTimeout(() => {
      setCopiedPins(prev => {
        const updated = new Set(prev);
        updated.delete(staffId);
        return updated;
      });
    }, 2000);
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
                  className="card-hover flex flex-col"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center font-bold text-lg shrink-0">
                      {getInitialsFromName(staff.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold truncate">{staff.full_name}</h3>
                        <span className={`badge shrink-0 ${getRoleBadge(staff.role)}`}>{staff.role}</span>
                      </div>
                      <p className="text-xs text-secondary-text font-mono mt-1">{staff.staff_id}</p>
                      {staff.department && <p className="text-sm text-secondary-text mt-1">{staff.department}</p>}

                      {staff.pin && (
                        <div className="mt-1 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex-1 bg-white dark:bg-dark-elevated/60 rounded px-1.5 py-0.5 font-mono font-bold text-xs tracking-wider">
                              {visiblePins.has(staff.id) ? staff.pin : '••••••'}
                            </div>
                            <button
                              onClick={() => togglePinVisibility(staff.id)}
                              className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded transition-colors"
                              title={visiblePins.has(staff.id) ? 'Hide' : 'Show'}
                            >
                              {visiblePins.has(staff.id) ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={() => copyStaffPin(staff.id, staff.pin!)}
                              className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded transition-colors"
                              title="Copy"
                            >
                              {copiedPins.has(staff.id) ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {staff.role === 'teacher' && (
                        <StaffTeachingAssignments profile={staffTeachingMap[staff.id]} />
                      )}

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleEditClick(staff)}
                          className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {staff.role === 'teacher' && (
                          <>
                            <button
                              onClick={() => handleAssignClassClick(staff)}
                              className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors"
                              title="Assign Classes"
                            >
                              <BookOpen className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAssignSubjectClick(staff)}
                              className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors"
                              title="Assign Subjects"
                            >
                              <Filter className="w-4 h-4" />
                            </button>
                          </>
                        )}
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
                      <div className="flex-1 bg-white dark:bg-dark-elevated/60 rounded-lg p-3 font-mono font-bold text-lg">
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
                      <div className="flex-1 bg-white dark:bg-dark-elevated/60 rounded-lg p-3 font-mono font-bold text-lg tracking-widest">
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
              <div>
                <label className="label mb-1.5 block flex items-center gap-2">
                  New PIN (Leave blank to keep current)
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="p-1 hover:bg-secondary-bg rounded"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  value={editFormData.pin}
                  onChange={(e) => setEditFormData({ ...editFormData, pin: e.target.value })}
                  className="input-field"
                  placeholder="••••••"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingStaff(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Assign Classes Modal */}
      {showAssignClassModal && assigningStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Assign Classes to {assigningStaff.full_name}</h2>
                <p className="text-sm text-secondary-text mt-1">
                  Sets this teacher as <strong>Class Teacher</strong> (form teacher). Use Assign Subjects for subject-only teaching in shared classes.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignClassModal(false);
                  setAssigningStaff(null);
                }}
                className="p-1 hover:bg-secondary-bg rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {assignError && (
                <div className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 dark:text-red-200 text-sm">{assignError}</p>
                  </div>
                </div>
              )}

              {assignSuccess && (
                <div className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-green-800 dark:text-green-200 text-sm">{assignSuccess}</p>
                  </div>
                </div>
              )}

              {classList.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-secondary-text">No classes available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                  {classList.map((cls) => (
                    <div
                      key={cls.id}
                      onClick={() => toggleClassSelection(cls.id)}
                      className={`p-2 rounded-lg border-2 cursor-pointer transition-colors ${selectedClasses.has(cls.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border dark:border-gray-700 hover:border-blue-300'
                        }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${selectedClasses.has(cls.id)
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300 dark:border-gray-600'
                          }`}>
                          {selectedClasses.has(cls.id) && (
                            <Check className="w-2.5 h-2.5 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs truncate">{cls.name}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-sm text-secondary-text pt-2">
                {selectedClasses.size > 0 && `${selectedClasses.size} class(es) selected`}
              </div>
            </div>

            <div className="p-6 border-t border-border dark:border-gray-800 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAssignClassModal(false);
                  setAssigningStaff(null);
                  setSelectedClasses(new Set());
                }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignClasses}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || selectedClasses.size === 0}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    Assign Classes
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Assign Subjects Modal */}
      {showAssignSubjectModal && assigningStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Assign Subjects to {assigningStaff.full_name}</h2>
                <p className="text-sm text-secondary-text mt-1">
                  Subjects appear on the teacher&apos;s class card. Two teachers can teach the same class with different subjects.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignSubjectModal(false);
                  setAssigningStaff(null);
                }}
                className="p-1 hover:bg-secondary-bg rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {assignError && (
                <div className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 dark:text-red-200 text-sm">{assignError}</p>
                  </div>
                </div>
              )}

              {assignSuccess && (
                <div className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-green-800 dark:text-green-200 text-sm">{assignSuccess}</p>
                  </div>
                </div>
              )}

              {subjectList.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-secondary-text">No subjects available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {subjectList.map((subject) => (
                    <div
                      key={subject.id}
                      onClick={() => toggleSubjectSelection(subject.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${selectedSubjects.has(subject.id)
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-border dark:border-gray-700 hover:border-purple-300'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${selectedSubjects.has(subject.id)
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-300 dark:border-gray-600'
                          }`}>
                          {selectedSubjects.has(subject.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{subject.name}</h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-sm text-secondary-text pt-2">
                {selectedSubjects.size > 0 && `${selectedSubjects.size} subject(s) selected`}
              </div>
            </div>

            <div className="p-6 border-t border-border dark:border-gray-800 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAssignSubjectModal(false);
                  setAssigningStaff(null);
                  setSelectedSubjects(new Set());
                }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubjects}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    Assign Subjects
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
