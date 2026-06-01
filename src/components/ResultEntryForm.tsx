import React, { useState, useEffect } from 'react';
import { resultEntryService } from '@/services/resultEntryService';
import { gradingEngine } from '@/services/gradingEngine';
import type { StudentResult, GradingScale } from '@/types';

interface ResultEntryFormProps {
    schoolId: string;
    teacherId: string;
    classId: string;
    sessionId: string;
    termId: string;
    studentId?: string;
    studentName?: string;
    subjectId?: string;
    subjectName?: string;
    onSuccess?: () => void;
}

interface FormData {
    studentId: string;
    subjectId: string;
    caScore?: number;
    testScore?: number;
    examScore?: number;
    teacherComments?: string;
}

/**
 * Teacher Result Entry Form Component
 * Allows teachers to enter student scores (CA, Test, Exam)
 * Automatically calculates totals and grades
 */
export const ResultEntryForm: React.FC<ResultEntryFormProps> = ({
    schoolId,
    teacherId,
    classId,
    sessionId,
    termId,
    studentId: initialStudentId,
    studentName: initialStudentName,
    subjectId: initialSubjectId,
    subjectName: initialSubjectName,
    onSuccess,
}) => {
    const [formData, setFormData] = useState<FormData>({
        studentId: initialStudentId || '',
        subjectId: initialSubjectId || '',
    });

    const [students, setStudents] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [gradingScale, setGradingScale] = useState<GradingScale | null>(null);
    const [calculatedResult, setCalculatedResult] = useState<{
        totalScore: number;
        grade: string;
        remark: string;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch grading scale
                const scale = await gradingEngine.getDefaultGradingScale(schoolId);
                setGradingScale(scale);

                // TODO: Fetch students from class
                // const { data: studentData } = await supabase
                //   .from('students')
                //   .select('*')
                //   .eq('class_id', classId);
                // setStudents(studentData || []);

                // TODO: Fetch subjects
                // const { data: subjectData } = await supabase
                //   .from('subjects')
                //   .select('*');
                // setSubjects(subjectData || []);
            } catch (err) {
                console.error('Error fetching data:', err);
            }
        };

        fetchData();
    }, [schoolId, classId]);

    // Calculate total and grade when scores change
    useEffect(() => {
        const updateCalculation = async () => {
            const validation = gradingEngine.validateScores({
                caScore: formData.caScore,
                testScore: formData.testScore,
                examScore: formData.examScore,
            });

            if (!validation.valid) {
                setCalculatedResult(null);
                return;
            }

            const totalScore = gradingEngine.calculateTotalScore({
                caScore: formData.caScore,
                testScore: formData.testScore,
                examScore: formData.examScore,
            });

            if (gradingScale) {
                const gradeInfo = await gradingEngine.assignGrade(totalScore, gradingScale.id);
                if (gradeInfo) {
                    setCalculatedResult({
                        totalScore,
                        grade: gradeInfo.grade,
                        remark: gradeInfo.remark,
                    });
                }
            }
        };

        updateCalculation();
    }, [formData.caScore, formData.testScore, formData.examScore, gradingScale]);

    const handleScoreChange = (
        field: 'caScore' | 'testScore' | 'examScore',
        value: string
    ) => {
        const numValue = value === '' ? undefined : parseFloat(value);
        setFormData({
            ...formData,
            [field]: numValue,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (!formData.studentId) {
                setError('Please select a student');
                setLoading(false);
                return;
            }

            if (!formData.subjectId) {
                setError('Please select a subject');
                setLoading(false);
                return;
            }

            if (!gradingScale) {
                setError('Grading scale not found');
                setLoading(false);
                return;
            }

            const result = await resultEntryService.enterResult(
                schoolId,
                teacherId,
                gradingScale.id,
                {
                    studentId: formData.studentId,
                    classId,
                    subjectId: formData.subjectId,
                    sessionId,
                    termId,
                    caScore: formData.caScore,
                    testScore: formData.testScore,
                    examScore: formData.examScore,
                    teacherComments: formData.teacherComments,
                }
            );

            if (result.success) {
                setSuccess('Result saved successfully');
                setFormData({
                    studentId: '',
                    subjectId: '',
                    caScore: undefined,
                    testScore: undefined,
                    examScore: undefined,
                    teacherComments: '',
                });
                setCalculatedResult(null);

                if (onSuccess) {
                    onSuccess();
                }
            } else {
                setError(result.error || 'Failed to save result');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-white to-gray-50 p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">📋 Score Entry</h2>
            <p className="text-gray-600 text-sm mb-6">Enter CA, Test, and Exam scores - total and grade are calculated automatically</p>

            {error && (
                <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border-l-4 border-red-500">{error}</div>
            )}

            {success && (
                <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg border-l-4 border-green-500">{success}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Student & Subject Info Display */}
                {(initialStudentName || initialSubjectName) && (
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {initialStudentName && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Student</p>
                                    <p className="text-lg font-bold text-gray-800">{initialStudentName}</p>
                                </div>
                            )}
                            {initialSubjectName && (
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Subject</p>
                                    <p className="text-lg font-bold text-gray-800">{initialSubjectName}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Score Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            CA Score (0-100)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={formData.caScore ?? ''}
                            onChange={(e) => handleScoreChange('caScore', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Test Score (0-100)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={formData.testScore ?? ''}
                            onChange={(e) => handleScoreChange('testScore', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Exam Score (0-100)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={formData.examScore ?? ''}
                            onChange={(e) => handleScoreChange('examScore', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0-100"
                        />
                    </div>
                </div>

                {/* Auto-calculated Result Display */}
                {calculatedResult && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-gray-600">Total Score</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {calculatedResult.totalScore}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Grade</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {calculatedResult.grade}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Remark</p>
                                <p className="text-lg font-semibold text-gray-800">
                                    {calculatedResult.remark}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Comments */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Teacher Comments (Optional)
                    </label>
                    <textarea
                        value={formData.teacherComments || ''}
                        onChange={(e) =>
                            setFormData({ ...formData, teacherComments: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                        placeholder="Enter any comments about this student's performance..."
                    />
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                    >
                        {loading ? 'Saving...' : 'Save Result'}
                    </button>
                    <button
                        type="reset"
                        onClick={() => {
                            setFormData({
                                studentId: '',
                                subjectId: '',
                                caScore: undefined,
                                testScore: undefined,
                                examScore: undefined,
                                teacherComments: '',
                            });
                            setCalculatedResult(null);
                        }}
                        className="flex-1 bg-gray-300 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-400 transition"
                    >
                        Clear
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ResultEntryForm;
