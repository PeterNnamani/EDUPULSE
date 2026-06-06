import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Users, TrendingUp, AlertTriangle, DollarSign, BookOpen, Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { fetchPrincipalDashboard } from '@/services/principalDashboardService';
import {
  exportSchoolReport,
  type ReportCategory,
} from '@/services/reportExportService';
import { getTeacherTeachingLoad } from '@/services/classService';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import {
  canAccessReportCategory,
  getReportCategoriesForRole,
  isSchoolWideReportRole,
  REPORTS_FOOTER_BY_ROLE,
  REPORTS_PAGE_SUBTITLE,
} from '@/config/reportsByRole';
import type { UserRole } from '@/types';

interface ReportData {
  id: string;
  type: string;
  category: ReportCategory;
  name: string;
  date: string;
  format: 'PDF' | 'Excel' | 'CSV';
}

const ALL_REPORT_TYPES: Array<{
  id: ReportCategory;
  name: string;
  icon: typeof Calendar;
  description: string;
}> = [
  {
    id: 'attendance',
    name: 'Attendance Report',
    icon: Calendar,
    description: 'Daily, weekly, or monthly attendance summaries',
  },
  {
    id: 'academic',
    name: 'Academic Report',
    icon: BookOpen,
    description: 'Grade reports, report cards, performance analysis',
  },
  {
    id: 'behaviour',
    name: 'Behaviour Report',
    icon: AlertTriangle,
    description: 'Merits, demerits, and incident summaries',
  },
  {
    id: 'risk',
    name: 'Risk Analysis Report',
    icon: TrendingUp,
    description: 'Student risk assessment and predictions',
  },
  {
    id: 'financial',
    name: 'Financial Report',
    icon: DollarSign,
    description: 'Fee collection, outstanding balances',
  },
  {
    id: 'student',
    name: 'Student Profile',
    icon: Users,
    description: 'Comprehensive student reports',
  },
];

