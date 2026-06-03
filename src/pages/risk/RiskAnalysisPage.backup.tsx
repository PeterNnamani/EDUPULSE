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
  risk: 'critical' | 'high' | 'medium' | 'low';
  score: number;
  factors: string[];
}

export default function RiskAnalysisPage() {
  const { user } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [riskFactors, setRiskFactors] = useState<any[]>([
    { factor: 'Attendance', value: 0 },
    { factor: 'Academic', value: 0 },
    { factor: 'Behaviour', value: 0 },
    { factor: 'Assignments', value: 0 },
    { factor: 'Fee Payment', value: 0 },
  ]);
  const [riskDistribution, setRiskDistribution] = useState<any[]>([]);
  const [highRiskStudents, setHighRiskStudents] = useState<RiskStudent[]>([]);
  const [riskStats, setRiskStats] = useState({
    lowRisk: 0,
    mediumRisk: 0,
    highRisk: 0,
    critical: 0,
  });

  useEffect(() => {
    if (user?.id && user?.schoolId) {
      fetchRiskData();
    }
  }, [user?.id, user?.schoolId]);

  const fetchRiskData = async () => {
    try {
      setIsLoading(true);

      // Get current session (most recent)
      const { data: sessionData } = await supabase
        .from('academic_sessions')
        .select('id')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .single();

      if (!sessionData) {
        console.warn('No active session found');
        setIsLoading(false);
        return;
      }

      // Get all students
      const { data: allStudents } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id')
        .eq('school_id', user!.schoolId);

      if (!allStudents || allStudents.length === 0) {
        setIsLoading(false);
        return;
      }

      // Calculate risk scores for all students
      const riskScores = await Promise.all(
        allStudents.map(async (student) => {
          const riskScore = await riskDetectionService.calculateStudentRiskScore(
            user!.schoolId,
            student.id,
            sessionData.id
          );
          return { student, riskScore };
        })
      );

      // Get class names
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, class_name');

      const classMap = new Map(classesData?.map(c => [c.id, c.class_name]) || []);

      // Categorize students by risk
      const categorized = {
        critical: [] as RiskStudent[],
        high: [] as RiskStudent[],
        medium: [] as RiskStudent[],
        low: [] as RiskStudent[]
      };

      riskScores.forEach(({ student, riskScore }) => {
        if (riskScore) {
          const riskStudent: RiskStudent = {
            id: student.id,
            name: `${student.first_name} ${student.last_name}`,
            class: classMap.get(student.class_id) || 'N/A',
            risk: riskScore.riskLevel,
            score: Math.round(riskScore.overallRisk),
            factors: [
              `Attendance: ${Math.round(riskScore.attendanceRisk)}%`,
              `Academic: ${Math.round(riskScore.academicRisk)}%`,
              `Behaviour: ${Math.round(riskScore.behaviourRisk)}%`,
              `Assignments: ${Math.round(riskScore.assignmentRisk)}%`,
              `Fees: ${Math.round(riskScore.feeRisk)}%`
            ]
          };

          categorized[riskScore.riskLevel].push(riskStudent);
        }
      });

      // Update stats
      setRiskStats({
        lowRisk: categorized.low.length,
        mediumRisk: categorized.medium.length,
        highRisk: categorized.high.length,
        critical: categorized.critical.length,
      });

      // Update distribution chart
      setRiskDistribution([
        { name: 'Low Risk', value: categorized.low.length, color: '#22C55E' },
        { name: 'Medium Risk', value: categorized.medium.length, color: '#F59E0B' },
        { name: 'High Risk', value: categorized.high.length, color: '#EF4444' },
        { name: 'Critical', value: categorized.critical.length, color: '#DC2626' },
      ]);

      // Get high risk students (critical + high, max 4)
      const allAtRisk = [...categorized.critical, ...categorized.high].slice(0, 4);
      setHighRiskStudents(allAtRisk);

      // Update risk factors (average across school)
      const avgFactors = {
        attendance: riskScores.filter(r => r.riskScore).reduce((sum, r) => sum + (r.riskScore?.attendanceRisk || 0), 0) / (riskScores.filter(r => r.riskScore).length || 1),
        academic: riskScores.filter(r => r.riskScore).reduce((sum, r) => sum + (r.riskScore?.academicRisk || 0), 0) / (riskScores.filter(r => r.riskScore).length || 1),
        behaviour: riskScores.filter(r => r.riskScore).reduce((sum, r) => sum + (r.riskScore?.behaviourRisk || 0), 0) / (riskScores.filter(r => r.riskScore).length || 1),
        assignments: riskScores.filter(r => r.riskScore).reduce((sum, r) => sum + (r.riskScore?.assignmentRisk || 0), 0) / (riskScores.filter(r => r.riskScore).length || 1),
        fees: riskScores.filter(r => r.riskScore).reduce((sum, r) => sum + (r.riskScore?.feeRisk || 0), 0) / (riskScores.filter(r => r.riskScore).length || 1),
      };

      setRiskFactors([
        { factor: 'Attendance', value: Math.round(avgFactors.attendance) },
        { factor: 'Academic', value: Math.round(avgFactors.academic) },
        { factor: 'Behaviour', value: Math.round(avgFactors.behaviour) },
        { factor: 'Assignments', value: Math.round(avgFactors.assignments) },
        { factor: 'Fee Payment', value: Math.round(avgFactors.fees) },
      ]);
    } catch (error) {
      console.error('Error fetching risk data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Risk Analysis</h1>
          <p className="text-secondary-text">AI-powered student risk monitoring</p>
        </div>
        <button className="btn-primary">Run Risk Assessment</button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border-l-4 border-l-green-500">
          <p className="text-sm text-secondary-text">Low Risk</p>
          <p className="text-3xl font-bold text-green-600">{riskStats.lowRisk}</p>
          <p className="text-xs text-secondary-text">{Math.round((riskStats.lowRisk / (riskStats.lowRisk + riskStats.mediumRisk + riskStats.highRisk + riskStats.critical)) * 100)}% of students</p>
        </div>
        <div className="card border-l-4 border-l-yellow-500">
          <p className="text-sm text-secondary-text">Medium Risk</p>
          <p className="text-3xl font-bold text-yellow-600">{riskStats.mediumRisk}</p>
          <p className="text-xs text-secondary-text">{Math.round((riskStats.mediumRisk / (riskStats.lowRisk + riskStats.mediumRisk + riskStats.highRisk + riskStats.critical)) * 100)}% of students</p>
        </div>
        <div className="card border-l-4 border-l-orange-500">
          <p className="text-sm text-secondary-text">High Risk</p>
          <p className="text-3xl font-bold text-orange-600">{riskStats.highRisk}</p>
          <p className="text-xs text-secondary-text">{Math.round((riskStats.highRisk / (riskStats.lowRisk + riskStats.mediumRisk + riskStats.highRisk + riskStats.critical)) * 100)}% of students</p>
        </div>
        <div className="card border-l-4 border-l-red-500">
          <p className="text-sm text-secondary-text">Critical</p>
          <p className="text-3xl font-bold text-red-600">{riskStats.critical}</p>
          <p className="text-xs text-secondary-text">{Math.round((riskStats.critical / (riskStats.lowRisk + riskStats.mediumRisk + riskStats.highRisk + riskStats.critical)) * 100)}% of students</p>
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
                  <span className={`badge ${
                    student.risk === 'critical' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {student.risk}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        student.score > 70 ? 'bg-red-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${student.score}%` }}
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

      {/* Risk Prediction Model Info */}
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
              EduPulse uses a rule-based risk scoring algorithm that analyzes attendance patterns, academic performance,
              behaviour records, assignment completion rates, and fee payment history to identify students at risk.
              Each factor is weighted and combined to produce an overall risk score from 0-100.
            </p>
            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-secondary-text" />
                <span className="text-xs">5 factors analyzed</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-secondary-text" />
                <span className="text-xs">350 students monitored</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-secondary-text" />
                <span className="text-xs">Weekly assessments</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
