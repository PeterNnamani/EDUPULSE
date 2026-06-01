import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Download, Calculator, AlertCircle, Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { getTeacherClasses, getClassStudents } from '@/services/classService';
import { bulkRecordGrades, getStudentGrades } from '@/services/gradeService';
import { supabase } from '@/lib/supabase';
import { getCurrentTerm, getTermsForSession, getCurrentSession } from '@/utils/calendarUtils';

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
}

interface ClassData {
  id: string;
  name: string;
  students: number;
}

interface Subject {
  id: string;
  name: string;
}

interface AcademicTerm {
  id: string;
  name: string;
}

export default function GradesPage() {
  const { user } = useAppStore();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [academicTerms, setAcademicTerms] = useState<AcademicTerm[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedAssessment, setSelectedAssessment] = useState('ca1');
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const assessments = [
    { value: 'ca1', label: 'CA 1' },
    { value: 'ca2', label: 'CA 2' },
    { value: 'ca3', label: 'CA 3' },
    { value: 'exam', label: 'Exam' },
  ];

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
        if (teacherClasses.length > 0) {
          setSelectedClass(teacherClasses[0].id);
        }

        // Load subjects
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('school_id', user.schoolId)
          .eq('is_active', true);

        if (!subjectsError && subjectsData) {
          setSubjects(subjectsData);
          if (subjectsData.length > 0) {
            setSelectedSubject(subjectsData[0].id);
          }
        }

        // Load academic terms - automatically get current term
        const currentTerm = await getCurrentTerm(user.schoolId);
        if (currentTerm) {
          setAcademicTerms([currentTerm]);
          setSelectedTerm(currentTerm.id);
          console.log('✓ Current academic term loaded:', currentTerm.name);
        } else {
          console.warn('⚠️ No current term found, loading all terms');
          const { data: termsData } = await supabase
            .from('academic_terms')
            .select('id, name')
            .eq('school_id', user.schoolId)
            .order('start_date', { ascending: false })
            .limit(5);
          if (termsData && termsData.length > 0) {
            setAcademicTerms(termsData);
            setSelectedTerm(termsData[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user]);

  // Load students when class changes
  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedClass) return;

      try {
        const classStudents = await getClassStudents(selectedClass);
        setStudents(classStudents);
        setGrades({});
        setSuccessMessage('');
      } catch (err) {
        console.error('Error loading students:', err);
        setError('Failed to load students');
      }
    };

    loadStudents();
  }, [selectedClass]);

  const handleScoreChange = (studentId: string, score: string) => {
    const numScore = score === '' ? 0 : Math.min(100, Math.max(0, parseFloat(score) || 0));
    setGrades({ ...grades, [studentId]: numScore });
    setSuccessMessage('');
  };

  const calculateGrade = (score: number): string => {
    if (score >= 70) return 'A';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  };

  const handleSaveGrades = async () => {
    if (!selectedClass || !selectedSubject || !selectedTerm || !user?.schoolId || !user?.id) {
      setError('Missing required information');
      return;
    }

    if (Object.keys(grades).length === 0) {
      setError('Please enter grades for at least one student');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const gradesData = students.map((student) => ({
        studentId: student.id,
        score: grades[student.id] || 0,
        maxScore: 100,
      }));

      const result = await bulkRecordGrades(
        user.schoolId,
        selectedClass,
        selectedSubject,
        selectedTerm,
        selectedAssessment,
        gradesData,
        user.id
      );

      if (result.success) {
        setSuccessMessage(`Grades saved successfully for ${result.recorded} students`);
        setGrades({});
      } else {
        setError(result.error || 'Failed to save grades');
      }
    } catch (err) {
      console.error('Error saving grades:', err);
      setError('Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    average: students.length > 0
      ? Object.values(grades).reduce((a, b) => a + (b || 0), 0) / Math.max(Object.keys(grades).length, 1)
      : 0,
    highest: students.length > 0 ? Math.max(...Object.values(grades), 0) : 0,
    lowest: students.length > 0 && Object.values(grades).length > 0 ? Math.min(...Object.values(grades)) : 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-secondary-text">Loading grades data...</p>
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Grades</h1>
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
          <h1 className="text-2xl font-bold">Grades</h1>
          <p className="text-secondary-text">Enter and manage student grades</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Calculate Averages
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleSaveGrades}
            disabled={saving || students.length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Save Grades
              </>
            )}
          </button>
        </div>
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
            <Plus className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label mb-1.5 block">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input-field"
            >
              <option value="">Select a class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="input-field"
            >
              <option value="">Select a subject</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Assessment</label>
            <select
              value={selectedAssessment}
              onChange={(e) => setSelectedAssessment(e.target.value)}
              className="input-field"
            >
              {assessments.map((ass) => (
                <option key={ass.value} value={ass.value}>{ass.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Term</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="input-field"
            >
              <option value="">Select a term</option>
              {academicTerms.map((term) => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-secondary-text mb-1">Class Average</p>
          <p className="text-2xl font-bold">{stats.average.toFixed(1)}%</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-secondary-text mb-1">Highest Score</p>
          <p className="text-2xl font-bold text-green-600">{stats.highest}%</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-secondary-text mb-1">Lowest Score</p>
          <p className="text-2xl font-bold text-red-600">{stats.lowest}%</p>
        </div>
      </div>

      {/* Grades Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left rounded-l-lg">Student</th>
                <th className="px-4 py-3 text-center">Score</th>
                <th className="px-4 py-3 text-center">Grade</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const score = grades[student.id] ?? 0;
                const grade = calculateGrade(score);
                const fullName = `${student.first_name} ${student.last_name}`;
                return (
                  <tr key={student.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center font-medium text-sm">
                          {`${student.first_name[0]}${student.last_name[0]}`.toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium">{fullName}</span>
                          <span className="text-xs text-secondary-text ml-2">{student.student_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={score === 0 ? '' : score}
                        onChange={(e) => handleScoreChange(student.id, e.target.value)}
                        className="input-field w-24 text-center mx-auto block"
                        min="0"
                        max="100"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${grade === 'A' ? 'badge-success' :
                        grade === 'B' ? 'badge-info' :
                          grade === 'C' ? 'badge-warning' :
                            grade === 'D' ? 'badge-warning' :
                              'badge-danger'
                        }`}>
                        {grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Add remarks..."
                      />
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-secondary-text">
                    No students in selected class
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
