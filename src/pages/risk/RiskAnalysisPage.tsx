import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, Users, Activity, BarChart3, Loader } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart as RechartsPie, Pie, Cell } from 'recharts';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { riskDetectionService } from '@/services/riskDetectionService';

interface RiskStudent {
  id: string;
  name: string;
  class: string;
  risk: string;
  score: number;
  factors: string[];
}

export default function RiskAnalysisPage() {
  const { user } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [riskFactors, setRiskFactors] = useState<any[]>([
    { factor: 'Attendance', value: 65 },
    { factor: 'Academic', value: 58 },
    { factor: 'Behaviour', value: 72 },
    { factor: 'Assignments', value: 68 },
    { factor: 'Fee Payment', value: 45 },
  ]);
  const [riskDistribution, setRiskDistribution] = useState<any[]>([
    { name: 'Low Risk', value: 0, color: '#22C55E' },
    { name: 'Medium Risk', value: 0, color: '#F59E0B' },
    { name: 'High Risk', value: 0, color: '#EF4444' },
    { name: 'Critical', value: 0, color: '#DC2626' },
  ]);
  const [highRiskStudents, setHighRiskStudents] = useState<RiskStudent[]>([]);
  const [riskStats, setRiskStats] = useState({
    lowRisk: 0,
    mediumRisk: 0,
    highRisk: 0,
    critical: 0,
  });
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessMessage, setAssessMessage] = useState('');

  useEffect(() => {
    if (user?.id && user?.schoolId) {
      loadRealData();
    }
  }, [user?.id, user?.schoolId]);

  const loadRealData = async () => {
    try {
      setIsLoading(true);
      console.log('[RISK] Loading risk data for school:', user!.schoolId);

      // Get all students
      const { data: allStudents, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id')
        .eq('school_id', user!.schoolId);

      console.log('[RISK] Students fetched:', allStudents?.length, 'Error:', studentsError);

      if (!allStudents || allStudents.length === 0) {
        console.warn('[RISK] No students found');
        setIsLoading(false);
        return;
      }

      // Get classes
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', user!.schoolId);

      const classMap = new Map(classesData?.map((c) => [c.id, c.name]) || []);

      // Get risk scores
      const { data: riskScores } = await supabase
        .from('risk_scores')
        .select('*')
        .eq('school_id', user!.schoolId)
        .order('last_calculated', { ascending: false });

      console.log('[RISK] Risk scores found:', riskScores?.length);

      // Create student risk map
      const riskMap = new Map();
      riskScores?.forEach(r => {
        riskMap.set(r.student_id, r);
      });

      // Build risk students list
      const riskStudents: RiskStudent[] = [];
      const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };

      allStudents.forEach(student => {
        const risk = riskMap.get(student.id);
        if (risk) {
          const riskLevel = risk.risk_level || 'low';
          riskCounts[riskLevel as keyof typeof riskCounts]++;

          riskStudents.push({
            id: student.id,
            name: `${student.first_name} ${student.last_name}`,
            class: classMap.get(student.class_id) || 'N/A',
            risk: riskLevel,
            score: Math.round(risk.overall_risk || 0),
            factors: [
              `Attendance: ${Math.round(risk.attendance_risk || 0)}%`,
              `Academic: ${Math.round(risk.academic_risk || 0)}%`,
              `Behaviour: ${Math.round(risk.behaviour_risk || 0)}%`,
              `Assignments: ${Math.round(risk.assignment_risk || 0)}%`,
              `Fees: ${Math.round(risk.fee_risk || 0)}%`
            ]
          });
        }
      });

      // Sort by score (highest risk first) and get top 4
      riskStudents.sort((a, b) => b.score - a.score);
      const topAtRisk = riskStudents.filter(s => s.risk === 'critical' || s.risk === 'high').slice(0, 4);

      console.log('[RISK] Top at-risk students:', topAtRisk.length);
      console.log('[RISK] Risk counts:', riskCounts);

      // Update state
      setHighRiskStudents(topAtRisk);
      setRiskStats({
        critical: riskCounts.critical,
        highRisk: riskCounts.high,
        mediumRisk: riskCounts.medium,
        lowRisk: riskCounts.low,
      });

      setRiskDistribution([
        { name: 'Low Risk', value: riskCounts.low, color: '#22C55E' },
        { name: 'Medium Risk', value: riskCounts.medium, color: '#F59E0B' },
        { name: 'High Risk', value: riskCounts.high, color: '#EF4444' },
        { name: 'Critical', value: riskCounts.critical, color: '#DC2626' },
      ]);

      // Calculate average risk factors
      if (riskScores && riskScores.length > 0) {
        const avgAttendance = riskScores.reduce((sum, r) => sum + (r.attendance_risk || 0), 0) / riskScores.length;
        const avgAcademic = riskScores.reduce((sum, r) => sum + (r.academic_risk || 0), 0) / riskScores.length;
        const avgBehaviour = riskScores.reduce((sum, r) => sum + (r.behaviour_risk || 0), 0) / riskScores.length;
        const avgAssignments = riskScores.reduce((sum, r) => sum + (r.assignment_risk || 0), 0) / riskScores.length;
        const avgFees = riskScores.reduce((sum, r) => sum + (r.fee_risk || 0), 0) / riskScores.length;

        setRiskFactors([
          { factor: 'Attendance', value: Math.round(avgAttendance) },
          { factor: 'Academic', value: Math.round(avgAcademic) },
          { factor: 'Behaviour', value: Math.round(avgBehaviour) },
          { factor: 'Assignments', value: Math.round(avgAssignments) },
          { factor: 'Fee Payment', value: Math.round(avgFees) },
        ]);
      }

      console.log('[RISK] Data loading complete');
    } catch (error) {
      console.error('[RISK] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runFullAssessment = async () => {
    if (!user?.schoolId) return;
    setIsAssessing(true);
    setAssessMessage('');
    try {
      const { processed, errors } = await riskDetectionService.recalculateSchool(user.schoolId);
      setAssessMessage(
        errors > 0
          ? `Assessed ${processed} students (${errors} could not be scored).`
          : `Risk assessment complete for ${processed} students.`
      );
      await loadRealData();
    } catch (e) {
      console.error('[RISK] Assessment failed:', e);
      setAssessMessage('Risk assessment failed. Check console and ensure migrations are applied.');
    } finally {
      setIsAssessing(false);
    }
  };

  const total = riskStats.lowRisk + riskStats.mediumRisk + riskStats.highRisk + riskStats.critical || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Risk Analysis</h1>
          <p className="text-secondary-text">AI-powered student risk monitoring</p>
          {assessMessage && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">{assessMessage}</p>
          )}
        </div>
        <button
          onClick={runFullAssessment}
          disabled={isAssessing || isLoading}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          {isAssessing && <Loader className="w-4 h-4 animate-spin" />}
          {isAssessing ? 'Assessing…' : 'Run Risk Assessment'}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border-l-4 border-l-green-500">
          <p className="text-sm text-secondary-text">Low Risk</p>
          <p className="text-3xl font-bold text-green-600">{riskStats.lowRisk}</p>
          <p className="text-xs text-secondary-text">{Math.round((riskStats.lowRisk / total) * 100)}% of students</p>
        </div>
        <div className="card border-l-4 border-l-yellow-500">
          <p className="text-sm text-secondary-text">Medium Risk</p>
          <p className="text-3xl font-bold text-yellow-600">{riskStats.mediumRisk}</p>
          <p className="text-xs text-secondary-text">{Math.round((riskStats.mediumRisk / total) * 100)}% of students</p>
        </div>
        <div className="card border-l-4 border-l-orange-500">
          <p className="text-sm text-secondary-text">High Risk</p>
          <p className="text-3xl font-bold text-orange-600">{riskStats.highRisk}</p>
          <p className="text-xs text-secondary-text">{Math.round((riskStats.highRisk / total) * 100)}% of students</p>
        </div>
        <div className="card border-l-4 border-l-red-500">
          <p className="text-sm text-secondary-text">Critical</p>
          <p className="text-3xl font-bold text-red-600">{riskStats.critical}</p>
          <p className="text-xs text-secondary-text">{Math.round((riskStats.critical / total) * 100)}% of students</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Factor Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Risk Factor Analysis</h3>
          {isLoading ? (
            <div className="h-72 flex items-center justify-center">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={riskFactors}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="factor" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Score" dataKey="value" stroke="#000" fill="#000" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Risk Distribution</h3>
          {isLoading ? (
            <div className="h-72 flex items-center justify-center">
              <Loader className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <>
              <div className="h-72 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {riskDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* High Risk Students */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card border-red-200 dark:border-red-900"
      >
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold">Students Requiring Immediate Attention</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader className="w-8 h-8 animate-spin" />
          </div>
        ) : highRiskStudents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-secondary-text">No high-risk students at the moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {highRiskStudents.map((student) => (
              <div key={student.id} className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">{student.name}</h4>
                    <p className="text-sm text-secondary-text">{student.class}</p>
                  </div>
                  <span className={`badge ${student.risk === 'critical' ? 'badge-danger' : 'badge-warning'
                    }`}>
                    {student.risk}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${student.score > 70 ? 'bg-red-500' : 'bg-orange-500'
                        }`}
                      style={{ width: `${Math.min(student.score, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold">{student.score}</span>
                </div>
                <div className="space-y-1">
                  {student.factors.slice(0, 2).map((factor, idx) => (
                    <p key={idx} className="text-xs text-secondary-text">• {factor}</p>
                  ))}
                </div>
                <button className="w-full mt-3 btn-secondary text-sm py-2">
                  Create Intervention
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Risk Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-secondary-bg dark:bg-dark-card"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-black dark:bg-white">
            <Activity className="w-6 h-6 text-white dark:text-black" />
          </div>
          <div>
            <h3 className="font-semibold mb-2">About the Risk Analysis Engine</h3>
            <p className="text-sm text-secondary-text">
              EduPulse analyzes attendance patterns, academic performance, behaviour records, assignment completion, and fee payment history to identify students at risk. Each factor is weighted and combined to produce an overall risk score from 0-100.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
