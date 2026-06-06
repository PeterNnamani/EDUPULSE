import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, CheckCircle, Clock, AlertCircle, Loader, Upload } from 'lucide-react';
import { useAppStore } from '@/store';
import {
    getStudentAssignments,
    submitAssignment,
    SUBMISSION_OPTION_LABELS,
    type SubmissionOption,
} from '@/services/assignmentService';
import ParentChildPageHeader from '@/components/parent/ParentChildPageHeader';

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
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [activeAssignment, setActiveAssignment] = useState<AssignmentWithSubmission | null>(null);
    const [submissionOption, setSubmissionOption] = useState<SubmissionOption>('homework_completed');
    const [submissionNotes, setSubmissionNotes] = useState('');
    const [submitError, setSubmitError] = useState('');

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

    const refreshAssignments = async () => {
        if (!selectedParentChildId || !user?.schoolId) return;
        const studentAssignments = await getStudentAssignments(user.schoolId, selectedParentChildId);
        setAssignments(studentAssignments);
    };

    const openSubmitModal = (assignment: AssignmentWithSubmission) => {
        setActiveAssignment(assignment);
        setSubmissionOption('homework_completed');
        setSubmissionNotes('');
        setSubmitError('');
        setShowSubmitModal(true);
    };

    const handleParentSubmit = async () => {
        if (!activeAssignment || !selectedParentChildId || !user?.schoolId) return;
        setSubmittingId(activeAssignment.id);
        setSubmitError('');

        const result = await submitAssignment(
            user.schoolId,
            activeAssignment.id,
            selectedParentChildId,
            {
                submissionOption,
                submittedBy: 'parent',
                notes: submissionNotes,
            }
        );

        setSubmittingId(null);

        if (result.success) {
            setShowSubmitModal(false);
            setActiveAssignment(null);
            await refreshAssignments();
        } else {
            setSubmitError(result.error || 'Failed to submit');
        }
    };

    return (
        <div className="space-y-6">
            <ParentChildPageHeader title="Assignments" subtitleSuffix="assignments" />

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
                                            {(submissionStatus === 'pending' || submissionStatus === 'late') && (
                                                <button
                                                    type="button"
                                                    onClick={() => openSubmitModal(assignment)}
                                                    disabled={submittingId === assignment.id}
                                                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    <Upload className="w-3.5 h-3.5" />
                                                    Mark Submitted
                                                </button>
                                            )}
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

            {showSubmitModal && activeAssignment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-dark-bg rounded-2xl shadow-xl"
                    >
                        <div className="p-6 border-b border-border dark:border-gray-800">
                            <h2 className="text-xl font-bold">Submit Assignment</h2>
                            <p className="text-sm text-secondary-text mt-1">{activeAssignment.title}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="label mb-1.5 block">Submission type</label>
                                <select
                                    className="input-field"
                                    value={submissionOption}
                                    onChange={(e) => setSubmissionOption(e.target.value as SubmissionOption)}
                                >
                                    {(Object.entries(SUBMISSION_OPTION_LABELS) as [SubmissionOption, string][]).map(
                                        ([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        )
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="label mb-1.5 block">Notes (optional)</label>
                                <textarea
                                    className="input-field min-h-20"
                                    value={submissionNotes}
                                    onChange={(e) => setSubmissionNotes(e.target.value)}
                                    placeholder="Any details for the teacher..."
                                />
                            </div>
                            {submitError && (
                                <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                            )}
                        </div>
                        <div className="p-6 border-t border-border dark:border-gray-800 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowSubmitModal(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleParentSubmit}
                                disabled={submittingId === activeAssignment.id}
                                className="btn-primary disabled:opacity-50"
                            >
                                {submittingId === activeAssignment.id ? 'Submitting...' : 'Confirm Submit'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
