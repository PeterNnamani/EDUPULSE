import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Download, Calculator } from 'lucide-react';

export default function GradesPage() {
  const [selectedClass, setSelectedClass] = useState('SS1A');
  const [selectedSubject, setSelectedSubject] = useState('Mathematics');
  const [selectedAssessment, setSelectedAssessment] = useState('ca1');

  const mockGrades = [
    { id: '1', student: 'John Doe', score: 75, grade: 'B', maxScore: 100 },
    { id: '2', student: 'Jane Smith', score: 82, grade: 'A', maxScore: 100 },
    { id: '3', student: 'Emeka Brown', score: 58, grade: 'D', maxScore: 100 },
    { id: '4', student: 'Chioma Okonkwo', score: 90, grade: 'A', maxScore: 100 },
    { id: '5', student: 'Ahmed Muhammad', score: 68, grade: 'C', maxScore: 100 },
    { id: '6', student: 'Fatima Bello', score: 45, grade: 'F', maxScore: 100 },
    { id: '7', student: 'Yusuf Adam', score: 72, grade: 'B', maxScore: 100 },
    { id: '8', student: 'Aisha Yusuf', score: 88, grade: 'A', maxScore: 100 },
  ];

  const [grades, setGrades] = useState<Record<string, number>>({});

  const handleScoreChange = (studentId: string, score: number) => {
    setGrades({ ...grades, [studentId]: score });
  };

  const calculateGrade = (score: number): string => {
    if (score >= 70) return 'A';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  };

  const classes = ['SS1A', 'SS1B', 'SS2A', 'SS2B', 'SS3A', 'SS3B'];
  const subjects = ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology'];
  const assessments = [
    { value: 'ca1', label: 'CA 1' },
    { value: 'ca2', label: 'CA 2' },
    { value: 'ca3', label: 'CA 3' },
    { value: 'exam', label: 'Exam' },
  ];

  const stats = {
    average: mockGrades.reduce((acc, g) => acc + g.score, 0) / mockGrades.length,
    highest: Math.max(...mockGrades.map(g => g.score)),
    lowest: Math.min(...mockGrades.map(g => g.score)),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Grades</h1>
          <p className="text-secondary-text">Enter and manage student grades</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Calculate Averages
          </button>
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Save Grades
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label mb-1.5 block">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="input-field"
            >
              {classes.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="input-field"
            >
              {subjects.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Assessment</label>
            <select
              value={selectedAssessment}
              onChange={(e) => setSelectedAssessment(e.target.value)}
              className="input-field"
            >
              {assessments.map((ass) => (
                <option key={ass.value} value={ass.value}>{ass.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Max Score</label>
            <input type="number" className="input-field" value={100} readOnly />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-secondary-text mb-1">Class Average</p>
          <p className="text-2xl font-bold">{stats.average.toFixed(1)}%</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-secondary-text mb-1">Highest Score</p>
          <p className="text-2xl font-bold text-green-600">{stats.highest}%</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-secondary-text mb-1">Lowest Score</p>
          <p className="text-2xl font-bold text-red-600">{stats.lowest}%</p>
        </div>
      </div>

      {/* Grades Table */}
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
                <th className="px-4 py-3 text-center">Score</th>
                <th className="px-4 py-3 text-center">Grade</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {mockGrades.map((item, index) => {
                const score = grades[item.id] ?? item.score;
                const grade = calculateGrade(score);
                return (
                  <tr key={item.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center font-medium text-sm">
                          {item.student.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium">{item.student}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={score}
                        onChange={(e) => handleScoreChange(item.id, parseInt(e.target.value) || 0)}
                        className="input-field w-24 text-center mx-auto block"
                        min="0"
                        max="100"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${
                        grade === 'A' ? 'badge-success' :
                        grade === 'B' ? 'badge-info' :
                        grade === 'C' ? 'badge-warning' :
                        grade === 'D' ? 'badge-warning' :
                        'badge-danger'
                      }`}>
                        {grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Add remarks..."
                      />
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
