import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, CheckCircle, Clock, AlertCircle, Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { getStudentAssignments } from '@/services/assignmentService';

interface AssignmentWithSubmission {
    id: string;
    title: string;
    description?: string;
    due_date: string;
    assignment_type: string;
    total_marks: number;
    status: 'pending' | 'submitted' | 'graded' | 'active' | 'closed';
    submissions?: Array<{
        status: string;
        submitted_at?: string;
        score?: number;
        remarks?: string;
    }>;
}

export default function ParentAssignments() {
    const { user, selectedParentChildId, setSelectedParentChildId } = useAppStore();
    const [assignments, setAssignments] = useState<AssignmentWithSubmission[]>([]);
    const [loading, setLoading] = useState(true);

    const selectedChildData = user?.children?.find((c: any) => c.id === selectedParentChildId);

    // Set default child from store or initialize from first child
    useEffect(() => {
        if (user?.children && user.children.length > 0) {
            if (!selectedParentChildId) {
                setSelectedParentChildId(user.children[0].id);
            }
        }
    }, [user?.children, selectedParentChildId, setSelectedParentChildId]);

    // Fetch assignments for selected child
    useEffect(() => {
        if (!selectedParentChildId || !user?.schoolId) return;

        const fetchAssignments = async () => {
            setLoading(true);
            try {
                const studentAssignments = await getStudentAssignments(user.schoolId, selectedParentChildId);
                setAssignments(studentAssignments);
                console.log('[PARENT_ASSIGNMENTS] Fetched assignments:', studentAssignments);
            } catch (error) {
                console.error('[PARENT_ASSIGNMENTS] Fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAssignments();
    }, [selectedParentChildId, user?.schoolId]);

    const getSubmissionStatus = (assignment: AssignmentWithSubmission) => {
        if (!assignment.submissions || assignment.submissions.length === 0) {
            return 'pending';
        }
        return assignment.submissions[0].status;
    };

    const stats = {
        pending: assignments.filter(a => getSubmissionStatus(a) === 'pending').length,
        submitted: assignments.filter(a => getSubmissionStatus(a) === 'submitted').length,
        graded: assignments.filter(a => getSubmissionStatus(a) === 'graded').length,
        total: assignments.length,
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'graded':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'submitted':
                return <Clock className="w-5 h-5 text-blue-500" />;
            case 'pending':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            default:
                return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'graded':
                return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100';
            case 'submitted':
                return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100';
            case 'pending':
                return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100';
            default:
                return '';
        }
    };

    const isOverdue = (dueDate: string, status: string) => {
        return status === 'pending' && new Date(dueDate) < new Date();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-3xl font-bold">Assignments</h1>
                <p className="text-secondary-text mt-1">View {selectedChildData?.firstName}'s assignments</p>
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
                            <p className="text-secondary-text text-sm">Total Assignments</p>
                            <p className="text-3xl font-bold mt-2">{stats.total}</p>
                        </div>
                        <ClipboardList className="w-8 h-8 text-blue-500 opacity-50" />
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
                            <p className="text-secondary-text text-sm">Pending</p>
                            <p className="text-3xl font-bold mt-2 text-red-600">{stats.pending}</p>
                        </div>
                        <AlertCircle className="w-8 h-8 text-red-500 opacity-50" />
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
                            <p className="text-secondary-text text-sm">Submitted</p>
                            <p className="text-3xl font-bold mt-2 text-blue-600">{stats.submitted}</p>
                        </div>
                        <Clock className="w-8 h-8 text-blue-500 opacity-50" />
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
                            <p className="text-secondary-text text-sm">Graded</p>
                            <p className="text-3xl font-bold mt-2 text-green-600">{stats.graded}</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
                    </div>
                </motion.div>
            </div>

            {/* Assignments List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
            >
                <h2 className="text-xl font-semibold mb-4">Assignment Details</h2>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader className="w-6 h-6 animate-spin text-secondary-text" />
                    </div>
                ) : assignments.length === 0 ? (
                    <div className="text-center py-8">
                        <ClipboardList className="w-12 h-12 text-secondary-text opacity-50 mx-auto mb-3" />
                        <p className="text-secondary-text">No assignments found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {assignments.map((assignment) => {
                            const submissionStatus = getSubmissionStatus(assignment);
                            const submission = assignment.submissions?.[0];
                            return (
                                <div
                                    key={assignment.id}
                                    className={`p-4 rounded-lg border ${isOverdue(assignment.due_date, submissionStatus)
                                        ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                                        : 'border-gray-300 dark:border-gray-600 bg-secondary-bg dark:bg-dark-card'
                                        } hover:shadow-md transition-all`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className="mt-1">
                                                {getStatusIcon(submissionStatus)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-lg">{assignment.title}</h3>
                                                    {isOverdue(assignment.due_date, submissionStatus) && (
                                                        <span className="px-2 py-1 text-xs font-bold bg-red-200 dark:bg-red-700 text-red-800 dark:text-red-100 rounded">
                                                            OVERDUE
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-secondary-text mt-1">{assignment.assignment_type} • {assignment.total_marks} marks</p>
                                                {assignment.description && (
                                                    <p className="text-sm text-secondary-text mt-2">{assignment.description}</p>
                                                )}
                                                <div className="flex items-center gap-4 mt-3 text-sm text-secondary-text">
                                                    <span>📅 Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                                                    {submission?.submitted_at && (
                                                        <span>✓ Submitted: {new Date(submission.submitted_at).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                                {submission?.remarks && (
                                                    <div className="mt-3 p-3 rounded bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500">
                                                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Remarks:</p>
                                                        <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">{submission.remarks}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusColor(submissionStatus)}`}>
                                                {submissionStatus}
                                            </span>
                                            {submissionStatus === 'graded' && submission?.score !== undefined && (
                                                <div className="text-right">
                                                    <p className="font-bold text-lg">
                                                        {submission.score}
                                                        <span className="text-sm text-secondary-text"> / {assignment.total_marks}</span>
                                                    </p>
                                                    <p className="text-xs text-secondary-text">
                                                        {Math.round((submission.score / assignment.total_marks) * 100)}%
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
