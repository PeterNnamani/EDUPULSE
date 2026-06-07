import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, MoreVertical, Edit2, Trash2, UserPlus, Download, Upload, Copy, Check } from 'lucide-react';
import { useAppStore } from '@/store';
import { getStudents, createStudentWithParent, updateStudent } from '@/services/studentService';
import { getClasses } from '@/services/classService';
import VirtualAccountCard from '@/components/finance/VirtualAccountCard';
import { getInitials } from '@/utils/displayUtils';

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

export default function StudentManagement() {
  const { user } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<EditingStudent | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{ studentId: string; firstName: string; lastName: string } | null>(null);
  const [copied, setCopied] = useState(false);
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

  const statuses = ['active', 'graduated', 'withdrawn', 'suspended'];

  // Load students and classes on mount
  useEffect(() => {
    if (user?.schoolId) {
      loadData();
    }
  }, [user?.schoolId]);

  const loadData = async () => {
    if (!user?.schoolId) return;

    setLoading(true);
    try {
      const [studentsData, classesData] = await Promise.all([
        getStudents(user.schoolId),
        getClasses(user.schoolId),
      ]);
      setStudents(studentsData);
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
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
        setSuccessData({
          studentId: result.data.studentId,
          firstName: result.data.firstName,
          lastName: result.data.lastName,
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
    if (!editingStudent) return;

    setLoading(true);
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
        setShowEditModal(false);
        setEditingStudent(null);
        await loadData();
      } else {
        alert(result.error || 'Failed to update student');
      }
    } catch (error) {
      console.error('Error updating student:', error);
      alert('Error updating student. Please try again.');
    } finally {
      setLoading(false);
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
      status: student.status,
    });
    setShowEditModal(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              <option key={cls.id} value={cls.id}>{cls.name}</option>
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
                    <span className="badge badge-info">{student.class_id}</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{student.gender}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${student.status === 'active' ? 'badge-success' :
                      student.status === 'graduated' ? 'badge-info' :
                        'badge-danger'
                      }`}>
                      {student.status}
                    </span>
                  </td>
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
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Mark ${student.first_name} ${student.last_name} as inactive?`)) return;
                          await updateStudent(student.id, { status: 'inactive' });
                          await loadData();
                        }}
                        className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Deactivate
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
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
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
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
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
                <div className="pt-4">
                  <VirtualAccountCard
                    schoolId={user.schoolId}
                    studentId={editingStudent.id}
                    studentName={`${editingStudent.firstName ?? ''} ${editingStudent.lastName ?? ''}`.trim()}
                    allowProvision
                  />
                </div>
              )}

              <div className="border-t border-border dark:border-gray-800 pt-6 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Saving...' : 'Save Changes'}
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
            className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl overflow-hidden"
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

              <div className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card mb-6 text-left">
                <p className="text-xs text-secondary-text mb-2">Student ID:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm">{successData.studentId}</code>
                  <button
                    onClick={() => copyToClipboard(successData.studentId)}
                    className="p-2 rounded-lg hover:bg-border transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

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
