import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, ClipboardList, AlertTriangle, BookOpen, TrendingUp, ArrowRight, User, Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { getStudentAssignments } from '@/services/assignmentService';
import VirtualAccountCard from '@/components/finance/VirtualAccountCard';
import { formatDate, getInitials } from '@/utils/displayUtils';
import { useSelectedChildClassName } from '@/hooks/useParentChildClasses';
import ParentChildClassBadge from '@/components/parent/ParentChildClassBadge';
import ParentChildSelector from '@/components/parent/ParentChildSelector';
import {
  feeAssignmentService,
  formatFeeStatusDisplay,
  feeStatusToneClass,
  type StudentFeeStatus,
} from '@/services/feeAssignmentService';

interface ChildStats {
  [key: string]: {
    attendance: { present: number; absent: number; late: number; percentage: number };
    averageGrade: number;
    assignments: { completed: number; pending: number; total: number };
    behaviour: { merits: number; demerits: number };
    feeStatus: StudentFeeStatus;
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
  className?: string;
}

interface Assignment {
  id: string;
  title: string;
  due_date: string;
  status: string;
  submissions?: Array<{ status: string }>;
}

/** Extra pixels added above the child row height — card grows upward only. */
const VIRTUAL_CARD_TOP_EXTRA_PX = 72;

export default function ParentDashboard() {
  const { user, selectedParentChildId, setSelectedParentChildId } = useAppStore();
  const navigate = useNavigate();
  const [childStats, setChildStats] = useState<ChildStats>({});
  const [recentAssignments, setRecentAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const childRowRef = useRef<HTMLDivElement>(null);
  const [childRowHeight, setChildRowHeight] = useState<number | undefined>();

  // Refs for request deduplication and cleanup
  const pendingRequestRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set default selected child from store or initialize from first child
  useEffect(() => {
    if (user?.children && user.children.length > 0 && !selectedParentChildId) {
      console.log('[PARENT_DASHBOARD] Setting default child:', user.children[0].id);
      setSelectedParentChildId(user.children[0].id);
    }
  }, [user?.children?.length, setSelectedParentChildId, selectedParentChildId]);

  // Fetch child stats - only when selectedParentChildId changes
  useEffect(() => {
    // Reset mounted ref when effect runs (component came back into view)
    isMountedRef.current = true;

    // Cleanup timer on effect restart
    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = null;
    }

    const fetchChildStats = async () => {
      // Early return if conditions not met
      if (!selectedParentChildId || !user?.schoolId) {
        if (isMountedRef.current) {
          setLoading(false);
        }
        return;
      }

      // Check if we already have cached data for this child
      const hasCachedData = childStats[selectedParentChildId];

      // If we have cached data, don't show loader
      if (hasCachedData) {
        console.log(`[PARENT_DASHBOARD] Using cached data for child: ${selectedParentChildId}`);
        if (isMountedRef.current) {
          setLoading(false);
        }
      } else {
        // Only show loader if no cached data
        if (isMountedRef.current) {
          setLoading(true);
        }
      }

      // Request deduplication: skip if same request already pending
      if (pendingRequestRef.current === selectedParentChildId) {
        console.log(`[PARENT_DASHBOARD] Request already pending for child: ${selectedParentChildId}`);
        return;
      }

      // Mark request as pending
      pendingRequestRef.current = selectedParentChildId;

      // Add timeout to prevent loader from showing forever (max 10 seconds)
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && pendingRequestRef.current === selectedParentChildId) {
          console.warn(`[PARENT_DASHBOARD] Fetch timeout for child: ${selectedParentChildId}`);
          setLoading(false);
          pendingRequestRef.current = null;
        }
      }, 10000);
      fetchTimerRef.current = timeoutId;

      try {
        console.log(`[PARENT_DASHBOARD] Fetching stats for child: ${selectedParentChildId}`);

        // Fetch attendance data
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', selectedParentChildId)
          .eq('school_id', user.schoolId);

        if (attendanceError) {
          console.error('[PARENT_DASHBOARD] Error fetching attendance:', attendanceError);
        }

        const attendanceStats = {
          present: attendanceData?.filter((a: { status: string }) => a.status === 'present').length || 0,
          absent: attendanceData?.filter((a: { status: string }) => a.status === 'absent').length || 0,
          late: attendanceData?.filter((a: { status: string }) => a.status === 'late').length || 0,
        };
        const totalAttendance = attendanceStats.present + attendanceStats.absent + attendanceStats.late;
        const attended = attendanceStats.present + attendanceStats.late;
        const attendancePercentage =
          totalAttendance > 0 ? Math.round((attended / totalAttendance) * 100) : 0;

        // Fetch grades data
        const { data: gradesData, error: gradesError } = await supabase
          .from('grades')
          .select('score, max_score')
          .eq('student_id', selectedParentChildId)
          .eq('school_id', user.schoolId);

        if (gradesError) {
          console.error('[PARENT_DASHBOARD] Error fetching grades:', gradesError);
        }

        const averageGrade =
          gradesData && gradesData.length > 0
            ? Math.round(
                gradesData.reduce((sum: number, g: { score?: number; max_score?: number }) => {
                  const max = g.max_score && g.max_score > 0 ? g.max_score : 100;
                  return sum + ((g.score || 0) / max) * 100;
                }, 0) / gradesData.length
              )
            : 0;

        // Fetch assignments data
        const { data: assignmentData, error: assignmentError } = await supabase
          .from('assignment_submissions')
          .select('status')
          .eq('student_id', selectedParentChildId)
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
          .eq('student_id', selectedParentChildId)
          .eq('school_id', user.schoolId);

        if (behaviourError) {
          console.error('[PARENT_DASHBOARD] Error fetching behaviour:', behaviourError);
        }

        const behaviourStats = {
          merits: behaviourData?.filter((b: any) => b.behaviour_type === 'merit' || b.behaviour_type === 'commendation').length || 0,
          demerits: behaviourData?.filter((b: any) => b.behaviour_type === 'demerit' || b.behaviour_type === 'warning').length || 0,
        };

        const { data: studentRow, error: studentError } = await supabase
          .from('students')
          .select('risk_level')
          .eq('id', selectedParentChildId)
          .eq('school_id', user.schoolId)
          .maybeSingle();

        if (studentError) {
          console.error('[PARENT_DASHBOARD] Error fetching student:', studentError);
        }

        const riskLevel = studentRow?.risk_level ?? 'low';

        const childClassId = user?.children?.find((c: Child) => c.id === selectedParentChildId)?.classId;
        const feeSummary = await feeAssignmentService.getStudentFeeSummary(
          user.schoolId,
          selectedParentChildId,
          { classId: childClassId }
        );
        const feeStatus = feeSummary.status;

        // Fetch recent assignments for the dashboard preview
        try {
          const assignments = await getStudentAssignments(user.schoolId, selectedParentChildId);
          const recent = assignments.slice(0, 3);
          setRecentAssignments(recent);
        } catch (error) {
          console.error('[PARENT_DASHBOARD] Error fetching recent assignments:', error);
        }

        // Only update state if component is still mounted and this is still the pending request
        if (isMountedRef.current && pendingRequestRef.current === selectedParentChildId) {
          setChildStats((prevStats) => ({
            ...prevStats,
            [selectedParentChildId]: {
              attendance: { ...attendanceStats, percentage: attendancePercentage },
              averageGrade: averageGrade,
              assignments: assignmentStats,
              behaviour: behaviourStats,
              feeStatus,
              riskLevel: riskLevel,
            },
          }));
          setLoading(false);

          // Clear pending request and timeout
          pendingRequestRef.current = null;
          if (fetchTimerRef.current) {
            clearTimeout(fetchTimerRef.current);
            fetchTimerRef.current = null;
          }
        }
      } catch (error) {
        console.error('[PARENT_DASHBOARD] Error fetching child stats:', error);
        if (isMountedRef.current) {
          setLoading(false);
        }
        pendingRequestRef.current = null;
        if (fetchTimerRef.current) {
          clearTimeout(fetchTimerRef.current);
          fetchTimerRef.current = null;
        }
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
  }, [selectedParentChildId]);

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

