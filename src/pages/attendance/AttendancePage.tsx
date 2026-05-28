import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Check, X, Clock, UserCheck, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function AttendancePage() {
  const [selectedClass, setSelectedClass] = useState('SS1A');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const mockStudents = [
    { id: '1', name: 'John Doe', status: 'present' },
    { id: '2', name: 'Jane Smith', status: 'present' },
    { id: '3', name: 'Emeka Brown', status: 'absent' },
    { id: '4', name: 'Chioma Okonkwo', status: 'late' },
    { id: '5', name: 'Ahmed Muhammad', status: 'present' },
    { id: '6', name: 'Fatima Bello', status: 'excused' },
    { id: '7', name: 'Yusuf Adam', status: 'present' },
    { id: '8', name: 'Aisha Yusuf', status: 'present' },
  ];

  const [attendance, setAttendance] = useState<Record<string, string>>({});

  const handleMarkAttendance = (studentId: string, status: string) => {
    setAttendance({ ...attendance, [studentId]: status });
  };

  const stats = {
    present: Object.values(attendance).filter((s) => s === 'present').length || mockStudents.filter(s => s.status === 'present').length,
    absent: Object.values(attendance).filter((s) => s === 'absent').length || mockStudents.filter(s => s.status === 'absent').length,
    late: Object.values(attendance).filter((s) => s === 'late').length || mockStudents.filter(s => s.status === 'late').length,
    excused: Object.values(attendance).filter((s) => s === 'excused').length || mockStudents.filter(s => s.status === 'excused').length,
  };

  const classes = ['SS1A', 'SS1B', 'SS2A', 'SS2B', 'SS3A', 'SS3B'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-secondary-text">Mark and track student attendance</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="btn-primary flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Submit
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
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
          <div className="flex-1">
            <label className="label mb-1.5 block">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Present', value: stats.present, icon: Check, color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
          { label: 'Absent', value: stats.absent, icon: X, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
          { label: 'Late', value: stats.late, icon: Clock, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
          { label: 'Excused', value: stats.excused, icon: CalendarDays, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="stat-value text-xl">{stat.value}</p>
                  <p className="text-xs text-secondary-text">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Student List */}
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
                <th className="px-4 py-3 text-center">Present</th>
                <th className="px-4 py-3 text-center">Absent</th>
                <th className="px-4 py-3 text-center">Late</th>
                <th className="px-4 py-3 text-center">Excused</th>
                <th className="px-4 py-3 text-left rounded-r-lg">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {mockStudents.map((student, index) => {
                const status = attendance[student.id] || student.status;
                return (
                  <tr key={student.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center font-medium text-sm">
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleMarkAttendance(student.id, 'present')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          status === 'present' ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-green-100'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleMarkAttendance(student.id, 'absent')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          status === 'absent' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-red-100'
                        }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleMarkAttendance(student.id, 'late')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          status === 'late' ? 'bg-yellow-500 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-yellow-100'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleMarkAttendance(student.id, 'excused')}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          status === 'excused' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-blue-100'
                        }`}
                      >
                        <CalendarDays className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        className="input-field py-2"
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
