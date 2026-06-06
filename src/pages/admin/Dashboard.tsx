import { motion } from 'framer-motion';
import {
  Users,
  GraduationCap,
  Building,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  CalendarDays,
  ClipboardCheck,
  Calendar,
  Clock,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { useAcademicCalendar } from '@/hooks';
import BirthdayWidget from '@/components/dashboard/BirthdayWidget';
import StudentUsageWidget from '@/components/dashboard/StudentUsageWidget';
import OnDutyWidget from '@/components/dashboard/OnDutyWidget';
import { getAcademicWeek, AcademicWeekInfo } from '@/utils/academicWeekUtils';
import { formatTime } from '@/utils/displayUtils';
import {
  countHighRiskStudents,
  fetchClassPerformanceChart,
  fetchWeeklyAttendanceChart,
  getAttendanceRate,
  getAverageGrade,
  getPendingFeesStudentCount,
} from '@/services/dashboardMetricsService';

interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  attendanceRate: number;
  averageGrade: number;
  highRiskStudents: number;
  pendingFees: number;
  openInterventions: number;
  studentsChange: string;
  staffChange: string;
  avgStudentsPerClass: number;
  attendanceChange: string;
  gradeChange: string;
  highRiskChange: string;
  pendingFeesCount: number;
  urgentInterventions: number;
}