  const selectedChildClassName = useSelectedChildClassName();
  const selectedChild = user?.children?.find((c: Child) => c.id === selectedParentChildId);
  const hasMultipleChildren = (user?.children?.length ?? 0) > 1;

  useLayoutEffect(() => {
    const el = childRowRef.current;
    if (!el) return;

    const measure = () => {
      setChildRowHeight(el.getBoundingClientRect().height);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [selectedParentChildId, hasMultipleChildren, user?.children?.length]);

  const stats = childStats[selectedParentChildId || ''] || {
    attendance: { present: 0, absent: 0, late: 0, percentage: 0 },
    averageGrade: 0,
    assignments: { completed: 0, pending: 0, total: 0 },
    behaviour: { merits: 0, demerits: 0 },
    feeStatus: 'no_fee' as StudentFeeStatus,
    riskLevel: 'low',
  };

  // If no children are registered
  if (!user?.children || user.children.length === 0) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card card-hero"
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
            Your account is not linked to any student records yet. Please contact your school administrator to link your child.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner + child row + payment card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card card-hero overflow-hidden"
      >
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">Welcome, {user?.fullName}</h1>
            <p className="text-gray-300 dark:text-gray-600 text-sm lg:text-base max-w-xl">
              {hasMultipleChildren
                ? `${user?.children?.length} children linked — select a child to view their dashboard.`
                : selectedChildClassName
                  ? `Monitor ${selectedChild?.firstName}'s progress in ${selectedChildClassName}.`
                  : `Monitor ${selectedChild?.firstName}'s academic progress.`}
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6">
            <div ref={childRowRef} className="flex-1 min-w-0">
              <ParentChildSelector variant="hero" bare className="!mt-0" />
            </div>

            {user?.schoolId && selectedParentChildId && (
              <div
                className="w-full lg:w-[400px] shrink-0 lg:h-[var(--card-h)]"
                style={
                  childRowHeight
                    ? ({
                        '--child-row-h': `${childRowHeight}px`,
                        '--card-h': `${childRowHeight + VIRTUAL_CARD_TOP_EXTRA_PX}px`,
                      } as React.CSSProperties)
                    : undefined
                }
              >
                <VirtualAccountCard
                  embedded
                  className="h-full"
                  schoolId={user.schoolId}
                  studentId={selectedParentChildId}
                  classId={selectedChild?.classId}
                  studentName={
                    selectedChild
                      ? `${selectedChild.firstName} ${selectedChild.lastName}`
                      : undefined
                  }
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {loading && selectedParentChildId ? (
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
                <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
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
                <ClipboardList className="w-5 h-5 text-purple-600 dark:text-purple-400" />
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
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
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
                {getInitials(selectedChild?.firstName, selectedChild?.lastName)}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{selectedChild?.firstName} {selectedChild?.lastName}</h2>
                <p className="text-secondary-text">Student ID: {selectedChild?.studentId}</p>
                <div className="mt-2">
                  <ParentChildClassBadge className={selectedChildClassName} />
                </div>
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
                <p className="text-xs text-secondary-text mb-2">Fee status</p>
                <p className={`text-lg font-bold ${feeStatusToneClass(formatFeeStatusDisplay(stats.feeStatus).tone)}`}>
                  {formatFeeStatusDisplay(stats.feeStatus).label}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card text-center">
                <p className="text-2xl font-bold">{stats.attendance.late}</p>
                <p className="text-xs text-secondary-text mt-1">Late Arrivals</p>
              </div>
            </div>
          </motion.div>

          {/* Recent Assignments Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Recent Assignments</h3>
              <button
                onClick={() => navigate('/parent/assignments')}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View All →
              </button>
            </div>
            {recentAssignments.length > 0 ? (
              <div className="space-y-3">
                {recentAssignments.slice(0, 3).map((assignment) => {
                  const submission = assignment.submissions?.[0];
                  const submissionStatus = submission?.status || 'pending';
                  const isOverdue =
                    submissionStatus === 'pending' && new Date(assignment.due_date) < new Date();

                  return (
                    <div
                      key={assignment.id}
                      className={`p-3 rounded-lg border ${isOverdue
                        ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
                        : 'border-gray-200 dark:border-gray-700'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{assignment.title}</p>
                          <p className="text-xs text-secondary-text mt-1">
                            Due: {formatDate(assignment.due_date)}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${submissionStatus === 'graded'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                            : submissionStatus === 'submitted'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100'
                              : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100'
                            }`}
                        >
                          {isOverdue ? 'Overdue' : submissionStatus}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-secondary-text py-4">No assignments yet</p>
            )}
          </motion.div>

          {/* Quick Action Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate('/parent/attendance')}
              className="card hover:shadow-lg transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-6 h-6 text-blue-500 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="font-semibold">View Attendance</p>
                    <p className="text-sm text-secondary-text">See full attendance records</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-secondary-text group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => navigate('/parent/grades')}
              className="card hover:shadow-lg transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-6 h-6 text-green-500 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="font-semibold">View Grades</p>
                    <p className="text-sm text-secondary-text">See all academic grades</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-secondary-text group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => navigate('/parent/assignments')}
              className="card hover:shadow-lg transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-6 h-6 text-purple-500 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="font-semibold">View Assignments</p>
                    <p className="text-sm text-secondary-text">See all assignments</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-secondary-text group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={() => navigate('/parent/behaviour')}
              className="card hover:shadow-lg transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-orange-500 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="font-semibold">View Behaviour</p>
                    <p className="text-sm text-secondary-text">See behaviour records</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-secondary-text group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
          </div>
        </>
      )}
    </div>
  );
}
