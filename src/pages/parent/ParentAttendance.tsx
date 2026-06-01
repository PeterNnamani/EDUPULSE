import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';

interface AttendanceRecord {
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    subject?: string;
    remarks?: string;
}

export default function ParentAttendance() {
    const { user, selectedParentChildId, setSelectedParentChildId } = useAppStore();
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChild, setSelectedChild] = useState<any>(null);

    const selectedChildData = user?.children?.find((c: any) => c.id === selectedParentChildId);

    // Set default child from store or initialize from first child
    useEffect(() => {
        if (user?.children && user.children.length > 0) {
            if (!selectedParentChildId) {
                setSelectedParentChildId(user.children[0].id);
            }
        }
    }, [user?.children, selectedParentChildId, setSelectedParentChildId]);

    // Fetch attendance for selected child
    useEffect(() => {
        if (!selectedParentChildId || !user?.schoolId) return;

        const fetchAttendance = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('student_id', selectedParentChildId)
                    .eq('school_id', user.schoolId)
                    .order('date', { ascending: false });

                if (error) {
                    console.error('[PARENT_ATTENDANCE] Error fetching data:', error);
                } else {
                    setAttendance(data || []);
                }
            } catch (error) {
                console.error('[PARENT_ATTENDANCE] Fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();
    }, [selectedParentChildId, user?.schoolId]);

    const stats = {
        present: attendance.filter(a => a.status === 'present').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        late: attendance.filter(a => a.status === 'late').length,
        percentage: attendance.length > 0
            ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100)
            : 0,
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'present':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'absent':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'late':
                return <Clock className="w-5 h-5 text-yellow-500" />;
            case 'excused':
                return <CheckCircle className="w-5 h-5 text-blue-500" />;
            default:
                return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'present':
                return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100';
            case 'absent':
                return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100';
            case 'late':
                return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100';
            case 'excused':
                return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100';
            default:
                return '';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-3xl font-bold">Attendance</h1>
                <p className="text-secondary-text mt-1">View {selectedChildData?.firstName}'s attendance record</p>
            </motion.div>

            {/* Child Selector */}
            {user?.children && user.children.length > 1 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                >
                    <label className="block text-sm font-semibold mb-3">Select Child</label>
                    <select
                        value={selectedParentChildId || ''}
                        onChange={(e) => setSelectedParentChildId(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-secondary-bg dark:bg-dark-card border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {user.children.map((child: any) => (
                            <option key={child.id} value={child.id}>
                                {child.firstName} {child.lastName}
                            </option>
                        ))}
                    </select>
                </motion.div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-secondary-text text-sm">Attendance Rate</p>
                            <p className="text-3xl font-bold mt-2">{stats.percentage}%</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-blue-500 opacity-50" />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-secondary-text text-sm">Present</p>
                            <p className="text-3xl font-bold mt-2 text-green-600">{stats.present}</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="card"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-secondary-text text-sm">Absent</p>
                            <p className="text-3xl font-bold mt-2 text-red-600">{stats.absent}</p>
                        </div>
                        <XCircle className="w-8 h-8 text-red-500 opacity-50" />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="card"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-secondary-text text-sm">Late</p>
                            <p className="text-3xl font-bold mt-2 text-yellow-600">{stats.late}</p>
                        </div>
                        <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
                    </div>
                </motion.div>
            </div>

            {/* Attendance List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
            >
                <h2 className="text-xl font-semibold mb-4">Attendance History</h2>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-secondary-text">Loading attendance records...</p>
                    </div>
                ) : attendance.length === 0 ? (
                    <div className="text-center py-8">
                        <CalendarDays className="w-12 h-12 text-secondary-text opacity-50 mx-auto mb-3" />
                        <p className="text-secondary-text">No attendance records found</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {attendance.map((record) => (
                            <div
                                key={record.id}
                                className="flex items-center justify-between p-4 rounded-lg bg-secondary-bg dark:bg-dark-card hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    {getStatusIcon(record.status)}
                                    <div className="flex-1">
                                        <p className="font-medium">
                                            {format(new Date(record.date), 'EEEE, MMMM dd, yyyy')}
                                        </p>
                                        {record.subject && (
                                            <p className="text-sm text-secondary-text">{record.subject}</p>
                                        )}
                                        {record.remarks && (
                                            <p className="text-sm text-secondary-text italic">{record.remarks}</p>
                                        )}
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusColor(record.status)}`}>
                                    {record.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
