import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Users, TrendingUp, AlertTriangle, DollarSign, BookOpen } from 'lucide-react';

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const reportTypes = [
    { id: 'attendance', name: 'Attendance Report', icon: Calendar, description: 'Daily, weekly, or monthly attendance summaries' },
    { id: 'academic', name: 'Academic Report', icon: BookOpen, description: 'Grade reports, report cards, performance analysis' },
    { id: 'behaviour', name: 'Behaviour Report', icon: AlertTriangle, description: 'Merits, demerits, and incident summaries' },
    { id: 'risk', name: 'Risk Analysis Report', icon: TrendingUp, description: 'Student risk assessment and predictions' },
    { id: 'financial', name: 'Financial Report', icon: DollarSign, description: 'Fee collection, outstanding balances' },
    { id: 'student', name: 'Student Profile', icon: Users, description: 'Comprehensive student reports' },
  ];

  const recentReports = [
    { id: '1', type: 'Attendance', name: 'Weekly Attendance - SS1A', date: 'Jan 25, 2025', format: 'PDF' },
    { id: '2', type: 'Academic', name: 'Mid-Term Results - SS2A', date: 'Jan 20, 2025', format: 'PDF' },
    { id: '3', type: 'Financial', name: 'Fee Collection - January', date: 'Jan 18, 2025', format: 'Excel' },
    { id: '4', type: 'Risk', name: 'Critical Students - Week 4', date: 'Jan 15, 2025', format: 'PDF' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-secondary-text">Generate and download school reports</p>
      </div>

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
                  <button className="mt-3 text-sm text-black dark:text-white font-medium hover:underline">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label mb-1.5 block">Date Range</label>
              <select className="input-field">
                <option>This Week</option>
                <option>This Month</option>
                <option>This Term</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">Class</label>
              <select className="input-field">
                <option>All Classes</option>
                <option>SS1A</option>
                <option>SS1B</option>
                <option>SS2A</option>
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">Format</label>
              <select className="input-field">
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => setSelectedReport(null)} className="btn-secondary">Cancel</button>
            <button className="btn-primary flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Generate Report
            </button>
          </div>
        </motion.div>
      )}

      {/* Recent Reports */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h2 className="font-semibold mb-4">Recent Reports</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left rounded-l-lg">Report Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Generated</th>
                <th className="px-4 py-3 text-left">Format</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentReports.map((report) => (
                <tr key={report.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-secondary-text" />
                      <span className="font-medium">{report.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge badge-info">{report.type}</span>
                  </td>
                  <td className="px-4 py-3 text-secondary-text">{report.date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${report.format === 'PDF' ? 'text-red-600' : 'text-green-600'}`}>
                      {report.format}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="flex items-center gap-1 text-sm text-black dark:text-white hover:underline">
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
