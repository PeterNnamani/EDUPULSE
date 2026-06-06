import React, { useState, useEffect } from 'react';
import { reportCardGenerationService } from '@/services/reportCardGenerationService';
import { resultNotificationService } from '@/services/resultNotificationService';
import { useAppStore } from '@/store';
import type { ReportCard, StudentResult } from '@/types';

interface ReportCardViewerProps {
    studentId: string;
    sessionId?: string;
    termId?: string;
    parentId?: string;
    isParent?: boolean;
}

/**
 * Report Card Viewer Component
 * Displays professional report cards for students and parents
 */
export const ReportCardViewer: React.FC<ReportCardViewerProps> = ({
    studentId,
    sessionId,
    termId,
    parentId,
    isParent = false,
}) => {
    const { user } = useAppStore();
    const schoolId = user?.schoolId ?? '';
    const [reportCard, setReportCard] = useState<ReportCard | null>(null);
    const [reportHistory, setReportHistory] = useState<ReportCard[]>([]);
    const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
    const [selectedTerm, setSelectedTerm] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [printing, setPrinting] = useState(false);

    // Fetch report cards
    useEffect(() => {
        const fetchReportCards = async () => {
            if (!schoolId) {
                setLoading(false);
                return;
            }
            try {
                setLoading(true);

                // Get report history
                const history = await reportCardGenerationService.getStudentReportCardHistory(
                    schoolId,
                    studentId
                );
                setReportHistory(history);

                // Select first available or specified term
                if (sessionId && termId) {
                    const selected = history.find(
                        (rc) => rc.sessionId === sessionId && rc.termId === termId
                    );
                    if (selected) {
                        setReportCard(selected);
                        setSelectedTerm(`${selected.sessionId}-${selected.termId}`);
                    }
                } else if (history.length > 0) {
                    setReportCard(history[0]);
                    setSelectedTerm(
                        `${history[0].sessionId}-${history[0].termId}`
                    );
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load report cards');
            } finally {
                setLoading(false);
            }
        };

        fetchReportCards();
    }, [studentId, sessionId, termId, schoolId]);

    // Record parent access
    useEffect(() => {
        if (isParent && parentId && reportCard) {
            recordAccess();
        }
    }, [reportCard, isParent, parentId]);

    const recordAccess = async () => {
        try {
            if (!schoolId) return;

            if (parentId && reportCard) {
                await resultNotificationService.recordParentAccess(
                    schoolId,
                    parentId,
                    studentId,
                    reportCard.id,
                    false,
                    false
                );
            }
        } catch (err) {
            console.error('Error recording access:', err);
        }
    };

    const handleTermChange = (termKey: string) => {
        const selected = reportHistory.find(
            (rc) => `${rc.sessionId}-${rc.termId}` === termKey
        );
        if (selected) {
            setReportCard(selected);
            setSelectedTerm(termKey);
        }
    };

    const handlePrint = () => {
        setPrinting(true);
        setTimeout(() => {
            window.print();
            setPrinting(false);
        }, 500);
    };

    const handleDownloadPDF = async () => {
        // TODO: Implement PDF generation and download
        console.log('Download PDF');
        if (isParent && parentId && reportCard && schoolId) {
            await resultNotificationService.recordParentAccess(
                schoolId,
                parentId,
                studentId,
                reportCard.id,
                true,
                false
            );
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <p className="text-gray-600">Loading report card...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded">
                {error}
            </div>
        );
    }

    if (!reportCard) {
        return (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded">
                No report cards available
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Term Selection */}
            {reportHistory.length > 1 && (
                <div className="bg-white p-4 rounded-lg shadow">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Term
                    </label>
                    <select
                        value={selectedTerm}
                        onChange={(e) => handleTermChange(e.target.value)}
                        className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        {reportHistory.map((rc) => (
                            <option key={`${rc.sessionId}-${rc.termId}`} value={`${rc.sessionId}-${rc.termId}`}>
                                {rc.sessionId} - {rc.termId}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={handlePrint}
                    disabled={printing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {printing ? 'Preparing...' : 'Print'}
                </button>
                <button
                    onClick={handleDownloadPDF}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                    Download PDF
                </button>
            </div>

            {/* Report Card */}
            <div className="bg-white p-8 rounded-lg shadow-lg print:shadow-none print:p-0">
                {/* Header */}
                <div className="text-center border-b-2 pb-6 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Report Card</h1>
                    <p className="text-gray-600 mt-2">
                        {reportCard.sessionId} - {reportCard.termId}
                    </p>
                </div>

                {/* Student Information */}
                <div className="grid grid-cols-2 gap-4 mb-8 pb-6 border-b">
                    <div>
                        <p className="text-sm text-gray-600">Student Name</p>
                        <p className="font-semibold text-lg">
                            {/* TODO: Get student name */}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Admission Number</p>
                        <p className="font-semibold text-lg">
                            {/* TODO: Get admission number */}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Class</p>
                        <p className="font-semibold text-lg">
                            {/* TODO: Get class name */}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Position</p>
                        <p className="font-semibold text-lg">
                            {reportCard.classPosition}
                            {reportCard.classPosition === 1 && 'st'}
                            {reportCard.classPosition === 2 && 'nd'}
                            {reportCard.classPosition === 3 && 'rd'}
                            {reportCard.classPosition > 3 && 'th'}
                        </p>
                    </div>
                </div>

                {/* Academic Performance */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Academic Performance</h2>
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600">Total Subjects</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {reportCard.totalSubjects}
                            </p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600">Average Score</p>
                            <p className="text-2xl font-bold text-green-600">
                                {reportCard.averageScore}
                            </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600">Overall Grade</p>
                            <p className="text-2xl font-bold text-purple-600">
                                {reportCard.overallGrade}
                            </p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600">Total Marks</p>
                            <p className="text-2xl font-bold text-orange-600">
                                {reportCard.totalMarks}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Attendance */}
                <div className="mb-8 pb-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Attendance</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Days Present</p>
                            <p className="text-xl font-bold">{reportCard.attendanceDaysPresent}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Days Absent</p>
                            <p className="text-xl font-bold">{reportCard.attendanceDaysAbsent}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Attendance %</p>
                            <p className="text-xl font-bold text-green-600">
                                {reportCard.attendancePercentage}%
                            </p>
                        </div>
                    </div>
                </div>

                {/* Behaviour */}
                <div className="mb-8 pb-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Behaviour & Conduct</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Rating</p>
                            <p className="text-xl font-bold">{reportCard.behaviourRating}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Merits</p>
                            <p className="text-xl font-bold text-green-600">
                                {reportCard.behaviourMerits}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Demerits</p>
                            <p className="text-xl font-bold text-red-600">
                                {reportCard.behaviourDemerits}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Risk Assessment */}
                {reportCard.riskLevel && (
                    <div className="mb-8 pb-6 border-b">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Risk Assessment</h3>
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-sm text-gray-600">Risk Level</p>
                                <p
                                    className={`text-xl font-bold ${reportCard.riskLevel === 'low'
                                            ? 'text-green-600'
                                            : reportCard.riskLevel === 'medium'
                                                ? 'text-yellow-600'
                                                : reportCard.riskLevel === 'high'
                                                    ? 'text-orange-600'
                                                    : 'text-red-600'
                                        }`}
                                >
                                    {reportCard.riskLevel?.toUpperCase()}
                                </p>
                            </div>
                            {reportCard.riskScore && (
                                <div>
                                    <p className="text-sm text-gray-600">Risk Score</p>
                                    <p className="text-xl font-bold">{reportCard.riskScore}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Comments */}
                {reportCard.classTeacherComment && (
                    <div className="mb-8 pb-6 border-b">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            Class Teacher's Comment
                        </h3>
                        <p className="text-gray-700 italic">{reportCard.classTeacherComment}</p>
                    </div>
                )}

                {reportCard.principalComment && (
                    <div className="mb-8 pb-6 border-b">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            Principal's Remarks
                        </h3>
                        <p className="text-gray-700 italic">{reportCard.principalComment}</p>
                    </div>
                )}

                {/* Promotion Status */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Promotion Status</h3>
                    <p
                        className={`text-lg font-bold ${reportCard.promotionStatus === 'promoted'
                                ? 'text-green-600'
                                : reportCard.promotionStatus === 'repeat'
                                    ? 'text-red-600'
                                    : 'text-orange-600'
                            }`}
                    >
                        {reportCard.promotionStatus?.toUpperCase()}
                    </p>
                </div>

                {/* Footer */}
                <div className="mt-12 pt-8 border-t text-center text-xs text-gray-500 print:text-gray-400">
                    <p>This is an official report card. Generated on {reportCard.publishedAt}</p>
                </div>
            </div>
        </div>
    );
};

export default ReportCardViewer;
