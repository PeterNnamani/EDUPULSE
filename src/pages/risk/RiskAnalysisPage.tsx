import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, Users, Activity, BarChart3, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart as RechartsPie, Pie, Cell } from 'recharts';

export default function RiskAnalysisPage() {
  const riskFactors = [
    { factor: 'Attendance', value: 85 },
    { factor: 'Academic', value: 65 },
    { factor: 'Behaviour', value: 90 },
    { factor: 'Assignments', value: 75 },
    { factor: 'Fee Payment', value: 80 },
  ];

  const riskDistribution = [
    { name: 'Low Risk', value: 305, color: '#22C55E' },
    { name: 'Medium Risk', value: 28, color: '#F59E0B' },
    { name: 'High Risk', value: 12, color: '#EF4444' },
    { name: 'Critical', value: 5, color: '#DC2626' },
  ];

  const highRiskStudents = [
    { id: '1', name: 'John Doe', class: 'SS1A', risk: 'critical', score: 85, factors: ['Attendance: 62%', 'Grades: 45%'] },
    { id: '2', name: 'Jane Smith', class: 'SS2A', risk: 'high', score: 72, factors: ['Attendance: 70%', 'Behaviour: 3 incidents'] },
    { id: '3', name: 'Emeka Brown', class: 'SS1B', risk: 'high', score: 68, factors: ['Grades: 48%', 'Assignments: 40% submitted'] },
    { id: '4', name: 'Aisha Yusuf', class: 'SS3A', risk: 'critical', score: 80, factors: ['Attendance: 55%', 'Fees: Outstanding'] },
  ];

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
          <p className="text-3xl font-bold text-green-600">305</p>
          <p className="text-xs text-secondary-text">87% of students</p>
        </div>
        <div className="card border-l-4 border-l-yellow-500">
          <p className="text-sm text-secondary-text">Medium Risk</p>
          <p className="text-3xl font-bold text-yellow-600">28</p>
          <p className="text-xs text-secondary-text">8% of students</p>
        </div>
        <div className="card border-l-4 border-l-orange-500">
          <p className="text-sm text-secondary-text">High Risk</p>
          <p className="text-3xl font-bold text-orange-600">12</p>
          <p className="text-xs text-secondary-text">3% of students</p>
        </div>
        <div className="card border-l-4 border-l-red-500">
          <p className="text-sm text-secondary-text">Critical</p>
          <p className="text-3xl font-bold text-red-600">5</p>
          <p className="text-xs text-secondary-text">2% of students</p>
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
        </motion.div>

        {/* Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h3 className="font-semibold mb-4">Risk Distribution</h3>
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
                {student.factors.map((factor, idx) => (
                  <p key={idx} className="text-xs text-secondary-text">• {factor}</p>
                ))}
              </div>
              <button className="w-full mt-3 btn-secondary text-sm py-2">
                Create Intervention
              </button>
            </div>
          ))}
        </div>
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
