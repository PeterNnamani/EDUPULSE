import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Award, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';

interface GradeRecord {
    id: string;
    subject: string;
    score: number;
    maximum_score?: number;
    date: string;
    term?: string;
    remarks?: string;
}

export default function ParentGrades() {
    const { user } = useAppStore();
    const [selectedChildId, setSelectedChildId] = useState<string>('');
    const [grades, setGrades] = useState<GradeRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const selectedChildData = user?.children?.find((c: any) => c.id === selectedChildId);

    // Set default child
    useEffect(() => {
        if (user?.children && user.children.length > 0 && !selectedChildId) {
            setSelectedChildId(user.children[0].id);
        }
    }, [user?.children, selectedChildId]);

    // Fetch grades for selected child
    useEffect(() => {
        if (!selectedChildId || !user?.schoolId) return;

        const fetchGrades = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('grades')
                    .select('*')
                    .eq('student_id', selectedChildId)
                    .eq('school_id', user.schoolId)
                    .order('date', { ascending: false });

                if (error) {
                    console.error('[PARENT_GRADES] Error fetching data:', error);
                } else {
                    setGrades(data || []);
                }
            } catch (error) {
                console.error('[PARENT_GRADES] Fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchGrades();
    }, [selectedChildId, user?.schoolId]);

    const stats = {
        average: grades.length > 0
            ? Math.round(grades.reduce((sum, g) => sum + g.score, 0) / grades.length)
            : 0,
        highest: grades.length > 0
            ? Math.max(...grades.map(g => g.score))
            : 0,
        lowest: grades.length > 0
            ? Math.min(...grades.map(g => g.score))
            : 0,
        totalGrades: grades.length,
    };

    const getGradeColor = (score: number) => {
        if (score >= 80) return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100';
        if (score >= 70) return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100';
        if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100';
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100';
    };

    const getPerformanceLabel = (score: number) => {
        if (score >= 80) return 'Excellent';
        if (score >= 70) return 'Good';
        if (score >= 60) return 'Satisfactory';
        return 'Needs Improvement';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-3xl font-bold">Grades & Performance</h1>
                <p className="text-secondary-text mt-1">View {selectedChildData?.firstName}'s academic performance</p>
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
                        value={selectedChildId}
                        onChange={(e) => setSelectedChildId(e.target.value)}
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
                            <p className="text-secondary-text text-sm">Average Score</p>
                            <p className="text-3xl font-bold mt-2">{stats.average}%</p>
                        </div>
                        <BookOpen className="w-8 h-8 text-blue-500 opacity-50" />
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
                            <p className="text-secondary-text text-sm">Highest Score</p>
                            <p className="text-3xl font-bold mt-2 text-green-600">{stats.highest}%</p>
                        </div>
                        <Award className="w-8 h-8 text-green-500 opacity-50" />
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
                            <p className="text-secondary-text text-sm">Lowest Score</p>
                            <p className="text-3xl font-bold mt-2 text-red-600">{stats.lowest}%</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-red-500 opacity-50" />
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
                            <p className="text-secondary-text text-sm">Total Grades</p>
                            <p className="text-3xl font-bold mt-2">{stats.totalGrades}</p>
                        </div>
                        <BookOpen className="w-8 h-8 text-purple-500 opacity-50" />
                    </div>
                </motion.div>
            </div>

            {/* Grades Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
            >
                <h2 className="text-xl font-semibold mb-4">Grade Details</h2>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-secondary-text">Loading grades...</p>
                    </div>
                ) : grades.length === 0 ? (
                    <div className="text-center py-8">
                        <BookOpen className="w-12 h-12 text-secondary-text opacity-50 mx-auto mb-3" />
                        <p className="text-secondary-text">No grades recorded yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-300 dark:border-gray-600">
                                    <th className="text-left py-3 px-4 font-semibold text-secondary-text">Subject</th>
                                    <th className="text-center py-3 px-4 font-semibold text-secondary-text">Score</th>
                                    <th className="text-center py-3 px-4 font-semibold text-secondary-text">Performance</th>
                                    <th className="text-left py-3 px-4 font-semibold text-secondary-text">Term</th>
                                    <th className="text-left py-3 px-4 font-semibold text-secondary-text">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grades.map((grade) => (
                                    <tr
                                        key={grade.id}
                                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-secondary-bg dark:hover:bg-dark-card transition-colors"
                                    >
                                        <td className="py-3 px-4">
                                            <span className="font-medium">{grade.subject}</span>
                                            {grade.remarks && (
                                                <p className="text-sm text-secondary-text mt-1">{grade.remarks}</p>
                                            )}
                                        </td>
                                        <td className="text-center py-3 px-4">
                                            <span className="font-bold text-lg">{grade.score}</span>
                                            {grade.maximum_score && (
                                                <p className="text-sm text-secondary-text">/ {grade.maximum_score}</p>
                                            )}
                                        </td>
                                        <td className="text-center py-3 px-4">
                                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getGradeColor(grade.score)}`}>
                                                {getPerformanceLabel(grade.score)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm">{grade.term || '-'}</td>
                                        <td className="py-3 px-4 text-sm text-secondary-text">
                                            {new Date(grade.date).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
