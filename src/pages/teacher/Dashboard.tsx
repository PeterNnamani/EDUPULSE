import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ClipboardList, Users, AlertTriangle, BookOpen, TrendingUp, Plus, Loader } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '@/store';
import { getTeacherClasses, getClassStudents } from '@/services/classService';
import { getTeacherAssignments, getAssignmentStats } from '@/services/assignmentService';
import { supabase } from '@/lib/supabase';

interface TeacherClass {
  id: string;
  name: string;
  students: number;
}

interface Assignment {
  id: string;
  title: string;
  class_id: string;
  due_date: string;
  status: string;
}

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
}

export default function TeacherDashboard() {
  const { user } = useAppStore();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [riskStudents, setRiskStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeAssignments, setActiveAssignments] = useState(0);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user?.id || !user?.schoolId) {
        setLoading(false);
        return;
      }

      try {
        // Get teacher's classes
        const teacherClasses = await getTeacherClasses(user.schoolId, user.id);
        setClasses(teacherClasses);
        setTotalStudents(teacherClasses.reduce((sum, cls) => sum + cls.students, 0));

        // Get teacher's assignments
        const teacherAssignments = await getTeacherAssignments(user.schoolId, user.id);
        setAssignments(teacherAssignments);
        const activeCount = teacherAssignments.filter((a) => a.status === 'active').length;
        setActiveAssignments(activeCount);

        // Build performance data
        const perfData = await Promise.all(
          teacherClasses.map(async (cls) => {
            // Get average grades for the class
            const { data: grades, error } = await supabase
              .from('grades')
              .select('score, max_score')
              .eq('school_id', user!.schoolId)
              .eq('class_id', cls.id);

            if (error || !grades || grades.length === 0) {
              return { subject: cls.name, average: 0 };
            }

            const average =
              grades.reduce((sum, g) => {
                const max = g.max_score && g.max_score > 0 ? g.max_score : 100;
                return sum + ((g.score || 0) / max) * 100;
              }, 0) / grades.length;
            return { subject: cls.name, average: Math.round(average) };
          })
        );
        setPerformanceData(perfData);

        // Get at-risk students
        const allStudents = await Promise.all(
          teacherClasses.map((cls) => getClassStudents(cls.id, user!.schoolId))
        );

        const riskAssessments: any[] = [];
        for (let i = 0; i < teacherClasses.length; i++) {
          const cls = teacherClasses[i];
          const classStudentIds = (allStudents[i] ?? []).map((s: { id: string }) => s.id);
          if (classStudentIds.length === 0) continue;

          const { data: atRiskStudents, error: riskError } = await supabase
            .from('students')
            .select('id, first_name, last_name, risk_level, risk_score')
            .eq('school_id', user!.schoolId)
            .in('id', classStudentIds)
            .in('risk_level', ['medium', 'high', 'critical'])
            .order('risk_score', { ascending: false })
            .limit(3);

          if (!riskError && atRiskStudents) {
            for (const student of atRiskStudents) {
              riskAssessments.push({
                name: `${student.first_name} ${student.last_name}`,
                class: cls.name,
                risk: student.risk_level || 'medium',
                reason: `Risk score ${student.risk_score ?? '—'}`,
              });
            }
          }
        }
        setRiskStudents(riskAssessments.slice(0, 5));
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user?.id, user?.schoolId]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Good Morning, {user?.fullName?.split(' ')[0]}</h1>
            <p className="text-secondary-text">You have {classes.length} class{classes.length !== 1 ? 'es' : ''} assigned</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-secondary-text">Today</p>
              <p className="font-medium">{new Date().toLocaleDateString('en-NG', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Classes', value: classes.length, icon: BookOpen },
          { label: 'Students to Teach', value: totalStudents, icon: Users },
          { label: 'Active Assignments', value: activeAssignments, icon: ClipboardList },
          { label: 'At-Risk Students', value: riskStudents.length, icon: AlertTriangle, isAlert: riskStudents.length > 0 },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`card ${stat.isAlert ? 'border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.isAlert ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-secondary-bg dark:bg-dark-card'}`}>
                  <Icon className={`w-5 h-5 ${stat.isAlert ? 'text-yellow-600 dark:text-yellow-400' : 'text-black dark:text-white'}`} />
                </div>
                <div>
                  <p className="stat-label text-xs">{stat.label}</p>
                  <p className={`stat-value text-xl ${stat.isAlert ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                    {loading ? <Loader className="w-5 h-5 animate-spin" /> : stat.value}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Classes & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Your Classes</h3>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader className="w-5 h-5 animate-spin" />
              </div>
            ) : classes.length > 0 ? (
              classes.map((cls, index) => (
                <div key={cls.id} className="flex items-center gap-4 p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                  <div className="flex-1">
                    <p className="font-medium">{cls.name}</p>
                    <p className="text-sm text-secondary-text">{cls.students} students</p>
                  </div>
                  <button className="p-2 rounded-lg bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-80 transition">
                    View Class
                  </button>
                </div>
              ))
            ) : (
              <p className="text-center text-secondary-text py-8">No classes assigned yet</p>
            )}
          </div>
        </motion.div>

        {/* Class Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Class Performance</h3>
            <span className="text-sm text-secondary-text">Average scores</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="w-5 h-5 animate-spin" />
            </div>
          ) : performanceData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis dataKey="subject" stroke="#6B7280" fontSize={12} />
                  <YAxis type="number" domain={[0, 100]} stroke="#6B7280" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="average" fill="#000" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-secondary-text py-8">No grade data available</p>
          )}
        </motion.div>
      </div>

      {/* Recent Assignments & Risk Students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Assignments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Assignments</h3>
            <button className="btn-secondary text-sm py-2 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create New
            </button>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader className="w-5 h-5 animate-spin" />
              </div>
            ) : assignments.length > 0 ? (
              assignments.slice(0, 5).map((assignment, index) => {
                const classList = classes.find((c) => c.id === assignment.class_id);
                const daysUntilDue = assignment.due_date
                  ? Math.ceil((new Date(assignment.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                return (
                  <div key={assignment.id} className="flex items-center gap-4 p-3 rounded-xl border border-border dark:border-gray-800">
                    <div className="w-10 h-10 rounded-lg bg-secondary-bg dark:bg-dark-card flex items-center justify-center">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{assignment.title}</p>
                      <p className="text-xs text-secondary-text">{classList?.name || 'Unknown Class'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{assignment.status}</p>
                      <p className="text-xs text-secondary-text">
                        {daysUntilDue !== null ? (
                          daysUntilDue < 0 ? 'Overdue' : `${daysUntilDue} days`
                        ) : (
                          'No due date'
                        )}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-secondary-text py-4">No assignments yet</p>
            )}
          </div>
        </motion.div>

        {/* Risk Students */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card border-red-200 dark:border-red-900"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Students at Risk
            </h3>
            <button className="text-sm text-red-600 hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader className="w-5 h-5 animate-spin" />
              </div>
            ) : riskStudents.length > 0 ? (
              riskStudents.map((student, index) => (
                <div key={index} className="flex items-center gap-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{student.name}</p>
                    <p className="text-xs text-secondary-text">{student.class} • {student.reason}</p>
                  </div>
                  <div
                    className={`badge ${student.risk === 'critical' || student.risk === 'high'
                        ? 'badge-danger'
                        : 'badge-warning'
                      }`}
                  >
                    {student.risk}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-secondary-text py-4">No at-risk students currently</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <CalendarDays className="w-6 h-6" />
            <span className="text-sm font-medium">Take Attendance</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            <span className="text-sm font-medium">Enter Grades</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <BookOpen className="w-6 h-6" />
            <span className="text-sm font-medium">Create Assignment</span>
          </button>
          <button className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors flex flex-col items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            <span className="text-sm font-medium">View Reports</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