interface ActivityLog {
  id: string;
  action: string;
  timestamp: string;
  type: 'attendance' | 'student' | 'risk' | 'payment' | 'other';
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const { currentSession, currentTerm, sessionName, termName, isLoading: calendarLoading } = useAcademicCalendar();
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  const [academicWeek, setAcademicWeek] = useState<AcademicWeekInfo>({
    weekNumber: 0,
    totalWeeks: 0,
    weekDisplay: 'Loading...',
    percentComplete: 0,
    dayInWeek: 0,
    isLastWeek: false,
  });
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalStaff: 0,
    totalClasses: 0,
    attendanceRate: 0,
    averageGrade: 0,
    highRiskStudents: 0,
    pendingFees: 0,
    openInterventions: 0,
    studentsChange: '+0',
    staffChange: 'All active',
    avgStudentsPerClass: 0,
    attendanceChange: '+0%',
    gradeChange: '+0%',
    highRiskChange: '-0',
    pendingFeesCount: 0,
    urgentInterventions: 0,
  });
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (user?.schoolId) {
      console.log('Dashboard: Setting schoolId from user:', user.schoolId);
      setSchoolId(user.schoolId);
    } else {
      console.log('Dashboard: No schoolId in user, current user:', user);
    }
  }, [user?.schoolId]);

  useEffect(() => {
    if (schoolId) {
      console.log('Dashboard: Fetching data for schoolId:', schoolId);
      fetchAllData();
    }
  }, [schoolId]);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update academic week when current term changes
  useEffect(() => {
    if (currentTerm?.start_date && currentTerm?.end_date) {
      const week = getAcademicWeek(currentTerm.start_date, currentTerm.end_date, new Date());
      setAcademicWeek(week);
    }
  }, [currentTerm]);

  // Silent auto-refresh every 60 seconds
  useEffect(() => {
    if (!schoolId) return;

    const refreshInterval = setInterval(() => {
      console.log('📊 Auto-refreshing dashboard data for schoolId:', schoolId);
      fetchAllData();
    }, 60000); // 60 seconds

    return () => clearInterval(refreshInterval);
  }, [schoolId]);

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const weekNumber = getWeekNumber(currentDateTime);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = days[currentDateTime.getDay()];
  const monthName = months[currentDateTime.getMonth()];
  const date = currentDateTime.getDate();
  const year = currentDateTime.getFullYear();
  const time = currentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const fetchAllData = async () => {
    if (!schoolId) {
      console.warn('⚠️ Dashboard: No schoolId available, skipping data fetch');
      return;
    }

    try {
      console.log('🔄 Dashboard: Starting data refresh for schoolId:', schoolId);
      await Promise.all([
        fetchStats(),
        fetchAttendanceData(),
        fetchRiskDistribution(),
        fetchPerformanceData(),
        fetchRecentActivity(),
      ]);
      console.log('✅ Dashboard: Data refresh completed');
    } catch (error) {
      console.error('❌ Dashboard: Error fetching data:', error);
    }
  };

  const fetchStats = async () => {
    try {
      console.log('Fetching stats for schoolId:', schoolId);

      // Get students
      const studentsRes = await supabase
        .from('students')
        .select('id, class_id, admission_date', { count: 'exact' })
        .eq('school_id', schoolId)
        .eq('status', 'active');

      const totalStudents = studentsRes.count || 0;
      console.log('Students response:', studentsRes);

      // Calculate students added this term (last 3 months)
      let studentsChange = '+0';
      if (studentsRes.data) {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const newStudents = studentsRes.data.filter((s: any) =>
          s.admission_date && new Date(s.admission_date) > threeMonthsAgo
        ).length;
        studentsChange = `+${newStudents} this term`;
      }

      // Get staff
      const staffRes = await supabase
        .from('staff')
        .select('id, is_active', { count: 'exact' })
        .eq('school_id', schoolId);

      const totalStaff = staffRes.count || 0;
      console.log('Staff response:', staffRes);

      // Calculate active staff
      let staffChange = 'All active';
      if (staffRes.data) {
        const activeStaff = staffRes.data.filter((s: any) => s.is_active === true).length;
        const inactiveStaff = totalStaff - activeStaff;
        if (inactiveStaff === 0) {
          staffChange = 'All active';
        } else {
          staffChange = `${inactiveStaff} inactive`;
        }
      }

      // Get classes
      const classesRes = await supabase
        .from('classes')
        .select('id', { count: 'exact' })
        .eq('school_id', schoolId);

      const totalClasses = classesRes.count || 0;
      console.log('Classes response:', classesRes);

      // Calculate average students per class
      let avgStudentsPerClass = 0;
      if (totalClasses > 0 && totalStudents > 0) {
        avgStudentsPerClass = Math.round(totalStudents / totalClasses);
      }

      const attendanceRate = await getAttendanceRate(schoolId, 7);
      const attendanceChange = attendanceRate > 0 ? `${attendanceRate}% (7d)` : 'No records yet';

      const averageGrade = await getAverageGrade(schoolId, 30);
      const gradeChange = averageGrade > 0 ? `${averageGrade}% avg (30d)` : 'No grades yet';

      const highRiskStudents = await countHighRiskStudents(schoolId);
      const highRiskChange =
        highRiskStudents > 0 ? `${highRiskStudents} need attention` : 'None flagged';

      const pendingFeesCount = await getPendingFeesStudentCount(schoolId);

      // Get interventions (open + in_progress cases from the live intervention engine)
      const interventionsRes = await supabase
        .from('intervention_cases')
        .select('id, status, priority', { count: 'exact' })
        .eq('school_id', schoolId)
        .in('status', ['open', 'in_progress', 'escalated']);

      const openInterventions = interventionsRes.count || 0;

      // Count urgent interventions
      let urgentInterventions = 0;
      if (interventionsRes.data) {
        urgentInterventions = interventionsRes.data.filter((i: any) => i.priority === 'high' || i.priority === 'critical').length;
      }

      // VALIDATE DATA INTEGRITY - Ensure no wrong data is displayed
      const validatedStats = {
        totalStudents: Math.max(0, totalStudents),
        totalStaff: Math.max(0, totalStaff),
        totalClasses: Math.max(0, totalClasses),
        averageGrade: Math.min(100, Math.max(0, averageGrade)),
        attendanceRate: Math.min(100, Math.max(0, attendanceRate)),
        highRiskStudents: Math.max(0, highRiskStudents),
        pendingFeesCount: Math.max(0, pendingFeesCount),
        openInterventions: Math.max(0, openInterventions),
      };

      console.log('✓ Data validation passed:', validatedStats);
      console.log('Setting stats:', {
        ...validatedStats,
        studentsChange,
        staffChange,
        avgStudentsPerClass,
        attendanceChange,
        gradeChange,
        highRiskChange,
        urgentInterventions,
      });

      setStats(prev => ({
        ...prev,
        totalStudents: validatedStats.totalStudents,
        studentsChange,
        totalStaff: validatedStats.totalStaff,
        staffChange,
        totalClasses: validatedStats.totalClasses,
        avgStudentsPerClass,
        attendanceRate: validatedStats.attendanceRate,
        attendanceChange,
        averageGrade: validatedStats.averageGrade,
        gradeChange,
        highRiskStudents: validatedStats.highRiskStudents,
        highRiskChange,
        pendingFees: validatedStats.pendingFeesCount,
        pendingFeesCount: validatedStats.pendingFeesCount,
        openInterventions: validatedStats.openInterventions,
        urgentInterventions,
      }));
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAttendanceData = async () => {
    if (!schoolId) return;
    try {
      const data = await fetchWeeklyAttendanceChart(schoolId);
      setAttendanceData(data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const fetchRiskDistribution = async () => {
    try {
      const { data: students } = await supabase
        .from('students')
        .select('risk_level')
        .eq('school_id', schoolId);

      const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
      students?.forEach((s: any) => {
        if (s.risk_level === 'low') riskCounts.low++;
        else if (s.risk_level === 'medium') riskCounts.medium++;
        else if (s.risk_level === 'high') riskCounts.high++;
        else if (s.risk_level === 'critical') riskCounts.critical++;
      });

      const distribution = [
        { name: 'Low Risk', value: riskCounts.low, color: '#22C55E' },
        { name: 'Medium Risk', value: riskCounts.medium, color: '#F59E0B' },
        { name: 'High Risk', value: riskCounts.high, color: '#EF4444' },
        { name: 'Critical', value: riskCounts.critical, color: '#DC2626' },
      ].filter(item => item.value > 0);

      setRiskDistribution(distribution);
    } catch (error) {
      console.error('Error fetching risk:', error);
    }
  };

  const fetchPerformanceData = async () => {
    if (!schoolId) return;
    try {
      const data = await fetchClassPerformanceChart(schoolId);
      setPerformanceData(data.map((p) => ({ name: p.class, score: p.average })));
    } catch (error) {
      console.error('Error fetching performance:', error);
    }
  };

  const fetchRecentActivity = async () => {
    if (!schoolId) {
      console.log('No schoolId, skipping activity fetch');
      return;
    }

    console.log('🔄 Fetching recent activities for schoolId:', schoolId);
    const allActivities: any[] = [];

    try {
      // 1. Students
      try {
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id, student_id, first_name, last_name, created_at, status')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (studentsError) throw studentsError;
        console.log('✓ Students:', students?.length || 0);
        if (students) {
          students.forEach((s: any) => {
            allActivities.push({
              id: `student-${s.id}`,
              action: `Added student ${s.first_name} ${s.last_name} (${s.student_id})`,
              timestamp: s.created_at,
              type: 'student' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Students error:', e);
      }

      // 2. Staff
      try {
        const { data: staff, error: staffError } = await supabase
          .from('staff')
          .select('id, full_name, created_at, is_active, role')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (staffError) throw staffError;
        console.log('✓ Staff:', staff?.length || 0);
        if (staff) {
          staff.forEach((s: any) => {
            allActivities.push({
              id: `staff-${s.id}`,
              action: `Added staff ${s.full_name} (${s.role})`,
              timestamp: s.created_at,
              type: 'student' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Staff error:', e);
      }

      // 3. Assignments
      try {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('assignments')
          .select('id, title, created_at, status, assignment_type')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (assignmentsError) throw assignmentsError;
        console.log('✓ Assignments:', assignments?.length || 0);
        if (assignments) {
          assignments.forEach((a: any) => {
            allActivities.push({
              id: `assignment-${a.id}`,
              action: `New assignment: ${a.title}`,
              timestamp: a.created_at,
              type: 'student' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Assignments error:', e);
      }

      // 4. Assignment Submissions
      try {
        const { data: submissions, error: submissionsError } = await supabase
          .from('assignment_submissions')
          .select('id, submitted_at, status')
          .eq('school_id', schoolId)
          .order('submitted_at', { ascending: false })
          .limit(10);
        if (submissionsError) throw submissionsError;
        console.log('✓ Submissions:', submissions?.length || 0);
        if (submissions) {
          submissions.forEach((sub: any) => {
            allActivities.push({
              id: `submission-${sub.id}`,
              action: `Assignment ${sub.status}`,
              timestamp: sub.submitted_at,
              type: 'student' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Submissions error:', e);
      }

      // 5. Grades
      try {
        const { data: grades, error: gradesError } = await supabase
          .from('grades')
          .select('id, created_at, score, assessment_type')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (gradesError) throw gradesError;
        console.log('✓ Grades:', grades?.length || 0);
        if (grades) {
          grades.forEach((g: any) => {
            allActivities.push({
              id: `grade-${g.id}`,
              action: `Grade: ${g.score}% (${g.assessment_type})`,
              timestamp: g.created_at,
              type: 'student' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Grades error:', e);
      }

      // 6. Attendance
      try {
        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance')
          .select('id, created_at, status, date')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (attendanceError) throw attendanceError;
        console.log('✓ Attendance:', attendance?.length || 0);
        if (attendance) {
          attendance.forEach((a: any) => {
            allActivities.push({
              id: `attendance-${a.id}`,
              action: `Attendance: ${a.status}`,
              timestamp: a.created_at,
              type: 'attendance' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Attendance error:', e);
      }

      // 7. Behaviour Records
      try {
        const { data: behaviour, error: behaviourError } = await supabase
          .from('behaviour_records')
          .select('id, created_at, behaviour_type, description')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (behaviourError) throw behaviourError;
        console.log('✓ Behaviour:', behaviour?.length || 0);
        if (behaviour) {
          behaviour.forEach((b: any) => {
            allActivities.push({
              id: `behaviour-${b.id}`,
              action: `${b.behaviour_type}`,
              timestamp: b.created_at,
              type: 'risk' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Behaviour error:', e);
      }

      // 8. Payments
      try {
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('id, created_at, amount, payment_method, status')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (paymentsError) throw paymentsError;
        console.log('✓ Payments:', payments?.length || 0);
        if (payments) {
          payments.forEach((p: any) => {
            allActivities.push({
              id: `payment-${p.id}`,
              action: `Payment: ₦${p.amount}`,
              timestamp: p.created_at,
              type: 'payment' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Payments error:', e);
      }

      // 9. Risk Assessments
      try {
        const { data: risks, error: risksError } = await supabase
          .from('risk_scores')
          .select('id, created_at, risk_level')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (risksError) throw risksError;
        console.log('✓ Risk assessments:', risks?.length || 0);
        if (risks) {
          risks.forEach((r: any) => {
            allActivities.push({
              id: `risk-${r.id}`,
              action: `Risk: ${r.risk_level}`,
              timestamp: r.created_at,
              type: 'risk' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Risk error:', e);
      }

      // 10. Interventions
      try {
        const { data: interventions, error: interventionsError } = await supabase
          .from('intervention_cases')
          .select('id, created_at, case_title, status, priority')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (interventionsError) throw interventionsError;
        console.log('✓ Interventions:', interventions?.length || 0);
        if (interventions) {
          interventions.forEach((i: any) => {
            allActivities.push({
              id: `intervention-${i.id}`,
              action: `Intervention: ${i.case_title}`,
              timestamp: i.created_at,
              type: 'risk' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Interventions error:', e);
      }

      // 11. Intervention Meetings
      try {
        const { data: meetings, error: meetingsError } = await supabase
          .from('intervention_meetings')
          .select('id, created_at, meeting_type, status')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (meetingsError) throw meetingsError;
        console.log('✓ Meetings:', meetings?.length || 0);
        if (meetings) {
          meetings.forEach((m: any) => {
            allActivities.push({
              id: `meeting-${m.id}`,
              action: `Meeting: ${m.meeting_type}`,
              timestamp: m.created_at,
              type: 'risk' as const,
            });
          });
        }
      } catch (e) {
        console.warn('⚠️ Meetings error:', e);
      }

      // Sort and display
      const sortedActivities = allActivities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8);

      console.log('========================================');
      console.log(`📊 Total activities: ${allActivities.length}`);
      console.log(`📋 Displaying: ${sortedActivities.length}`);
      console.log('========================================');
      console.log(sortedActivities);
      setRecentActivity(sortedActivities);
    } catch (error) {
      console.error('Fatal error fetching activities:', error);
    }
  };

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, change: stats.studentsChange },
    { label: 'Total Staff', value: stats.totalStaff, icon: GraduationCap, change: stats.staffChange },
    { label: 'Classes', value: stats.totalClasses, icon: Building, change: `${stats.avgStudentsPerClass} students avg` },
    { label: 'Attendance Rate', value: `${stats.attendanceRate}%`, icon: CalendarDays, change: stats.attendanceChange, trend: 'up' },
    { label: 'Average Grade', value: `${stats.averageGrade}%`, icon: ClipboardCheck, change: stats.gradeChange, trend: 'up' },
    { label: 'High Risk', value: stats.highRiskStudents, icon: AlertTriangle, change: stats.highRiskChange, isAlert: true },
    { label: 'Pending Fees', value: stats.pendingFeesCount, icon: DollarSign, change: `${stats.pendingFeesCount} students` },
    { label: 'Interventions', value: stats.openInterventions, icon: TrendingUp, change: `${stats.urgentInterventions} urgent` },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card bg-gradient-to-br from-gray-900 to-black text-white">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left Section: Welcome & Info */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1">Welcome back, {user?.fullName?.split(' ')[0] || 'Admin'}</h1>
            <p className="text-gray-300 mb-3 text-sm">Here's your school overview for today</p>

            {/* Academic Session and Term Info */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>
                  <span className="font-semibold">Session:</span> {calendarLoading ? 'Loading...' : sessionName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>
                  <span className="font-semibold">Term:</span> {calendarLoading ? 'Loading...' : (currentTerm?.name || 'Not Set')}
                </span>
              </div>
            </div>
          </div>

          {/* Middle Section: Real-time Date/Time/Academic Week */}
          <div className="bg-gray-800/50 rounded-lg px-3 py-2 backdrop-blur-sm border border-gray-700 flex-shrink-0 min-w-max">
            <div className="flex flex-col gap-2 text-xs">
              {/* Time Line */}
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="font-mono font-bold text-red-400">{time}</span>
              </div>

              {/* Date Line */}
              <div className="flex items-center gap-1.5 text-gray-300 whitespace-nowrap">
                <span className="font-semibold">{dayName}</span>
                <span className="text-gray-500">•</span>
                <span className="font-semibold text-blue-400">{date}</span>
                <span className="text-gray-500">•</span>
                <span>{monthName.slice(0, 3)}</span>
                <span className="text-gray-500">•</span>
                <span>{year}</span>
              </div>

              {/* Academic Week Line */}
              <div className="flex items-center gap-2">
                <div className="w-20 bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-yellow-400 to-orange-400 h-full rounded-full transition-all"
                    style={{ width: `${Math.max(5, academicWeek.percentComplete)}%` }}
                  />
                </div>
                <span className="font-semibold text-yellow-400 whitespace-nowrap text-xs px-2 py-0.5 bg-yellow-900/30 rounded">
                  {academicWeek.weekDisplay}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="card">
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-xl bg-secondary-bg">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-secondary-text">{stat.change}</span>
              </div>
              <div className="mt-3">
                <p className="stat-label">{stat.label}</p>
                <p className="stat-value">{stat.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card">
          <h3 className="font-semibold mb-4">Weekly Attendance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData.length > 0 ? attendanceData : [{ day: 'Mon', present: 0, absent: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="present" fill="#16A34A" />
                <Bar dataKey="absent" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card">
          <h3 className="font-semibold mb-4">Risk Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution.length > 0 ? riskDistribution : [{ name: 'No data', value: 1 }]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="mb-6">
        <StudentUsageWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {schoolId && <OnDutyWidget schoolId={schoolId} />}
        <BirthdayWidget />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="card">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => navigate('/admin/students')} className="p-4 rounded-xl bg-secondary-bg hover:bg-gray-200 text-left">
              <Users className="w-5 h-5 mb-2" />
              <p className="font-medium text-sm">Add Student</p>
            </button>
            <button onClick={() => navigate('/admin/staff')} className="p-4 rounded-xl bg-secondary-bg hover:bg-gray-200 text-left">
              <GraduationCap className="w-5 h-5 mb-2" />
              <p className="font-medium text-sm">Add Staff</p>
            </button>
            <button onClick={() => navigate('/attendance')} className="p-4 rounded-xl bg-secondary-bg hover:bg-gray-200 text-left">
              <CalendarDays className="w-5 h-5 mb-2" />
              <p className="font-medium text-sm">Attendance</p>
            </button>
            <button onClick={() => navigate('/admin/subscriptions')} className="p-4 rounded-xl bg-secondary-bg hover:bg-gray-200 text-left">
              <DollarSign className="w-5 h-5 mb-2" />
              <p className="font-medium text-sm">Plans</p>
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="card">
          <h3 className="font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
            {recentActivity.length > 0 ? (
              recentActivity.map(activity => (
                <div key={activity.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary-bg">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.action}</p>
                    <p className="text-xs text-secondary-text">{formatTime(activity.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-secondary-text">No recent activity</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
