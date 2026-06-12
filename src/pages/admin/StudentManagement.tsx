import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, MoreVertical, Edit2, Trash2, UserPlus, UserCheck, CreditCard, Download, Upload, Copy, Check } from 'lucide-react';
import { useAppStore } from '@/store';
import {
  getStudents,
  createStudentWithParent,
  updateStudent,
  STUDENT_STATUSES,
  normalizeStudentStatus,
} from '@/services/studentService';
import { getClasses } from '@/services/classService';
import VirtualAccountCard from '@/components/finance/VirtualAccountCard';
import VirtualAccountSummary from '@/components/finance/VirtualAccountSummary';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { monnifyService } from '@/services/monnifyService';
import { formatClassLabel, formatStudentFullName, getInitials } from '@/utils/displayUtils';

interface StudentForm {
  firstName: string;
  lastName: string;
  middleName: string;
  gender: string;
  dateOfBirth: string;
  classId: string;
  admissionNumber: string;
  stateOfOrigin: string;
  fatherName: string;
  fatherPhone: string;
  fatherEmail: string;
  fatherOccupation: string;
  motherName: string;
  motherPhone: string;
  motherEmail: string;
  motherOccupation: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianRelationship: string;
}

interface EditingStudent {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  middleName: string;
  gender: string;
  dateOfBirth: string;
  classId: string;
  status: string;
}

interface StatusToggleTarget {
  id: string;
  firstName: string;
  lastName: string;
  action: 'activate' | 'deactivate';
}

