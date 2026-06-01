import React, { useState, useEffect } from 'react';
import { resultApprovalService } from '@/services/resultApprovalService';
import { reportCardGenerationService } from '@/services/reportCardGenerationService';
import { reportCardAnalyticsService } from '@/services/reportCardAnalyticsService';
import { resultNotificationService } from '@/services/resultNotificationService';
import type { ResultApproval } from '@/types';

interface ReportCardManagementPageProps {
    schoolId: string;
    classId: string;
    sessionId: string;
    termId: string;
    userRole: string;
}

/**
 * Report Card Management Page
 * Complete workflow: Result Entry → Approval → Publication → Parent Access
 */
export const ReportCardManagementPage: React.FC<ReportCardManagementPageProps> = ({
    schoolId,
    classId,
    sessionId,
    termId,
    userRole,
}) => {
    const [approval, setApproval] = useState<ResultApproval | null>(null);
    const [approvalProgress, setApprovalProgress] = useState<{
        draftCount: number;
        submittedCount: number;
        approvedCount: number;
        publishedCount: number;
        totalResults: number;
        progressPercentage: number;
    } | null>(null);
    const [readyForPublishing, setReadyForPublishing] = useState<{
        isReady: boolean;
        reasons: string[];
    }>({ isReady: false, reasons: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'status' | 'analytics' | 'history'>('status');

    // Fetch approval status
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                setLoading(true);

                const approvalData = await resultApprovalService.getApprovalStatus(
                    schoolId,
                    classId,
                    sessionId,
                    termId
                );
                setApproval(approvalData);

                const progress = await resultApprovalService.getApprovalProgress(
                    schoolId,
                    classId,
                    sessionId,
                    termId
                );
                setApprovalProgress(progress);

                const readiness = await resultApprovalService.isReadyForPublishing(
                    schoolId,
                    classId,
                    sessionId,
                    termId
                );
                setReadyForPublishing(readiness);
            } catch (err: any) {
                setError(err.message || 'Failed to load approval status');
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
    }, [schoolId, classId, sessionId, termId]);

    const handleSubmitResults = async () => {
        try {
            setError('');
            setSuccess('');

            // TODO: Get current user ID
            const currentUserId = '';

            const result = await resultApprovalService.submitResults(
                schoolId,
                classId,
                sessionId,
                termId,
                currentUserId,
                ''
            );

            if (result.success) {
                setSuccess('Results submitted for approval');
                setApproval((prev) =>
                    prev ? { ...prev, current_status: 'submitted' } : null
                );
            } else {
                setError(result.error || 'Failed to submit results');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        }
    };

    const handleApproveResults = async () => {
        try {
            setError('');
            setSuccess('');

            // TODO: Get current user ID
            const currentUserId = '';

            const result = await resultApprovalService.approveResults(
                schoolId,
                classId,
                sessionId,
                termId,
                currentUserId
            );

            if (result.success) {
                setSuccess('Results approved');
                setApproval((prev) =>
                    prev ? { ...prev, current_status: 'approved' } : null
                );
            } else {
                setError(result.error || 'Failed to approve results');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        }
    };

    const handlePublishResults = async () => {
        try {
            if (!readyForPublishing.isReady) {
                setError(`Cannot publish: ${readyForPublishing.reasons.join(', ')}`);
                return;
            }

            setError('');
            setSuccess('');

            // TODO: Get current user ID
            const currentUserId = '';

            // Publish results
            const publishResult = await resultApprovalService.publishResults(
                schoolId,
                classId,
                sessionId,
                termId,
                currentUserId
            );

            if (!publishResult.success) {
                setError(publishResult.error || 'Failed to publish results');
                return;
            }

            // Generate report cards
            const reportResult = await reportCardGenerationService.generateClassReportCards(
                schoolId,
                classId,
                sessionId,
                termId
            );

            if (!reportResult.success) {
                setError(`Generated ${reportResult.generatedCount} report cards, ${reportResult.failedCount} failed`);
                return;
            }

            // Send notifications
            await resultNotificationService.notifyClassReportRelease(
                schoolId,
                classId,
                sessionId,
                termId
            );

            setSuccess(
                `Results published and ${reportResult.generatedCount} report cards generated`
            );
            setApproval((prev) =>
                prev ? { ...prev, current_status: 'published' } : null
            );
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <p className="text-gray-600">Loading...</p>
            </div>
        );
    }

    const statusColors: { [key: string]: string } = {
        draft: 'bg-gray-100 text-gray-800',
        submitted: 'bg-blue-100 text-blue-800',
        approved: 'bg-green-100 text-green-800',
        published: 'bg-purple-100 text-purple-800',
        rejected: 'bg-red-100 text-red-800',
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Report Card Management</h1>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded-lg">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 p-4 rounded-lg">
                    {success}
                </div>
            )}

            {/* Current Status */}
            {approval && (
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Current Status</h2>
                    <div className="flex items-center gap-4">
                        <div
                            className={`px-6 py-3 rounded-full font-bold text-lg ${statusColors[approval.current_status]
                                }`}
                        >
                            {approval.current_status?.toUpperCase()}
                        </div>
                        <div className="text-gray-600">
                            Updated: {approval.updated_at ? new Date(approval.updated_at).toLocaleDateString() : 'N/A'}
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            {approvalProgress && (
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Approval Progress</h3>
                    <div className="mb-4">
                        <div className="w-full bg-gray-200 rounded-full h-4">
                            <div
                                className="bg-blue-600 h-4 rounded-full transition-all"
                                style={{ width: `${approvalProgress.progressPercentage}%` }}
                            />
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                            {approvalProgress.progressPercentage}% Complete
                        </p>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-4 rounded">
                            <p className="text-sm text-gray-600">Draft</p>
                            <p className="text-2xl font-bold">{approvalProgress.draftCount}</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded">
                            <p className="text-sm text-gray-600">Submitted</p>
                            <p className="text-2xl font-bold">{approvalProgress.submittedCount}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded">
                            <p className="text-sm text-gray-600">Approved</p>
                            <p className="text-2xl font-bold">{approvalProgress.approvedCount}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded">
                            <p className="text-sm text-gray-600">Published</p>
                            <p className="text-2xl font-bold">{approvalProgress.publishedCount}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Workflow Actions */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Workflow Actions</h3>

                <div className="space-y-4">
                    {/* Submit Button */}
                    {approval?.current_status === 'draft' && userRole === 'teacher' && (
                        <button
                            onClick={handleSubmitResults}
                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-semibold"
                        >
                            Submit for Approval
                        </button>
                    )}

                    {/* Approve Button */}
                    {approval?.current_status === 'submitted' && userRole === 'principal' && (
                        <button
                            onClick={handleApproveResults}
                            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 font-semibold"
                        >
                            Approve Results
                        </button>
                    )}

                    {/* Publish Button */}
                    {approval?.current_status === 'approved' && userRole === 'principal' && (
                        <div className="space-y-4">
                            {!readyForPublishing.isReady && (
                                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                                    <p className="text-sm text-yellow-800 font-semibold mb-2">
                                        Not ready for publishing:
                                    </p>
                                    <ul className="text-sm text-yellow-700 space-y-1">
                                        {readyForPublishing.reasons.map((reason, idx) => (
                                            <li key={idx}>• {reason}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <button
                                onClick={handlePublishResults}
                                disabled={!readyForPublishing.isReady}
                                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 font-semibold disabled:bg-gray-400"
                            >
                                Publish & Generate Reports
                            </button>
                        </div>
                    )}

                    {approval?.current_status === 'published' && (
                        <div className="bg-green-50 border border-green-200 p-4 rounded text-center">
                            <p className="text-green-800 font-semibold">
                                ✓ Results published and report cards generated
                            </p>
                            <p className="text-sm text-green-700 mt-2">
                                Parents and students have been notified
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow">
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('status')}
                        className={`flex-1 py-4 font-semibold ${activeTab === 'status'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        Status & Progress
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`flex-1 py-4 font-semibold ${activeTab === 'analytics'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        Analytics
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-4 font-semibold ${activeTab === 'history'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        History
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'status' && (
                        <div className="text-gray-600">
                            <p>Results workflow and approval progress shown above</p>
                        </div>
                    )}

                    {activeTab === 'analytics' && (
                        <div className="text-gray-600">
                            <p>Analytics and performance insights will be displayed here</p>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="text-gray-600">
                            <p>Historical records and previous report cards will be displayed here</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportCardManagementPage;