export default function ReportsPage() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;
  const role = user?.role as UserRole | undefined;
  const { hasFeature } = useFeatureAccess();
  const hasRiskFeature = hasFeature('risk_detection');
  const isOversight = role === 'admin' || role === 'principal';
  const isTeacher = role === 'teacher';

  const allowedCategories = useMemo(
    () => getReportCategoriesForRole(role, { hasRiskFeature }),
    [role, hasRiskFeature]
  );

  const reportTypes = useMemo(
    () => ALL_REPORT_TYPES.filter((r) => allowedCategories.includes(r.id)),
    [allowedCategories]
  );

  const [recentReports, setRecentReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');
  const [schoolStats, setSchoolStats] = useState<string[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<Array<{ id: string; name: string }>>([]);

  const teacherClassIds = useMemo(
    () => teacherClasses.map((c) => c.id),
    [teacherClasses]
  );

  const exportOptions = useMemo(
    () => (user?.id && role ? { role, staffId: user.id } : undefined),
    [role, user?.id]
  );

  useEffect(() => {
    if (!schoolId || !isTeacher || !user?.id) {
      setTeacherClasses([]);
      return;
    }
    getTeacherTeachingLoad(schoolId, user.id).then((load) => {
      setTeacherClasses(
        load.classes.map((c) => ({ id: c.classId, name: c.className }))
      );
    });
  }, [schoolId, isTeacher, user?.id]);

  useEffect(() => {
    if (schoolId && isOversight) {
      fetchPrincipalDashboard(schoolId).then((d) => {
        const m = d.metrics;
        setSchoolStats([
          `Total students: ${m.totalStudents}`,
          `Total staff: ${m.totalStaff}`,
          `Attendance rate (7d): ${m.attendanceRate}%`,
          `Average grade (30d): ${m.averageGrade}%`,
          `High-risk students: ${m.highRiskStudents}`,
          `Open intervention cases: ${m.openCases}`,
        ]);
      });
    } else {
      setSchoolStats([]);
    }
  }, [schoolId, isOversight]);

  const downloadReport = async (report: ReportData) => {
    if (!schoolId || !role) return;
    if (!canAccessReportCategory(role, report.category, { hasRiskFeature })) {
      setExportError('You do not have access to this report type.');
      return;
    }
    if (isTeacher && teacherClassIds.length === 0) {
      setExportError('No classes assigned to you.');
      return;
    }
    setExporting(report.id);
    setExportError('');

    const result = await exportSchoolReport(
      schoolId,
      report.category,
      report.format,
      exportOptions
    );
    if (!result.success) {
      setExportError(result.error || 'Export failed');
    }
    setExporting(null);
  };

  const generateReport = async (category: ReportCategory, _name: string) => {
    if (!schoolId || !role) return;
    if (!canAccessReportCategory(role, category, { hasRiskFeature })) {
      setExportError('You do not have access to this report type.');
      return;
    }
    if (isTeacher && teacherClassIds.length === 0) {
      setExportError('No classes assigned to you.');
      return;
    }
    setExporting(category);
    setExportError('');

    const result = await exportSchoolReport(schoolId, category, 'PDF', exportOptions);
    if (!result.success) {
      setExportError(result.error || 'Export failed');
    } else {
      await loadReports();
    }
    setExporting(null);
  };

  const loadReports = useCallback(async () => {
    if (!schoolId || !role) return;
    if (isTeacher && teacherClassIds.length === 0) {
      setRecentReports([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const generatedReports: ReportData[] = [];
      const scopeClassIds = isSchoolWideReportRole(role) ? null : teacherClassIds;

      if (allowedCategories.includes('attendance')) {
        let query = supabase
          .from('attendance')
          .select('id, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (scopeClassIds) query = query.in('class_id', scopeClassIds);

        const { data: attendanceData, error: attendanceError } = await query;

        if (!attendanceError && attendanceData?.length) {
          attendanceData.forEach((record) => {
            generatedReports.push({
              id: `att-${record.id}`,
              type: 'Attendance',
              category: 'attendance',
              name: `Attendance Report - ${new Date(record.created_at).toLocaleDateString()}`,
              date: new Date(record.created_at).toISOString().split('T')[0],
              format: 'PDF',
            });
          });
        }
      }

      if (allowedCategories.includes('academic')) {
        let query = supabase
          .from('grades')
          .select('id, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (scopeClassIds) query = query.in('class_id', scopeClassIds);

        const { data: gradesData, error: gradesError } = await query;

        if (!gradesError && gradesData?.length) {
          gradesData.forEach((record) => {
            generatedReports.push({
              id: `grade-${record.id}`,
              type: 'Academic',
              category: 'academic',
              name: `Academic Report - ${new Date(record.created_at).toLocaleDateString()}`,
              date: new Date(record.created_at).toISOString().split('T')[0],
              format: 'PDF',
            });
          });
        }
      }

      if (allowedCategories.includes('behaviour')) {
        let query = supabase
          .from('behaviour_records')
          .select('id, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (scopeClassIds) query = query.in('class_id', scopeClassIds);

        const { data: behaviourData, error: behaviourError } = await query;

        if (!behaviourError && behaviourData?.length) {
          behaviourData.forEach((record) => {
            generatedReports.push({
              id: `behav-${record.id}`,
              type: 'Behaviour',
              category: 'behaviour',
              name: `Behaviour Report - ${new Date(record.created_at).toLocaleDateString()}`,
              date: new Date(record.created_at).toISOString().split('T')[0],
              format: 'PDF',
            });
          });
        }
      }

      generatedReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentReports(generatedReports);
    } catch (error) {
      console.error('[REPORTS] Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  }, [schoolId, role, allowedCategories, isTeacher, teacherClassIds]);

  useEffect(() => {
    if (schoolId && role) {
      void loadReports();
    }
  }, [schoolId, role, loadReports]);

  const pageSubtitle =
    (role && REPORTS_PAGE_SUBTITLE[role]) ?? 'Generate and download reports for your role';
  const footerText =
    (role && REPORTS_FOOTER_BY_ROLE[role]) ??
    'Reports are generated from live school data available to your role.';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-secondary-text">{pageSubtitle}</p>
        </div>
        <button type="button" onClick={() => void loadReports()} className="btn-primary">
          Refresh
        </button>
      </div>

      {exportError && (
        <p className="text-sm text-red-600 dark:text-red-400">{exportError}</p>
      )}

      {isTeacher && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h2 className="text-sm font-semibold mb-2">Your assigned classes</h2>
          {teacherClasses.length === 0 ? (
            <p className="text-sm text-secondary-text">
              No classes assigned yet. Reports will be available once you are linked to a class.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teacherClasses.map((cls) => (
                <span
                  key={cls.id}
                  className="text-xs px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                >
                  {cls.name}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {isOversight && schoolStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <h2 className="text-sm font-semibold mb-2">School snapshot</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-secondary-text">
            {schoolStats.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </motion.div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Available Report Types</h2>
        {reportTypes.length === 0 ? (
          <p className="text-sm text-secondary-text">No report types are available for your role.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTypes.map((report, index) => {
              const Icon = report.icon;
              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{report.name}</h3>
                      <p className="text-sm text-secondary-text">{report.description}</p>
                      <button
                        type="button"
                        onClick={() => void generateReport(report.id, report.name)}
                        disabled={exporting === report.id}
                        className="mt-3 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        {exporting === report.id ? 'Generating...' : 'Generate PDF'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Recent Reports</h2>
          <span className="text-xs px-3 py-1 rounded-full bg-secondary-bg dark:bg-dark-card">
            {recentReports.length} reports
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin" />
          </div>
        ) : recentReports.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-secondary-text mx-auto mb-3 opacity-50" />
            <p className="text-secondary-text">No reports generated yet</p>
            <p className="text-xs text-secondary-text mt-1">Generate your first report to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold">Report Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Type</th>
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Format</th>
                  <th className="text-left py-3 px-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-secondary-bg dark:hover:bg-dark-card"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-secondary-text" />
                        <span className="font-medium">{report.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-secondary-text">{report.type}</td>
                    <td className="py-3 px-4 text-sm text-secondary-text">{report.date}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {report.format}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => void downloadReport(report)}
                        disabled={exporting === report.id}
                        className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-sm transition-colors disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        {exporting === report.id ? 'Exporting...' : 'Download'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-white dark:bg-gray-800">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold">Report exports</h3>
            <p className="text-sm text-secondary-text mt-1">{footerText}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
