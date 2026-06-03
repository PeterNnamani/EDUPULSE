import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Users, TrendingUp, AlertTriangle, DollarSign, BookOpen, Loader, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { getTeacherClasses, getClassStudents } from '@/services/classService';
import { generateStudentReport, generateClassReport } from '@/services/reportService';

interface ReportData {
  id: string;
  type: string;
  name: string;
  date: string;
  format: 'PDF' | 'Excel' | 'CSV';
}

interface ClassData {
  id: string;
  name: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

export default function ReportsPage() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;

  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [recentReports, setRecentReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [selectedDateRange, setSelectedDateRange] = useState('this_month');
  const [selectedFormat, setSelectedFormat] = useState('pdf');

  const reportTypes = [
    { id: 'attendance', name: 'Attendance Report', icon: Calendar, description: 'Daily, weekly, or monthly attendance summaries' },
    { id: 'academic', name: 'Academic Report', icon: BookOpen, description: 'Grade reports, report cards, performance analysis' },
    { id: 'behaviour', name: 'Behaviour Report', icon: AlertTriangle, description: 'Merits, demerits, and incident summaries' },
    { id: 'risk', name: 'Risk Analysis Report', icon: TrendingUp, description: 'Student risk assessment and predictions' },
    { id: 'financial', name: 'Financial Report', icon: DollarSign, description: 'Fee collection, outstanding balances' },
    { id: 'student', name: 'Student Profile', icon: Users, description: 'Comprehensive student reports' },
  ];

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user?.id || !schoolId) {
        setError('User information not found');
        setLoading(false);
        return;
      }

      try {
        console.log('🔄 Fetching reports data for schoolId:', schoolId);

        // Load classes
        let classesData: ClassData[] = [];
        try {
          const { data: cls, error: clsError } = await supabase
            .from('classes')
            .select('id, class_name as name')
            .eq('school_id', schoolId);
          if (clsError) throw clsError;
          classesData = cls || [];
          setClasses(classesData);
          if (classesData.length > 0) {
            setSelectedClass(classesData[0].id);
          }
          console.log('✓ Classes:', classesData.length);
        } catch (e) {
          console.warn('⚠️ Classes error:', e);
        }

        // Load recent reports from database
        let reportsData: any[] = [];
        try {
          const { data: reports, error: reportsError } = await supabase
            .from('attendance')
            .select('id, created_at')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(5);

          const { data: grades, error: gradesError } = await supabase
            .from('grades')
            .select('id, created_at')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(3);

          const { data: behaviour, error: behaviourError } = await supabase
            .from('behaviour_records')
            .select('id, created_at')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(3);

          const generatedReports: ReportData[] = [];

          if (!reportsError && reports && reports.length > 0) {
            reports.forEach((r, i) => {
              generatedReports.push({
                id: `attendance-${r.id}`,
                type: 'Attendance',
                name: `Attendance Report ${i + 1}`,
                date: new Date(r.created_at).toISOString().split('T')[0],
                format: 'PDF' as const,
              });
            });
          }

          if (!gradesError && grades && grades.length > 0) {
            grades.forEach((g, i) => {
              generatedReports.push({
                id: `grades-${g.id}`,
                type: 'Academic',
                name: `Academic Report ${i + 1}`,
                date: new Date(g.created_at).toISOString().split('T')[0],
                format: 'PDF' as const,
              });
            });
          }

          if (!behaviourError && behaviour && behaviour.length > 0) {
            behaviour.forEach((b, i) => {
              generatedReports.push({
                id: `behaviour-${b.id}`,
                type: 'Behaviour',
                name: `Behaviour Report ${i + 1}`,
                date: new Date(b.created_at).toISOString().split('T')[0],
                format: 'PDF' as const,
              });
            });
          }

          setRecentReports(generatedReports);
          console.log('✓ Recent reports loaded:', generatedReports.length);
        } catch (e) {
          console.warn('⚠️ Recent reports error:', e);
          setRecentReports([]);
        }

        console.log('========================================');
        console.log('📊 Reports data loaded');
        console.log('========================================');
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user, schoolId]);

  // Load students when class changes
  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedClass) return;

      try {
        const classStudents = await getClassStudents(selectedClass);
        setStudents(classStudents);
        if (classStudents.length > 0) {
          setSelectedStudent(classStudents[0].id);
        }
      } catch (err) {
        console.error('Error loading students:', err);
        setError('Failed to load students');
      }
    };

    loadStudents();
  }, [selectedClass]);

  const handleGenerateReport = async () => {
    setError('');
    setSuccessMessage('');
    setGenerating(true);

    try {
      if (selectedReport === 'student' && selectedStudent) {
        // Generate student report
        const report = await generateStudentReport(schoolId!, selectedStudent);
        if (report) {
          setSuccessMessage(`Student report generated successfully`);
          const newReport: ReportData = {
            id: Math.random().toString(),
            type: 'Student Profile',
            name: `${report.studentName} - Comprehensive Report`,
            date: new Date().toISOString().split('T')[0],
            format: selectedFormat as 'PDF' | 'Excel' | 'CSV',
          };
          setRecentReports([newReport, ...recentReports]);
        } else {
          setError('Failed to generate student report');
        }
      } else if (selectedReport === 'academic' && selectedClass) {
        // Generate class report
        const report = await generateClassReport(schoolId!, selectedClass);
        if (report) {
          setSuccessMessage(`Academic report generated successfully`);
          const newReport: ReportData = {
            id: Math.random().toString(),
            type: 'Academic',
            name: `${report.className} - Academic Report`,
            date: new Date().toISOString().split('T')[0],
            format: selectedFormat as 'PDF' | 'Excel' | 'CSV',
          };
          setRecentReports([newReport, ...recentReports]);
        } else {
          setError('Failed to generate academic report');
        }
      } else {
        setError('Please select required filters');
      }

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-secondary-text">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-secondary-text">Generate and download school reports</p>
      </div>

      {/* Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </motion.div>
      )}

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900"
        >
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        </motion.div>
      )}

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report, index) => {
          const Icon = report.icon;
          return (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card-hover cursor-pointer"
              onClick={() => setSelectedReport(report.id)}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{report.name}</h3>
                  <p className="text-sm text-secondary-text mt-1">{report.description}</p>
                  <button
                    className="mt-3 text-sm text-black dark:text-white font-medium hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedReport(report.id);
                    }}
                  >
                    Generate Report
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Report Generator */}
      {selectedReport && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h2 className="font-semibold mb-4">
            Generate {reportTypes.find(r => r.id === selectedReport)?.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {selectedReport === 'student' && (
              <>
                <div>
                  <label className="label mb-1.5 block">Class</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select a class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Student</label>
                  <select
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select a student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {(selectedReport === 'attendance' || selectedReport === 'academic' || selectedReport === 'behaviour') && (
              <>
                <div>
                  <label className="label mb-1.5 block">Class</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="input-field"
                  >
                    <option value="">All Classes</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="label mb-1.5 block">Date Range</label>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="input-field"
              >
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="this_term">This Term</option>
                <option value="custom_range">Custom Range</option>
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">Format</label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="input-field"
              >
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setSelectedReport(null)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Recent Reports */}
      {recentReports.length > 0 && (
        <div>
          <h3 className="font-semibold mb-4">Recent Reports</h3>
          <div className="space-y-3">
            {recentReports.map((report) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-secondary-text" />
                  <div>
                    <p className="font-medium">{report.name}</p>
                    <p className="text-xs text-secondary-text">{report.type} • {report.date}</p>
                  </div>
                </div>
                <button className="btn-secondary text-sm flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  {report.format}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
