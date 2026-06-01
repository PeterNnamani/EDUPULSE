import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Clock, Users, Check, FileText, Loader, AlertCircle, X } from 'lucide-react';
import { useAppStore } from '@/store';
import { getTeacherClasses, getClassStudents } from '@/services/classService';
import { createAssignment, getTeacherAssignments } from '@/services/assignmentService';
import { supabase } from '@/lib/supabase';
import { getCurrentTerm } from '@/utils/calendarUtils';

interface Assignment {
  id: string;
  title: string;
  subject_id: string;
  subject_name?: string;
  class_id: string;
  class_name?: string;
  due_date: string;
  total_marks: number;
  assignment_type: string;
  description?: string;
  submissions?: number;
  total_students?: number;
}

interface ClassData {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
}

export default function AssignmentsPage() {
  const { user } = useAppStore();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [currentTerm, setCurrentTerm] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    classId: '',
    subjectId: '',
    dueDate: '',
    totalMarks: 100,
    assignmentType: 'homework',
    description: '',
  });

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user?.id || !user?.schoolId) {
        setError('User information not found');
        setLoading(false);
        return;
      }

      try {
        // Load teacher's classes
        const teacherClasses = await getTeacherClasses(user.schoolId, user.id);
        setClasses(teacherClasses);

        // Load subjects
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('school_id', user.schoolId);

        if (!subjectsError && subjectsData) {
          setSubjects(subjectsData);
        }

        // Get current term automatically
        const term = await getCurrentTerm(user.schoolId);
        if (term) {
          setCurrentTerm(term.id);
          console.log('✓ Current term set for assignments:', term.name);
        } else {
          console.warn('⚠️ No current term found for assignments');
        }

        // Load assignments
        const assignments = await getTeacherAssignments(user.schoolId, user.id);
        setAssignments(assignments);
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'totalMarks' ? parseInt(value) || 0 : value,
    }));
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.classId || !formData.subjectId || !formData.dueDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (!user?.schoolId || !user?.id) {
      setError('User information not found');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const result = await createAssignment({
        schoolId: user.schoolId,
        title: formData.title,
        classId: formData.classId,
        subjectId: formData.subjectId,
        dueDate: formData.dueDate,
        totalMarks: formData.totalMarks,
        assignmentType: formData.assignmentType,
        description: formData.description,
        teacherId: user.id,
        academicTermId: currentTerm || undefined,
      });

      if (result.success) {
        setSuccessMessage('Assignment created successfully');
        setShowAddModal(false);
        setFormData({
          title: '',
          classId: '',
          subjectId: '',
          dueDate: '',
          totalMarks: 100,
          assignmentType: 'homework',
          description: '',
        });

        // Reload assignments
        const updatedAssignments = await getTeacherAssignments(user.schoolId, user.id);
        setAssignments(updatedAssignments);

        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(result.error || 'Failed to create assignment');
      }
    } catch (err) {
      console.error('Error creating assignment:', err);
      setError('Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  const getClassNameById = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || 'Unknown';
  };

  const getSubjectNameById = (subjectId: string) => {
    return subjects.find(s => s.id === subjectId)?.name || 'Unknown';
  };

  const stats = {
    total: assignments.length,
    pending: assignments.filter(a => new Date(a.due_date) > new Date()).length,
    overdue: assignments.filter(a => new Date(a.due_date) < new Date()).length,
    submitted: assignments.reduce((sum, a) => sum + (a.submissions || 0), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-secondary-text">Loading assignments...</p>
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Assignments</h1>
        <div className="card bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">No classes assigned</p>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">You don't have any classes assigned yet.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-secondary-text">Create and manage class assignments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Assignment
        </button>
      </div>

      {/* Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </motion.div>
      )}

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900"
        >
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.total}</p>
              <p className="text-xs text-secondary-text">Total</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.pending}</p>
              <p className="text-xs text-secondary-text">Pending</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.overdue}</p>
              <p className="text-xs text-secondary-text">Overdue</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="stat-value text-xl">{stats.submitted}</p>
              <p className="text-xs text-secondary-text">Submitted</p>
            </div>
          </div>
        </div>
      </div>

      {/* Assignments List */}
      {assignments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card text-center py-12"
        >
          <FileText className="w-12 h-12 text-secondary-text mx-auto mb-4 opacity-50" />
          <p className="text-secondary-text mb-4">No assignments yet</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create First Assignment
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <motion.div
              key={assignment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-secondary-bg dark:bg-dark-card">
                      <FileText className="w-5 h-5 text-secondary-text" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{assignment.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-secondary-text">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {getClassNameById(assignment.class_id)}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {getSubjectNameById(assignment.subject_id)}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          {assignment.total_marks} marks
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                      </div>
                      {assignment.description && (
                        <p className="text-xs text-secondary-text mt-2 line-clamp-2">{assignment.description}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {assignment.submissions || 0} / {assignment.total_students || 0}
                  </div>
                  <p className="text-xs text-secondary-text">Submitted</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
          >
            <div className="p-6 border-b border-border dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">Create Assignment</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAssignment} className="p-6 space-y-4">
              <div>
                <label className="label mb-1.5 block">Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  className="input-field"
                  placeholder="Assignment title..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Class *</label>
                  <select
                    name="classId"
                    value={formData.classId}
                    onChange={handleFormChange}
                    className="input-field"
                    required
                  >
                    <option value="">Select a class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Subject *</label>
                  <select
                    name="subjectId"
                    value={formData.subjectId}
                    onChange={handleFormChange}
                    className="input-field"
                    required
                  >
                    <option value="">Select a subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block">Due Date *</label>
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleFormChange}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Total Marks</label>
                  <input
                    type="number"
                    name="totalMarks"
                    value={formData.totalMarks}
                    onChange={handleFormChange}
                    className="input-field"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="label mb-1.5 block">Type</label>
                <select
                  name="assignmentType"
                  value={formData.assignmentType}
                  onChange={handleFormChange}
                  className="input-field"
                >
                  <option value="homework">Homework</option>
                  <option value="project">Project</option>
                  <option value="test">Test</option>
                  <option value="essay">Essay</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label mb-1.5 block">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  className="input-field"
                  placeholder="Assignment instructions..."
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
