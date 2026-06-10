import { motion } from 'framer-motion';
import { AlertTriangle, Users, Calendar, MessageSquare, CheckCircle, Clock, UserX, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { interventionService, type InterventionStatus } from '@/services/interventionService';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/utils/displayUtils';

interface CaseWithStudent {
  id: string;
  student: string;
  class: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  daysOpen: number;
  lastContact: string;
  status: InterventionStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
}

interface Meeting {
  time: string;
  student: string;
  type: string;
  duration: string;
}

export default function CounselorDashboard() {
  const { user } = useAppStore();
  const navigate = useNavigate();

  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [openCases, setOpenCases] = useState<CaseWithStudent[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [recentInterventions, setRecentInterventions] = useState<any[]>([]);
  const [riskStats, setRiskStats] = useState([
    { label: 'Critical Risk', value: 0, color: 'bg-red-500' },
    { label: 'High Risk', value: 0, color: 'bg-orange-500' },
    { label: 'Medium Risk', value: 0, color: 'bg-yellow-500' },
    { label: 'Low Risk', value: 0, color: 'bg-green-500' },
  ]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id && user?.schoolId) {
      fetchCounselorData();
    }
  }, [user?.id, user?.schoolId]);

  const fetchCounselorData = async () => {
    try {
      setIsLoading(true);

      // Get counselor's cases
      const cases = await interventionService.getCounselorCases(user!.schoolId, user!.id);

      // Fetch student details for each case
      const casesWithStudents = await Promise.all(
        cases.map(async (caseItem) => {
          try {
            // Fetch student data
            const { data: student } = await supabase
              .from('students')
              .select('first_name, last_name, class_id')
              .eq('id', caseItem.studentId)
              .eq('school_id', user!.schoolId)
              .single();

            // Fetch class name
            let className = 'N/A';
            if (student?.class_id) {
              const { data: classData } = await supabase
                .from('classes')
                .select('name')
                .eq('id', student.class_id)
                .eq('school_id', user!.schoolId)
                .single();
              className = classData?.name || 'N/A';
            }

            // Calculate days open
            const createdDate = new Date(caseItem.createdAt);
            const today = new Date();
            const daysOpen = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

            // Get last activity for "last contact"
            const activities = await interventionService.getCaseActivities(user!.schoolId, caseItem.id);
            let lastContact = 'Never';
            if (activities.length > 0) {
              const lastActivityDate = new Date(activities[0].activityDate);
              const daysDiff = Math.floor((today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysDiff === 0) lastContact = 'Today';
              else if (daysDiff === 1) lastContact = '1 day ago';
              else lastContact = `${daysDiff} days ago`;
            }

            // Map priority to risk level
            const riskMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
              critical: 'critical',
              high: 'high',
              medium: 'medium',
              low: 'low'
            };

            return {
              id: caseItem.id,
              student: student ? `${student.first_name} ${student.last_name}` : 'Unknown',
              class: className,
              risk: riskMap[caseItem.priority] || 'medium',
              type: caseItem.caseCategory.replace('_intervention', '').replace('_', ' ').toUpperCase(),
              daysOpen,
              lastContact,
              status: caseItem.status,
              priority: caseItem.priority,
              createdAt: caseItem.createdAt
            };
          } catch (error) {
            console.error('Error fetching case details:', error);
            return null;
          }
        })
      );

      // Filter out null values
      const validCases = casesWithStudents.filter((c): c is NonNullable<typeof c> => c !== null);
      setOpenCases(validCases);

      // School-wide risk distribution (students table, same as risk engine)
      const { data: schoolStudents } = await supabase
        .from('students')
        .select('risk_level')
        .eq('school_id', user!.schoolId)
        .eq('status', 'active');

      const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const s of schoolStudents ?? []) {
        const level = (s.risk_level as keyof typeof riskCounts) || 'low';
        if (level in riskCounts) riskCounts[level]++;
        else riskCounts.low++;
      }

      setRiskStats([
        { label: 'Critical Risk', value: riskCounts.critical, color: 'bg-red-500' },
        { label: 'High Risk', value: riskCounts.high, color: 'bg-orange-500' },
        { label: 'Medium Risk', value: riskCounts.medium, color: 'bg-yellow-500' },
        { label: 'Low Risk', value: riskCounts.low, color: 'bg-green-500' },
      ]);

      // Get recent interventions
      const recentCases = validCases.slice(0, 5);
      const interventions = recentCases.map((caseItem) => ({
        student: caseItem.student,
        intervention: caseItem.type,
        status: caseItem.status,
        date: formatDate(caseItem.createdAt),
      }));
      setRecentInterventions(interventions);

      const todayStr = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: activities } = await supabase
        .from('intervention_activities')
        .select('*')
        .eq('school_id', user!.schoolId)
        .eq('status', 'scheduled')
        .gte('scheduled_date', todayStr)
        .lt('scheduled_date', tomorrowStr)
        .order('scheduled_date', { ascending: true })
        .limit(5);

      if (activities) {
        const meetings: Meeting[] = [];
        for (const activity of activities) {
          const caseData = validCases.find(c => c.id === activity.case_id);
          if (caseData) {
            const scheduledTime = new Date(activity.scheduled_date);
            meetings.push({
              time: scheduledTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              student: caseData.student,
              type: activity.activity_type.replace('_', ' ').toUpperCase(),
              duration: `${activity.duration_minutes || 30} min`
            });
          }
        }
        setUpcomingMeetings(meetings);
      }
    } catch (error) {
      console.error('Error fetching counselor data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card card-hero"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Counselor Dashboard</h1>
            <p className="text-gray-300 dark:text-gray-600">
              You have {openCases.length} open case{openCases.length !== 1 ? 's' : ''} requiring attention
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="px-4 py-2 rounded-lg bg-white/10 dark:bg-black/10">
              <p className="text-3xl font-bold">{openCases.length}</p>
              <p className="text-xs opacity-70">Open Cases</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open Cases', value: openCases.length, icon: FileText, tint: 'blue' as const },
          { label: 'Critical Risk', value: riskStats[0]?.value || 0, icon: AlertTriangle, tint: 'red' as const, isAlert: true },
          { label: 'Meetings Today', value: upcomingMeetings.length, icon: Calendar, tint: 'purple' as const },
          { label: 'High Risk', value: riskStats[1]?.value || 0, icon: Users, tint: 'orange' as const },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`card ${stat.isAlert ? 'border-red-200 dark:border-red-900' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`dashboard-icon-box icon-tint-${stat.tint}`}>
                  <Icon className={`dashboard-icon icon-color-${stat.tint}`} />
                </div>
                <div>
                  <p className="stat-label text-xs">{stat.label}</p>
                  <p className={`stat-value text-xl ${stat.isAlert ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Risk Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Risk Distribution</h3>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {riskStats.map((stat) => {
              const total = riskStats.reduce((sum, s) => sum + s.value, 0) || 1;
              return (
                <div key={stat.label} className="flex items-center gap-3">
                  <div className="w-32">
                    <span className="text-sm font-medium">{stat.label}</span>
                  </div>
                  <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${stat.color} rounded-full transition-all flex items-center justify-end pr-2`}
                      style={{ width: `${(stat.value / total) * 100}%` }}
                    >
                      <span className="text-xs font-medium text-white">{stat.value}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Open Cases */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Open Cases</h3>
            <button onClick={() => navigate('/interventions')} className="text-sm text-black dark:text-white hover:underline">View All</button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
            </div>
          ) : openCases.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-secondary-text">No open cases at the moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedCase === caseItem.id
                    ? 'border-black dark:border-white bg-secondary-bg dark:bg-dark-card'
                    : 'border-border dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
                    }`}
                  onClick={() => setSelectedCase(caseItem.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="font-medium">{caseItem.student.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium">{caseItem.student}</p>
                        <p className="text-sm text-secondary-text">{caseItem.class} • {caseItem.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`badge ${caseItem.risk === 'critical' ? 'badge-danger' :
                        caseItem.risk === 'high' ? 'badge-warning' :
                          'badge-info'
                        }`}>
                        {caseItem.risk}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-secondary-text">Opened {caseItem.daysOpen} days ago</span>
                    <span className="text-secondary-text">Last contact: {caseItem.lastContact}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Upcoming Meetings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Today's Schedule</h3>
            <button onClick={() => navigate('/interventions?new=1')} className="text-sm text-black dark:text-white hover:underline">Add</button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
            </div>
          ) : upcomingMeetings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-secondary-text">No scheduled meetings today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting, index) => (
                <div key={index} className="p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                  <div className="flex items-center gap-3">
                    <div className="w-12 text-center">
                      <p className="text-sm font-medium">{meeting.time}</p>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{meeting.student}</p>
                      <p className="text-xs text-secondary-text">{meeting.type} • {meeting.duration}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Interventions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Recent Interventions</h3>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
          </div>
        ) : recentInterventions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-secondary-text">No recent interventions</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left rounded-l-lg">Student</th>
                  <th className="px-4 py-3 text-left">Intervention</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left rounded-r-lg">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentInterventions.map((item, index) => (
                  <tr key={index} className="table-row">
                    <td className="px-4 py-3 font-medium">{item.student}</td>
                    <td className="px-4 py-3 text-secondary-text">{item.intervention}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${item.status === 'completed' ? 'badge-success' :
                        item.status === 'in_progress' ? 'badge-warning' :
                          item.status === 'open' ? 'badge-danger' :
                            'badge-info'
                        }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary-text">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button onClick={() => navigate('/interventions?new=1')} className="quick-action-btn">
            <UserX className="quick-action-icon icon-color-red" />
            <span className="text-sm font-medium">New Case</span>
          </button>
          <button onClick={() => navigate('/interventions')} className="quick-action-btn">
            <Calendar className="quick-action-icon icon-color-purple" />
            <span className="text-sm font-medium">Schedule Meeting</span>
          </button>
          <button onClick={() => navigate('/interventions')} className="quick-action-btn">
            <MessageSquare className="quick-action-icon icon-color-blue" />
            <span className="text-sm font-medium">Contact Parent</span>
          </button>
          <button onClick={() => navigate('/interventions')} className="quick-action-btn">
            <CheckCircle className="quick-action-icon icon-color-green" />
            <span className="text-sm font-medium">Close Case</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