export default function StudentManagement() {
  const { user } = useAppStore();
  const { hasFeature, resolved: planResolved } = useFeatureAccess();
  const virtualAccountsEnabled = planResolved && hasFeature('virtual_accounts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<EditingStudent | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    id: string;
    studentId: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    virtualAccount?: {
      accountNumber: string | null;
      accountName: string | null;
      bankName: string | null;
    };
    virtualAccountError?: string;
  } | null>(null);
  const [retryingVirtualAccount, setRetryingVirtualAccount] = useState(false);
  const [copied, setCopied] = useState<'id' | 'account' | null>(null);
  const [statusToggleTarget, setStatusToggleTarget] = useState<StatusToggleTarget | null>(null);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  const [virtualAccountsByStudentId, setVirtualAccountsByStudentId] = useState<
    Record<string, { accountNumber: string; bankName: string | null }>
  >({});
  const [formData, setFormData] = useState<StudentForm>({
    firstName: '',
    lastName: '',
    middleName: '',
    gender: '',
    dateOfBirth: '',
    classId: '',
    admissionNumber: '',
    stateOfOrigin: '',
    fatherName: '',
    fatherPhone: '',
    fatherEmail: '',
    fatherOccupation: '',
    motherName: '',
    motherPhone: '',
    motherEmail: '',
    motherOccupation: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    guardianRelationship: '',
  });

  const nigerinanStates = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa',
    'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
    'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'FCT'
  ];

  const statuses = STUDENT_STATUSES;

  const classLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cls of classes) {
      map.set(cls.id, formatClassLabel(cls.grade_level, cls.section, cls.name));
    }
    return map;
  }, [classes]);

  // Load students and classes on mount; re-fetch VA index when plan feature resolves.
  useEffect(() => {
    if (user?.schoolId) {
      loadData();
    }
  }, [user?.schoolId, virtualAccountsEnabled]);

  const loadData = async (options?: { silent?: boolean }) => {
    if (!user?.schoolId) return;

    if (!options?.silent) setLoading(true);
    try {
      const schoolId = user.schoolId;
      const [studentsData, classesData, vaIndex] = await Promise.all([
        getStudents(schoolId),
        getClasses(schoolId),
        virtualAccountsEnabled
          ? monnifyService.getSchoolVirtualAccountIndex(schoolId)
          : Promise.resolve(new Map<string, { accountNumber: string; bankName: string | null }>()),
      ]);
      setStudents(studentsData);
      setClasses(classesData);
      setVirtualAccountsByStudentId(virtualAccountsEnabled ? Object.fromEntries(vaIndex) : {});
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      middleName: '',
      gender: '',
      dateOfBirth: '',
      classId: '',
      admissionNumber: '',
      stateOfOrigin: '',
      fatherName: '',
      fatherPhone: '',
      fatherEmail: '',
      fatherOccupation: '',
      motherName: '',
      motherPhone: '',
      motherEmail: '',
      motherOccupation: '',
      guardianName: '',
      guardianPhone: '',
      guardianEmail: '',
      guardianRelationship: '',
    });
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    const parentPhone =
      formData.fatherPhone.trim() ||
      formData.motherPhone.trim() ||
      formData.guardianPhone.trim();
    if (!parentPhone) {
      alert(
        'At least one parent or guardian phone number is required so parents can access the portal.'
      );
      return;
    }

    setLoading(true);
    try {
      const result = await createStudentWithParent({
        schoolId: user.schoolId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        gender: formData.gender as 'male' | 'female',
        dateOfBirth: formData.dateOfBirth || undefined,
        classId: formData.classId,
        admissionNumber: formData.admissionNumber || undefined,
        stateOfOrigin: formData.stateOfOrigin || undefined,
        fatherName: formData.fatherName || undefined,
        fatherPhone: formData.fatherPhone || undefined,
        fatherEmail: formData.fatherEmail || undefined,
        fatherOccupation: formData.fatherOccupation || undefined,
        motherName: formData.motherName || undefined,
        motherPhone: formData.motherPhone || undefined,
        motherEmail: formData.motherEmail || undefined,
        motherOccupation: formData.motherOccupation || undefined,
        guardianName: formData.guardianName || undefined,
        guardianPhone: formData.guardianPhone || undefined,
        guardianEmail: formData.guardianEmail || undefined,
        guardianRelationship: formData.guardianRelationship || undefined,
      });

      if (result.success && result.data) {
        setCopied(null);
        setSuccessData({
          id: result.data.id,
          studentId: result.data.studentId,
          firstName: result.data.firstName,
          middleName: formData.middleName || undefined,
          lastName: result.data.lastName,
          virtualAccount: result.data.virtualAccount,
          virtualAccountError: result.data.virtualAccountError,
        });
        setShowSuccessModal(true);
        setShowAddModal(false);
        resetForm();
        await loadData();
      } else {
        alert(result.error || 'Failed to create student');
      }
    } catch (error) {
      console.error('Error creating student:', error);
      alert('Error creating student. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || savingEdit) return;

    setSavingEdit(true);
    try {
      const result = await updateStudent(editingStudent.id, {
        firstName: editingStudent.firstName,
        lastName: editingStudent.lastName,
        middleName: editingStudent.middleName,
        gender: editingStudent.gender,
        dateOfBirth: editingStudent.dateOfBirth,
        classId: editingStudent.classId,
        status: editingStudent.status,
      });

      if (result.success) {
        const normalizedStatus =
          normalizeStudentStatus(editingStudent.status) ?? editingStudent.status;
        setStudents((prev) =>
          prev.map((s) =>
            s.id === editingStudent.id
              ? {
                  ...s,
                  first_name: editingStudent.firstName,
                  last_name: editingStudent.lastName,
                  middle_name: editingStudent.middleName || null,
                  gender: editingStudent.gender,
                  date_of_birth: editingStudent.dateOfBirth || null,
                  class_id: editingStudent.classId,
                  status: normalizedStatus,
                }
              : s
          )
        );
        setShowEditModal(false);
        setEditingStudent(null);
        void loadData({ silent: true });
      } else {
        alert(result.error || 'Failed to update student');
      }
    } catch (error) {
      console.error('Error updating student:', error);
      alert('Error updating student. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const getStudentActivationAction = (
    status: string
  ): 'activate' | 'deactivate' | null => {
    const normalized = normalizeStudentStatus(status);
    if (normalized === 'active') return 'deactivate';
    if (normalized === 'withdrawn' || normalized === 'suspended') return 'activate';
    return null;
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusToggleTarget) return;

    const newStatus = statusToggleTarget.action === 'deactivate' ? 'withdrawn' : 'active';
    setTogglingStatusId(statusToggleTarget.id);
    try {
      const result = await updateStudent(statusToggleTarget.id, { status: newStatus });
      if (!result.success) {
        alert(result.error || `Failed to ${statusToggleTarget.action} student`);
        return;
      }
      setStudents((prev) =>
        prev.map((s) => (s.id === statusToggleTarget.id ? { ...s, status: newStatus } : s))
      );
      setStatusToggleTarget(null);
      void loadData({ silent: true });
    } catch (error) {
      console.error('Error toggling student status:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setTogglingStatusId(null);
    }
  };

  const openEditModal = (student: any) => {
    setEditingStudent({
      id: student.id,
      studentId: student.student_id,
      firstName: student.first_name,
      lastName: student.last_name,
      middleName: student.middle_name || '',
      gender: student.gender,
      dateOfBirth: student.date_of_birth || '',
      classId: student.class_id,
      status: normalizeStudentStatus(student.status) ?? 'active',
    });
    setShowEditModal(true);
  };

  const copyToClipboard = (text: string, field: 'id' | 'account') => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredStudents = students.filter((student) => {
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
          <button
            type="button"
            className="btn-secondary flex items-center gap-2 opacity-50 cursor-not-allowed"
            disabled
            title="Bulk import coming soon"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-2 opacity-50 cursor-not-allowed"
            disabled
            title="Bulk export coming soon"
          >
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
              <option key={cls.id} value={cls.id}>
                {formatClassLabel(cls.grade_level, cls.section, cls.name)}
              </option>
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
                {virtualAccountsEnabled && (
                  <th className="px-4 py-3 text-left" title="Virtual payment account">
                    Account
                  </th>
                )}
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
                        {getInitials(student.first_name, student.last_name)}
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
                    <span className="badge badge-info">
                      {student.class_id
                        ? classLabelById.get(student.class_id) ?? '—'
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">{student.gender}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        student.status === 'active'
                          ? 'badge-success'
                          : student.status === 'graduated'
                            ? 'badge-info'
                            : student.status === 'withdrawn' || student.status === 'suspended'
                              ? 'badge-danger'
                              : 'badge-info'
                      }`}
                    >
                      {normalizeStudentStatus(student.status) ?? student.status}
                    </span>
                  </td>
                  {virtualAccountsEnabled && (
                    <td className="px-4 py-3">
                      {virtualAccountsByStudentId[student.id] ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-medium"
                          title={[
                            virtualAccountsByStudentId[student.id].bankName ?? 'Virtual account',
                            virtualAccountsByStudentId[student.id].accountNumber,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        >
                          <CreditCard className="w-3.5 h-3.5 shrink-0" />
                          <span className="hidden sm:inline">Virtual</span>
                        </span>
                      ) : (
                        <span className="text-xs text-secondary-text">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(student)}
                        className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      {(() => {
                        const activationAction = getStudentActivationAction(student.status);
                        if (!activationAction) return null;
                        const isDeactivating = activationAction === 'deactivate';
                        const isBusy = togglingStatusId === student.id;
                        return (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              setStatusToggleTarget({
                                id: student.id,
                                firstName: student.first_name,
                                lastName: student.last_name,
                                action: activationAction,
                              })
                            }
                            className={`btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1 disabled:opacity-50 ${
                              isDeactivating
                                ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                                : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                            }`}
                          >
                            {isDeactivating ? (
                              <Trash2 className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                            {isBusy
                              ? isDeactivating
                                ? 'Deactivating…'
                                : 'Activating…'
                              : isDeactivating
                                ? 'Deactivate'
                                : 'Activate'}
                          </button>
                        );
                      })()}
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
            Showing {filteredStudents.length} of {students.length} students
          </p>
        </div>
      </motion.div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl overflow-hidden"
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
            <form onSubmit={handleAddStudent} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Student Info */}
              <div>
                <h3 className="text-sm font-semibold mb-4">Student Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label mb-1.5 block">First Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="input-field"
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="input-field"
                      placeholder="Enter last name"
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Middle Name</label>
                    <input
                      type="text"
                      value={formData.middleName}
                      onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                      className="input-field"
                      placeholder="Enter middle name"
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Gender *</label>
                    <select
                      required
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Class *</label>
                    <select
                      required
                      value={formData.classId}
                      onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Select class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {formatClassLabel(cls.grade_level, cls.section, cls.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Admission Number</label>
                    <input
                      type="text"
                      value={formData.admissionNumber}
                      onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                      className="input-field"
                      placeholder="Enter admission number"
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">State of Origin</label>
                    <select
                      value={formData.stateOfOrigin}
                      onChange={(e) => setFormData({ ...formData, stateOfOrigin: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Select state</option>
                      {nigerinanStates.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Parent Information */}
              <div className="border-t border-border dark:border-gray-800 pt-6">
                <h3 className="text-sm font-semibold mb-4">Parent/Guardian Information</h3>
                <div className="space-y-6">
                  {/* Father */}
                  <div>
                    <h4 className="text-xs font-semibold text-secondary-text mb-3 uppercase">Father</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label mb-1.5 block text-xs">Father's Name</label>
                        <input
                          type="text"
                          value={formData.fatherName}
                          onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                          className="input-field text-sm"
                          placeholder="Enter name"
                        />
                      </div>
                      <div>
                        <label className="label mb-1.5 block text-xs">Phone</label>
                        <input
                          type="tel"
                          value={formData.fatherPhone}
                          onChange={(e) => setFormData({ ...formData, fatherPhone: e.target.value })}
                          className="input-field text-sm"
                          placeholder="08012345678"
                        />
                      </div>
                      <div>
                        <label className="label mb-1.5 block text-xs">Email</label>
                        <input
                          type="email"
                          value={formData.fatherEmail}
                          onChange={(e) => setFormData({ ...formData, fatherEmail: e.target.value })}
                          className="input-field text-sm"
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <label className="label mb-1.5 block text-xs">Occupation</label>
                        <input
                          type="text"
                          value={formData.fatherOccupation}
                          onChange={(e) => setFormData({ ...formData, fatherOccupation: e.target.value })}
                          className="input-field text-sm"
                          placeholder="Occupation"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mother */}
                  <div>
                    <h4 className="text-xs font-semibold text-secondary-text mb-3 uppercase">Mother</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label mb-1.5 block text-xs">Mother's Name</label>
                        <input
                          type="text"
                          value={formData.motherName}
                          onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                          className="input-field text-sm"
                          placeholder="Enter name"
                        />
                      </div>
                      <div>
                        <label className="label mb-1.5 block text-xs">Phone</label>
                        <input
                          type="tel"
                          value={formData.motherPhone}
                          onChange={(e) => setFormData({ ...formData, motherPhone: e.target.value })}
                          className="input-field text-sm"
                          placeholder="08012345678"
                        />
                      </div>
                      <div>
                        <label className="label mb-1.5 block text-xs">Email</label>
                        <input
                          type="email"
                          value={formData.motherEmail}
                          onChange={(e) => setFormData({ ...formData, motherEmail: e.target.value })}
                          className="input-field text-sm"
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <label className="label mb-1.5 block text-xs">Occupation</label>
                        <input
                          type="text"
                          value={formData.motherOccupation}
                          onChange={(e) => setFormData({ ...formData, motherOccupation: e.target.value })}
                          className="input-field text-sm"
                          placeholder="Occupation"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Guardian */}
                  <div>
                    <h4 className="text-xs font-semibold text-secondary-text mb-3 uppercase">Guardian (if applicable)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label mb-1.5 block text-xs">Guardian's Name</label>
                        <input
                          type="text"
                          value={formData.guardianName}
                          onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                          className="input-field text-sm"
                          placeholder="Enter name"
                        />
                      </div>
                      <div>
                        <label className="label mb-1.5 block text-xs">Phone</label>
                        <input
                          type="tel"
                          value={formData.guardianPhone}
                          onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                          className="input-field text-sm"
                          placeholder="08012345678"
                        />
                      </div>
                      <div>
                        <label className="label mb-1.5 block text-xs">Email</label>
                        <input
                          type="email"
                          value={formData.guardianEmail}
                          onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                          className="input-field text-sm"
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <label className="label mb-1.5 block text-xs">Relationship</label>
                        <input
                          type="text"
                          value={formData.guardianRelationship}
                          onChange={(e) => setFormData({ ...formData, guardianRelationship: e.target.value })}
                          className="input-field text-sm"
                          placeholder="e.g. Aunt, Uncle, Grandparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border dark:border-gray-800 pt-6 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  {loading ? 'Creating...' : 'Add Student'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-border dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Student</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-lg hover:bg-secondary-bg dark:hover:bg-dark-card"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleEditStudent} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">First Name</label>
                  <input
                    type="text"
                    value={editingStudent.firstName}
                    onChange={(e) => setEditingStudent({ ...editingStudent, firstName: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Last Name</label>
                  <input
                    type="text"
                    value={editingStudent.lastName}
                    onChange={(e) => setEditingStudent({ ...editingStudent, lastName: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Middle Name</label>
                  <input
                    type="text"
                    value={editingStudent.middleName}
                    onChange={(e) => setEditingStudent({ ...editingStudent, middleName: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Gender</label>
                  <select
                    value={editingStudent.gender}
                    onChange={(e) => setEditingStudent({ ...editingStudent, gender: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Date of Birth</label>
                  <input
                    type="date"
                    value={editingStudent.dateOfBirth}
                    onChange={(e) => setEditingStudent({ ...editingStudent, dateOfBirth: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Class</label>
                  <select
                    value={editingStudent.classId}
                    onChange={(e) => setEditingStudent({ ...editingStudent, classId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {formatClassLabel(cls.grade_level, cls.section, cls.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Status</label>
                  <select
                    value={editingStudent.status}
                    onChange={(e) => setEditingStudent({ ...editingStudent, status: e.target.value })}
                    className="input-field"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              {user?.schoolId && editingStudent.id && (
                <div className="pt-4 border-t border-border dark:border-gray-800">
                  <VirtualAccountCard
                    key={`va-${editingStudent.id}`}
                    schoolId={user.schoolId}
                    studentId={editingStudent.id}
                    classId={editingStudent.classId}
                    studentName={formatStudentFullName(
                      editingStudent.firstName,
                      editingStudent.middleName,
                      editingStudent.lastName
                    )}
                    allowProvision
                    autoProvision
                    variant="admin"
                  />
                </div>
              )}

              <div className="border-t border-border dark:border-gray-800 pt-6 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={savingEdit} className="btn-primary">
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Activate / Deactivate confirmation */}
      {statusToggleTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  statusToggleTarget.action === 'deactivate'
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-green-100 dark:bg-green-900/30'
                }`}
              >
                {statusToggleTarget.action === 'deactivate' ? (
                  <Trash2 className="w-7 h-7 text-red-600" />
                ) : (
                  <UserCheck className="w-7 h-7 text-green-600" />
                )}
              </div>
              <h2 className="text-xl font-bold text-center mb-2">
                {statusToggleTarget.action === 'deactivate' ? 'Deactivate student?' : 'Activate student?'}
              </h2>
              <p className="text-secondary-text text-center mb-6">
                {statusToggleTarget.action === 'deactivate' ? (
                  <>
                    <span className="font-medium text-primary-text">
                      {statusToggleTarget.firstName} {statusToggleTarget.lastName}
                    </span>{' '}
                    will be marked as withdrawn and hidden from active student lists.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-primary-text">
                      {statusToggleTarget.firstName} {statusToggleTarget.lastName}
                    </span>{' '}
                    will be restored to active status.
                  </>
                )}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStatusToggleTarget(null)}
                  disabled={togglingStatusId !== null}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmStatusToggle()}
                  disabled={togglingStatusId !== null}
                  className={
                    statusToggleTarget.action === 'deactivate'
                      ? 'btn-primary bg-red-600 hover:bg-red-700 border-red-600'
                      : 'btn-primary'
                  }
                >
                  {togglingStatusId !== null
                    ? statusToggleTarget.action === 'deactivate'
                      ? 'Deactivating…'
                      : 'Activating…'
                    : statusToggleTarget.action === 'deactivate'
                      ? 'Deactivate'
                      : 'Activate'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white dark:bg-dark-bg rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2">Student Created Successfully!</h2>
              <p className="text-secondary-text mb-6">
                {successData.firstName} {successData.lastName} has been registered with ID {successData.studentId}
              </p>

              <div className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card mb-4 text-left">
                <p className="text-xs text-secondary-text mb-2">Student ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm">{successData.studentId}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(successData.studentId, 'id')}
                    className="p-2 rounded-lg hover:bg-border transition-colors"
                  >
                    {copied === 'id' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {successData.virtualAccount?.accountNumber && (
                <VirtualAccountSummary
                  className="mb-4 text-left"
                  bankName={successData.virtualAccount.bankName}
                  accountNumber={successData.virtualAccount.accountNumber}
                  accountName={formatStudentFullName(
                    successData.firstName,
                    successData.middleName,
                    successData.lastName
                  )}
                />
              )}

              {successData.virtualAccountError && !successData.virtualAccount?.accountNumber && (
                <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4 text-left">
                  <p>Virtual account was not created: {successData.virtualAccountError}</p>
                  {user?.schoolId && (
                    <button
                      type="button"
                      disabled={retryingVirtualAccount}
                      onClick={async () => {
                        if (!user?.schoolId || !successData.id) return;
                        setRetryingVirtualAccount(true);
                        const { monnifyService } = await import('@/services/monnifyService');
                        const res = await monnifyService.ensureVirtualAccount(user.schoolId, successData.id);
                        setRetryingVirtualAccount(false);
                        if (res.success && res.account?.accountNumber) {
                          const fullName = formatStudentFullName(
                            successData.firstName,
                            successData.middleName,
                            successData.lastName
                          );
                          setSuccessData({
                            ...successData,
                            virtualAccount: {
                              accountNumber: res.account.accountNumber,
                              accountName: fullName,
                              bankName: res.account.bankName,
                            },
                            virtualAccountError: undefined,
                          });
                        } else {
                          setSuccessData({
                            ...successData,
                            virtualAccountError: res.error ?? successData.virtualAccountError,
                          });
                        }
                      }}
                      className="btn-secondary text-xs mt-2"
                    >
                      {retryingVirtualAccount ? 'Generating…' : 'Generate virtual account'}
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full btn-primary"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
