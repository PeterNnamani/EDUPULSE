import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ClipboardList, AlertTriangle, BookOpen, TrendingUp, MessageSquare, User, ChevronDown, Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';

interface ChildStats {
  [key: string]: {
    attendance: { present: number; absent: number; late: number; percentage: number };
    averageGrade: number;
    assignments: { completed: number; pending: number; total: number };
    behaviour: { merits: number; demerits: number };
    feeStatus: string;
    riskLevel: string;
  };
}

interface Child {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  gender: string;
  classId?: string;
}

export default function ParentDashboard() {
  const { user } = useAppStore();
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [childStats, setChildStats] = useState<ChildStats>({});
  const [loading, setLoading] = useState(true);
  const [openChildSelector, setOpenChildSelector] = useState(false);

  // Refs for request deduplication and cleanup
  const pendingRequestRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const upcomingEvents = [
    { event: 'Parent-Teacher Meeting', date: 'Jan 20, 2025', time: '10:00 AM' },
    { event: 'Mid-Term Exams Begin', date: 'Feb 1, 2025', time: '9:00 AM' },
    { event: 'Sports Day', date: 'Feb 15, 2025', time: '8:00 AM' },
  ];

  // Set default selected child - only runs once when children load
  useEffect(() => {
    if (user?.children && user.children.length > 0 && !selectedChildId) {
      console.log('[PARENT_DASHBOARD] Setting default child:', user.children[0].id);
      setSelectedChildId(user.children[0].id);
    }
  }, []);

  // Fetch child stats - only when selectedChildId changes
  useEffect(() => {
    // Cleanup timer on effect restart
    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = null;
    }

    const fetchChildStats = async () => {
      // Early return if conditions not met
      if (!selectedChildId || !user?.schoolId) {
        if (isMountedRef.current) {
          setLoading(false);
        }
        return;
      }

      // Request deduplication: skip if same request already pending
      if (pendingRequestRef.current === selectedChildId) {
        console.log(`[PARENT_DASHBOARD] Request already pending for child: ${selectedChildId}`);
        return;
      }

      // Mark request as pending
      pendingRequestRef.current = selectedChildId;

      if (isMountedRef.current) {
        setLoading(true);
      }

      try {
        console.log(`[PARENT_DASHBOARD] Fetching stats for child: ${selectedChildId}`);

        // Fetch attendance data
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', selectedChildId)
          .eq('school_id', user.schoolId);

        if (attendanceError) {
          console.error('[PARENT_DASHBOARD] Error fetching attendance:', attendanceError);
        }

        const attendanceStats = {
          present: attendanceData?.filter((a: any) => a.status === 'present').length || 0,
          absent: attendanceData?.filter((a: any) => a.status === 'absent').length || 0,
          late: attendanceData?.filter((a: any) => a.status === 'late').length || 0,
        };
        const totalAttendance = attendanceStats.present + attendanceStats.absent + attendanceStats.late;
        const attendancePercentage = totalAttendance > 0 ? Math.round((attendanceStats.present / totalAttendance) * 100) : 0;

        // Fetch grades data
        const { data: gradesData, error: gradesError } = await supabase
          .from('grades')
          .select('score')
          .eq('student_id', selectedChildId)
          .eq('school_id', user.schoolId);

        if (gradesError) {
          console.error('[PARENT_DASHBOARD] Error fetching grades:', gradesError);
        }

        const averageGrade = gradesData && gradesData.length > 0
          ? Math.round(gradesData.reduce((sum: number, g: any) => sum + (g.score || 0), 0) / gradesData.length)
          : 0;

        // Fetch assignments data
        const { data: assignmentData, error: assignmentError } = await supabase
          .from('assignment_submissions')
          .select('status')
          .eq('student_id', selectedChildId)
          .eq('school_id', user.schoolId);

        if (assignmentError) {
          console.error('[PARENT_DASHBOARD] Error fetching assignments:', assignmentError);
        }

        const assignmentStats = {
          completed: assignmentData?.filter((a: any) => a.status === 'submitted' || a.status === 'graded').length || 0,
          pending: assignmentData?.filter((a: any) => a.status === 'pending').length || 0,
          total: assignmentData?.length || 0,
        };

        // Fetch behaviour data
        const { data: behaviourData, error: behaviourError } = await supabase
          .from('behaviour_records')
          .select('behaviour_type')
          .eq('student_id', selectedChildId)
          .eq('school_id', user.schoolId);

        if (behaviourError) {
          console.error('[PARENT_DASHBOARD] Error fetching behaviour:', behaviourError);
        }

        const behaviourStats = {
          merits: behaviourData?.filter((b: any) => b.behaviour_type === 'merit' || b.behaviour_type === 'commendation').length || 0,
          demerits: behaviourData?.filter((b: any) => b.behaviour_type === 'demerit' || b.behaviour_type === 'warning').length || 0,
        };

        // Fetch risk assessment
        const { data: riskData, error: riskError } = await supabase
          .from('risk_assessments')
          .select('risk_level')
          .eq('student_id', selectedChildId)
          .eq('school_id', user.schoolId)
          .order('assessed_at', { ascending: false })
          .limit(1);

        if (riskError) {
          console.error('[PARENT_DASHBOARD] Error fetching risk assessment:', riskError);
        }

        const riskLevel = riskData && riskData.length > 0 ? riskData[0].risk_level : 'low';

        // Only update state if component is still mounted and this is still the pending request
        if (isMountedRef.current && pendingRequestRef.current === selectedChildId) {
          setChildStats((prevStats) => ({
            ...prevStats,
            [selectedChildId]: {
              attendance: { ...attendanceStats, percentage: attendancePercentage },
              averageGrade: averageGrade,
              assignments: assignmentStats,
              behaviour: behaviourStats,
              feeStatus: 'paid',
              riskLevel: riskLevel,
            },
          }));
          setLoading(false);

          // Clear pending request
          pendingRequestRef.current = null;
        }
      } catch (error) {
        console.error('[PARENT_DASHBOARD] Error fetching child stats:', error);
        if (isMountedRef.current) {
          setLoading(false);
        }
        pendingRequestRef.current = null;
      }
    };

    // Fetch stats immediately
    fetchChildStats();

    // Cleanup: prevent state updates after unmount
    return () => {
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
      }
    };
  }, [selectedChildId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[PARENT_DASHBOARD] Component unmounting, preventing state updates');
      isMountedRef.current = false;
      pendingRequestRef.current = null;
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
      }
    };
  }, []);

  const getRecentActivities = () => [
    { type: 'attendance', message: 'Student was present today', time: 'Today, 8:15 AM' },
    { type: 'grade', message: 'Mathematics test scored: 75/100', time: 'Yesterday' },
    { type: 'assignment', message: 'English assignment submitted', time: '2 days ago' },
    { type: 'behaviour', message: 'Merit: Excellent class participation', time: '3 days ago' },
  ];

  const selectedChild = user?.children?.find((c: Child) => c.id === selectedChildId);
  const stats = childStats[selectedChildId] || {
    attendance: { present: 0, absent: 0, late: 0, percentage: 0 },
    averageGrade: 0,
    assignments: { completed: 0, pending: 0, total: 0 },
    behaviour: { merits: 0, demerits: 0 },
    feeStatus: 'pending',
    riskLevel: 'low',
  };

  // If no children are registered
  if (!user?.children || user.children.length === 0) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-white text-white dark:text-black"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">Welcome, {user?.fullName}</h1>
              <p className="text-gray-300 dark:text-gray-600">Monitor your children's academic progress</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card text-center py-12"
        >
          <div className="w-16 h-16 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-secondary-text" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Children Registered Yet</h3>
          <p className="text-secondary-text mb-6">
            Your phone number ({user?.phone}) is not linked to any student records. Please contact your school administrator to register your child.
          </p>
          <div className="text-sm text-secondary-text">
            <p>Debugging Info:</p>
            <p className="font-mono text-xs mt-2">Phone: {user?.phone}</p>
            <p className="font-mono text-xs">User ID: {user?.id}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner with Child Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-white text-white dark:text-black"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Welcome, {user?.fullName}</h1>
            <p className="text-gray-300 dark:text-gray-600">
              {user?.children && user.children.length === 1
                ? `Monitor ${selectedChild?.firstName}'s academic progress`
                : `Monitor your ${user?.children?.length} children's academic progress`}
            </p>
          </div>

          {/* Child Selector for Multiple Children */}
          {user?.children && user.children.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setOpenChildSelector(!openChildSelector)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <span className="text-sm">
                  {selectedChild?.firstName} {selectedChild?.lastName}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {openChildSelector && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-900 dark:bg-white rounded-lg shadow-lg z-10 border border-gray-700 dark:border-gray-200">
                  {user.children.map((child: Child) => (
                    <button
                      key={child.id}
                      onClick={() => {
                        setSelectedChildId(child.id);
                        setOpenChildSelector(false);
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors first:rounded-t-lg last:rounded-b-lg ${selectedChildId === child.id
                        ? 'bg-gray-800 dark:bg-gray-100 font-semibold'
                        : ''
                        }`}
                    >
                      {child.firstName} {child.lastName}
                      {child.classId && <span className="text-xs text-gray-400 dark:text-gray-600 ml-2">({child.classId})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {loading && selectedChildId ? (
        <div className="card flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-secondary-text" />
        </div>
      ) : (
        <>
          {/* Child Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
            >
              <div className="flex items-center gap-3 mb-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-secondary-text">Attendance</span>
              </div>
              <p className="text-3xl font-bold">{stats.attendance.percentage}%</p>
              <div className="flex gap-1 mt-3">
                <div className="flex-1 h-1.5 rounded-full bg-green-500" style={{ width: `${stats.attendance.percentage}%` }} />
                <div className="flex-1 h-1.5 rounded-full bg-red-500" style={{ width: `${100 - stats.attendance.percentage}%` }} />
              </div>
              <p className="text-xs text-secondary-text mt-2">{stats.attendance.present} present, {stats.attendance.absent} absent</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card"
            >
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-sm text-secondary-text">Average Grade</span>
              </div>
              <p className="text-3xl font-bold">{stats.averageGrade}%</p>
              <p className={`text-xs mt-2 ${stats.averageGrade >= 70 ? 'text-green-600' : stats.averageGrade >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {stats.averageGrade >= 70 ? 'Excellent performance' : stats.averageGrade >= 50 ? 'Average performance' : 'Needs improvement'}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card"
            >
              <div className="flex items-center gap-3 mb-2">
                <ClipboardList className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-secondary-text">Assignments</span>
              </div>
              <p className="text-3xl font-bold">{stats.assignments.completed}/{stats.assignments.total}</p>
              <p className="text-xs text-secondary-text mt-2">{stats.assignments.pending} pending submission</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card"
            >
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <span className="text-sm text-secondary-text">Risk Level</span>
              </div>
              <p className={`text-2xl font-bold capitalize ${stats.riskLevel === 'low' ? 'text-green-600' : stats.riskLevel === 'medium' ? 'text-yellow-600' : stats.riskLevel === 'high' ? 'text-orange-600' : 'text-red-600'}`}>
                {stats.riskLevel}
              </p>
              <p className="text-xs text-secondary-text mt-2">Current assessment</p>
            </motion.div>
          </div>

          {/* Detailed Child Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center font-bold text-xl">
                {selectedChild?.firstName.charAt(0)}{selectedChild?.lastName.charAt(0)}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{selectedChild?.firstName} {selectedChild?.lastName}</h2>
                <p className="text-secondary-text">{selectedChild?.classId || 'Class TBD'} • Student ID: {selectedChild?.studentId}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card text-center">
                <p className="text-2xl font-bold">{stats.behaviour.merits}</p>
                <p className="text-xs text-secondary-text mt-1">Merits</p>
              </div>
              <div className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card text-center">
                <p className="text-2xl font-bold">{stats.behaviour.demerits}</p>
                <p className="text-xs text-secondary-text mt-1">Demerits</p>
              </div>
              <div className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card text-center">
                <p className={`text-2xl font-bold ${stats.feeStatus === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.feeStatus === 'paid' ? '✓' : '!'}
                </p>
                <p className="text-xs text-secondary-text mt-1">Fee Status</p>
              </div>
              <div className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card text-center">
                <p className="text-2xl font-bold">{stats.attendance.late}</p>
                <p className="text-xs text-secondary-text mt-1">Late Arrivals</p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activities */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
            >
              <h3 className="font-semibold mb-4">Recent Activities</h3>
              <div className="space-y-3">
                {getRecentActivities().map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.type === 'attendance' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        activity.type === 'grade' ? 'bg-green-100 dark:bg-green-900/30' :
                          activity.type === 'assignment' ? 'bg-purple-100 dark:bg-purple-900/30' :
                            'bg-yellow-100 dark:bg-yellow-900/30'
                        }`}
                    >
                      {activity.type === 'attendance' && <CalendarDays className="w-4 h-4 text-blue-600" />}
                      {activity.type === 'grade' && <ClipboardList className="w-4 h-4 text-green-600" />}
                      {activity.type === 'assignment' && <BookOpen className="w-4 h-4 text-purple-600" />}
                      {activity.type === 'behaviour' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-secondary-text">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Upcoming Events */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
            >
              <h3 className="font-semibold mb-4">Upcoming Events</h3>
              <div className="space-y-3">
                {upcomingEvents.map((event, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-xl border border-border dark:border-gray-800">
                    <div className="w-12 h-12 rounded-lg bg-secondary-bg dark:bg-dark-card flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium">{event.date.split(' ')[1]}</span>
                      <span className="text-lg font-bold">{event.date.split(' ')[0].replace(',', '')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{event.event}</p>
                      <p className="text-xs text-secondary-text">{event.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
