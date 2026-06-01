import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Check, X, Clock, UserCheck, Download, AlertCircle, Loader } from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '@/store';
import { getTeacherClasses, getClassStudents } from '@/services/classService';
import { recordClassAttendance, getClassAttendanceForDate } from '@/services/attendanceService';

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

export default function AttendancePage() {
  const { user } = useAppStore();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Load teacher's classes on mount
  useEffect(() => {
    const loadClasses = async () => {
      if (!user?.id || !user?.schoolId) {
        setError('User information not found');
        setLoading(false);
        return;
      }

      try {
        const teacherClasses = await getTeacherClasses(user.schoolId, user.id);
        setClasses(teacherClasses);
        if (teacherClasses.length > 0) {
          setSelectedClass(teacherClasses[0].id);
        }
      } catch (err) {
        console.error('Error loading classes:', err);
        setError('Failed to load classes');
      } finally {
        setLoading(false);
      }
    };

    loadClasses();
  }, [user]);

  // Load students when class changes
  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedClass) return;

      try {
        const classStudents = await getClassStudents(selectedClass);
        setStudents(classStudents);

        // Load existing attendance for this date
        const existingAttendance = await getClassAttendanceForDate(selectedClass, selectedDate);
        const attendanceMap: Record<string, string> = {};
        existingAttendance.forEach((record: any) => {
          attendanceMap[record.student_id] = record.status;
        });
        setAttendance(attendanceMap);
      } catch (err) {
        console.error('Error loading students:', err);
        setError('Failed to load students');
      }
    };

    loadStudents();
  }, [selectedClass, selectedDate]);

  const handleMarkAttendance = (studentId: string, status: string) => {
    setAttendance({ ...attendance, [studentId]: status });
    setSuccessMessage('');
  };

  const handleSubmitAttendance = async () => {
    if (!selectedClass || !user?.schoolId || !user?.id) {
      setError('Missing required information');
      return;
    }

    if (Object.keys(attendance).length === 0) {
      setError('Please mark attendance for at least one student');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const attendanceData = students.map((student) => ({
        studentId: student.id,
        status: attendance[student.id] || 'absent',
      }));

      const result = await recordClassAttendance(
        user.schoolId,
        selectedClass,
        attendanceData,
        selectedDate,
        user.id
      );

      if (result.success) {
        setSuccessMessage(`Attendance recorded successfully for ${result.recorded} students`);
        setAttendance({});
      } else {
        setError(result.error || 'Failed to save attendance');
      }
    } catch (err) {
      console.error('Error submitting attendance:', err);
      setError('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    present: Object.values(attendance).filter((s) => s === 'present').length,
    absent: Object.values(attendance).filter((s) => s === 'absent').length,
    late: Object.values(attendance).filter((s) => s === 'late').length,
    excused: Object.values(attendance).filter((s) => s === 'excused').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-secondary-text">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Attendance</h1>
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
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-secondary-text">Mark and track student attendance</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleSubmitAttendance}
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
                <UserCheck className="w-4 h-4" />
                Submit
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
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
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
          <div className="flex-1">
            <label className="label mb-1.5 block">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Present', value: stats.present, icon: Check, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
          { label: 'Absent', value: stats.absent, icon: X, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
          { label: 'Late', value: stats.late, icon: Clock, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
          { label: 'Excused', value: stats.excused, icon: CalendarDays, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.color}`}>
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

      {/* Student List */}
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
                <th className="px-4 py-3 text-center">Present</th>
                <th className="px-4 py-3 text-center">Absent</th>
                <th className="px-4 py-3 text-center">Late</th>
                <th className="px-4 py-3 text-center">Excused</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const status = attendance[student.id] || 'absent';
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
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleMarkAttendance(student.id, 'present')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${status === 'present' ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-green-100'
                          }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleMarkAttendance(student.id, 'absent')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${status === 'absent' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-red-100'
                          }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleMarkAttendance(student.id, 'late')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${status === 'late' ? 'bg-yellow-500 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-yellow-100'
                          }`}
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleMarkAttendance(student.id, 'excused')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${status === 'excused' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-blue-100'
                          }`}
                      >
                        <CalendarDays className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 capitalize">
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
