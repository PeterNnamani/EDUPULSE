import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  AlertTriangle,
  TrendingUp,
  BookOpen,
  CalendarDays,
  Activity,
  Loader2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { useAppStore } from '@/store';
import { useAcademicCalendar } from '@/hooks';
import {
  fetchPrincipalDashboard,
  type PrincipalDashboardData,
  type PrincipalAlert,
} from '@/services/principalDashboardService';
import OnDutyWidget from '@/components/dashboard/OnDutyWidget';

export default function PrincipalDashboard() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const { sessionName, termName, isLoading: calendarLoading } = useAcademicCalendar();
  const [data, setData] = useState<PrincipalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPrincipalDashboard(user.schoolId);
      setData(result);
    } catch (e) {
      console.error('[Principal] Dashboard load failed:', e);
      setError('Unable to load school overview. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!user?.schoolId) return;
    const interval = setInterval(loadDashboard, 60000);
    return () => clearInterval(interval);
  }, [user?.schoolId, loadDashboard]);

  const metrics = data?.metrics;
  const keyMetrics = metrics
    ? [
        { label: 'Total Students', value: metrics.totalStudents, change: metrics.studentsChange, icon: Users },
        { label: 'Total Staff', value: metrics.totalStaff, change: metrics.staffChange, icon: GraduationCap },
        {
          label: 'Attendance Rate',
          value: `${metrics.attendanceRate}%`,
          change: metrics.attendanceChange,
          icon: CalendarDays,
          trend: 'up' as const,
        },
        {
          label: 'Avg Performance',
          value: metrics.averageGrade ? `${metrics.averageGrade}%` : '—',
          change: metrics.gradeChange,
          icon: Activity,
          trend: 'up' as const,
        },
        {
          label: 'High Risk',
          value: metrics.highRiskStudents,
          change: metrics.highRiskChange,
          icon: AlertTriangle,
          trend: 'down' as const,
          isAlert: true,
        },
        {
          label: 'Open Cases',
          value: metrics.openCases,
          change: metrics.openCasesChange,
          icon: BookOpen,
          trend: 'down' as const,
        },
      ]
    : [];

  const sessionLabel =
    calendarLoading || !sessionName
      ? 'Academic session'
      : `${sessionName}${termName ? ` • ${termName}` : ''}`;

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-secondary-text" />
        <p className="text-secondary-text">Loading school overview…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-white text-white dark:text-black"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Welcome{(user?.fullName || user?.name) ? `, ${(user.fullName || user.name || '').split(' ')[0]}` : ''}
            </h1>
            <p className="text-gray-300 dark:text-gray-600 text-sm">{sessionLabel}</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Principal overview — read-only insights</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{metrics?.attendanceRate ?? 0}%</p>
                <p className="text-xs text-gray-300 dark:text-gray-600">Attendance (7d)</p>
              </div>
              <div className="w-px h-12 bg-gray-700 dark:bg-gray-300" />
              <div className="text-center">
                <p className="text-3xl font-bold">{metrics?.averageGrade ?? '—'}%</p>
                <p className="text-xs text-gray-300 dark:text-gray-600">Performance (30d)</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadDashboard}
              className="p-2 rounded-lg bg-white/10 dark:bg-black/10 hover:bg-white/20 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="card border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {keyMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`card ${metric.isAlert ? 'border-yellow-200 dark:border-yellow-900' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`p-2 rounded-lg ${metric.isAlert ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-secondary-bg dark:bg-dark-card'}`}
                >
                  <Icon
                    className={`w-4 h-4 ${metric.isAlert ? 'text-yellow-600 dark:text-yellow-400' : 'text-black dark:text-white'}`}
                  />
                </div>
                <span className="text-xs font-medium text-secondary-text truncate max-w-[80px]">
                  {metric.change}
                </span>
              </div>
              <p className="stat-value text-xl">{metric.value}</p>
              <p className="text-xs text-secondary-text">{metric.label}</p>
            </motion.div>
          );
        })}
      </div>

      {user?.schoolId && <OnDutyWidget schoolId={user.schoolId} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h3 className="font-semibold mb-4">Performance Trends</h3>
          {data?.monthlyTrends?.length ? (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                      }}
                    />
                    <Line type="monotone" dataKey="attendance" stroke="#16A34A" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="performance" stroke="#000" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="behaviour" stroke="#6B7280" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                <LegendDot color="bg-green-500" label="Attendance" />
                <LegendDot color="bg-black dark:bg-white" label="Performance" />
                <LegendDot color="bg-gray-400" label="Behaviour" />
              </div>
            </>
          ) : (
            <EmptyChart message="Trend data will appear as attendance, grades, and behaviour are recorded." />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Risk Distribution Trend</h3>
            <Link to="/risk" className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline">
              Full analysis <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {data?.riskTrend?.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.riskTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="week" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                    }}
                  />
                  <Area type="monotone" dataKey="low" stackId="1" stroke="#22C55E" fill="#22C55E" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="medium" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="high" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="No risk scores recorded yet for your school." />
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Class Rankings</h3>
            <button
              type="button"
              onClick={() => navigate('/principal/students')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View students
            </button>
          </div>
          {data?.classRankings?.length ? (
            <div className="space-y-3">
              {data.classRankings.map((cls, index) => (
                <div key={cls.class} className="flex items-center gap-4">
                  <RankBadge index={index} />
                  <div className="flex-1">
                    <p className="font-medium">{cls.class}</p>
                    <p className="text-xs text-secondary-text">{cls.students} students</p>
                  </div>
                  <p className="font-bold">{cls.average > 0 ? `${cls.average}%` : '—'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary-text py-8 text-center">No class grade data available yet.</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
          <h3 className="font-semibold mb-4">Subject Performance</h3>
          {data?.subjectPerformance?.length ? (
            <div className="space-y-3">
              {data.subjectPerformance.map((subject) => (
                <div key={subject.subject} className="flex items-center gap-3">
                  <div className="w-24">
                    <p className="text-sm font-medium truncate">{subject.subject}</p>
                  </div>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black dark:bg-white rounded-full transition-all"
                      style={{ width: `${subject.score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-10">{subject.score}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary-text py-8 text-center">No subject grades recorded yet.</p>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent Alerts</h3>
          <button
            type="button"
            onClick={() => navigate('/risk')}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all risk data
          </button>
        </div>
        {data?.alerts?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.alerts.slice(0, 3).map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary-text py-6 text-center">
            No active alerts. Your school risk profile looks stable.
          </p>
        )}
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink label="Students" path="/principal/students" />
        <QuickLink label="Staff" path="/principal/staff" />
        <QuickLink label="Attendance" path="/principal/attendance" />
        <QuickLink label="Reports" path="/reports" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-xs text-secondary-text">{label}</span>
    </div>
  );
}

function RankBadge({ index }: { index: number }) {
  const cls =
    index === 0
      ? 'bg-yellow-100 text-yellow-700'
      : index === 1
        ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
        : index === 2
          ? 'bg-orange-100 text-orange-700'
          : 'bg-secondary-bg text-secondary-text';
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${cls}`}>
      {index + 1}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-72 flex items-center justify-center text-center px-6">
      <p className="text-sm text-secondary-text">{message}</p>
    </div>
  );
}

function AlertCard({ alert }: { alert: PrincipalAlert }) {
  const styles = {
    critical: {
      box: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900',
      icon: 'text-red-500',
      title: 'text-red-700 dark:text-red-400',
      text: 'text-red-600 dark:text-red-300',
    },
    warning: {
      box: 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900',
      icon: 'text-yellow-600',
      title: 'text-yellow-700 dark:text-yellow-400',
      text: 'text-yellow-600 dark:text-yellow-300',
    },
    positive: {
      box: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900',
      icon: 'text-green-600',
      title: 'text-green-700 dark:text-green-400',
      text: 'text-green-600 dark:text-green-300',
    },
  }[alert.type];

  const Icon = alert.type === 'positive' ? Activity : alert.type === 'warning' ? TrendingUp : AlertTriangle;

  return (
    <div className={`p-4 rounded-xl border ${styles.box}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${styles.icon}`} />
        <span className={`font-medium text-sm ${styles.title}`}>{alert.title}</span>
      </div>
      <p className={`text-sm line-clamp-3 ${styles.text}`}>{alert.description}</p>
    </div>
  );
}

function QuickLink({ label, path }: { label: string; path: string }) {
  return (
    <Link
      to={path}
      className="card py-3 px-4 text-sm font-medium hover:shadow-md transition-shadow flex items-center justify-between"
    >
      {label}
      <ChevronRight className="w-4 h-4 text-secondary-text" />
    </Link>
  );
}
