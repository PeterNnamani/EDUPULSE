import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Users, TrendingUp, AlertTriangle, DollarSign, BookOpen, Loader, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface ReportData {
  id: string;
  type: string;
  name: string;
  date: string;
  format: 'PDF' | 'Excel' | 'CSV';
}

export default function ReportsPage() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;
  const [recentReports, setRecentReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);

  const reportTypes = [
    { id: 'attendance', name: 'Attendance Report', icon: Calendar, description: 'Daily, weekly, or monthly attendance summaries' },
    { id: 'academic', name: 'Academic Report', icon: BookOpen, description: 'Grade reports, report cards, performance analysis' },
    { id: 'behaviour', name: 'Behaviour Report', icon: AlertTriangle, description: 'Merits, demerits, and incident summaries' },
    { id: 'risk', name: 'Risk Analysis Report', icon: TrendingUp, description: 'Student risk assessment and predictions' },
    { id: 'financial', name: 'Financial Report', icon: DollarSign, description: 'Fee collection, outstanding balances' },
    { id: 'student', name: 'Student Profile', icon: Users, description: 'Comprehensive student reports' },
  ];

  useEffect(() => {
    if (schoolId) {
      loadReports();
    }
  }, [schoolId]);

  const downloadReport = async (report: ReportData) => {
    try {
      console.log('[REPORTS] Downloading report:', report.id, 'Format:', report.format);

      if (report.format === 'PDF') {
        // Create a proper PDF using jsPDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 20;

        // Title
        doc.setFontSize(18);
        doc.text(report.name, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;

        // Separator
        doc.setDrawColor(200);
        doc.line(20, yPosition, pageWidth - 20, yPosition);
        yPosition += 10;

        // Report Info
        doc.setFontSize(12);
        doc.text(`Type: ${report.type}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Date: ${report.date}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition);
        yPosition += 15;

        // Content
        doc.setFontSize(10);
        const content = [
          'This is a report generated from EduPulse.',
          '',
          'Report Details:',
          '• Type: School management report',
          '• Data Source: EduPulse Database',
          '• Status: Generated on demand',
          '',
          'For detailed information, please visit the EduPulse dashboard.'
        ];

        content.forEach(line => {
          if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 20, yPosition);
          yPosition += 6;
        });

        // Save
        doc.save(`${report.name.replace(/\s+/g, '_')}.pdf`);
        console.log('[REPORTS] PDF downloaded:', report.name);
      } else if (report.format === 'Excel') {
        // Create Excel file
        const ws = XLSX.utils.aoa_to_sheet([
          ['REPORT: ' + report.name],
          [],
          ['Report Information'],
          ['Field', 'Value'],
          ['Report Name', report.name],
          ['Type', report.type],
          ['Date', report.date],
          ['Generated', new Date().toLocaleString()],
          [],
          ['Report Details'],
          ['This is a school management report generated from EduPulse'],
          ['Data Source: EduPulse Database'],
          ['Status: Generated on demand'],
          [],
          ['For detailed information, visit the EduPulse dashboard']
        ]);

        // Set column widths
        ws['!cols'] = [{ wch: 25 }, { wch: 50 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, `${report.name.replace(/\s+/g, '_')}.xlsx`);
        console.log('[REPORTS] Excel downloaded:', report.name);
      } else if (report.format === 'CSV') {
        // Create CSV file
        const csvContent = [
          ['REPORT: ' + report.name],
          [],
          ['Report Information'],
          ['Field', 'Value'],
          ['Report Name', report.name],
          ['Type', report.type],
          ['Date', report.date],
          ['Generated', new Date().toLocaleString()],
          [],
          ['Report Details'],
          ['School management report generated from EduPulse'],
          ['Data Source: EduPulse Database'],
          ['Status: Generated on demand'],
          [],
          ['For detailed information, visit the EduPulse dashboard']
        ];

        const csv = csvContent.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${report.name.replace(/\s+/g, '_')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('[REPORTS] CSV downloaded:', report.name);
      }

      console.log('[REPORTS] Download started for:', report.name);
    } catch (error) {
      console.error('[REPORTS] Error downloading report:', error);
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      console.log('[REPORTS] Loading reports for school:', schoolId);

      const generatedReports: ReportData[] = [];

      // Fetch attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('id, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!attendanceError && attendanceData && attendanceData.length > 0) {
        attendanceData.forEach((record, idx) => {
          generatedReports.push({
            id: `att-${record.id}`,
            type: 'Attendance',
            name: `Attendance Report - ${new Date(record.created_at).toLocaleDateString()}`,
            date: new Date(record.created_at).toISOString().split('T')[0],
            format: 'PDF',
          });
        });
      }

      // Fetch grades records
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('id, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!gradesError && gradesData && gradesData.length > 0) {
        gradesData.forEach((record, idx) => {
          generatedReports.push({
            id: `grade-${record.id}`,
            type: 'Academic',
            name: `Academic Report - ${new Date(record.created_at).toLocaleDateString()}`,
            date: new Date(record.created_at).toISOString().split('T')[0],
            format: 'PDF',
          });
        });
      }

      // Fetch behaviour records
      const { data: behaviourData, error: behaviourError } = await supabase
        .from('behaviour_records')
        .select('id, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!behaviourError && behaviourData && behaviourData.length > 0) {
        behaviourData.forEach((record, idx) => {
          generatedReports.push({
            id: `behav-${record.id}`,
            type: 'Behaviour',
            name: `Behaviour Report - ${new Date(record.created_at).toLocaleDateString()}`,
            date: new Date(record.created_at).toISOString().split('T')[0],
            format: 'PDF',
          });
        });
      }

      // Sort by date (most recent first)
      generatedReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      console.log('[REPORTS] Total reports found:', generatedReports.length);
      console.log('[REPORTS] Reports:', generatedReports);

      setRecentReports(generatedReports);
    } catch (error) {
      console.error('[REPORTS] Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-secondary-text">Generate and manage school reports</p>
        </div>
        <button onClick={loadReports} className="btn-primary">Refresh Reports</button>
      </div>

      {/* Report Types Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Report Types</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report, index) => {
            const Icon = report.icon;
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-secondary-bg dark:bg-dark-card">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{report.name}</h3>
                    <p className="text-sm text-secondary-text">{report.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Recent Reports */}
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
                  <tr key={report.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-secondary-bg dark:hover:bg-dark-card">
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
                        onClick={() => downloadReport(report)}
                        className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-sm transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Report Stats */}
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
            <h3 className="font-semibold">Automated Report Generation</h3>
            <p className="text-sm text-secondary-text mt-1">
              Generate comprehensive reports for attendance, academic performance, behaviour, risk analysis, and financial management. All reports are generated from live school data.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
