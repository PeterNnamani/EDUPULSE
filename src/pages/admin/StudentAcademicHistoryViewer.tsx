import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts';
import { academicHistoryService } from '@/services/academicHistoryService';
import { studentService } from '@/services/studentService';

interface StudentAcademicHistoryViewerProps {
    studentId: string;
}

export const StudentAcademicHistoryViewer: React.FC<StudentAcademicHistoryViewerProps> = ({
    studentId,
}) => {
    const [viewMode, setViewMode] = useState<'timeline' | 'trends' | 'details'>('timeline');

    // Fetch student info
    const { data: student } = useQuery({
        queryKey: ['student', studentId],
        queryFn: async () => {
            const { data } = await studentService.getStudent(studentId);
            return data;
        },
    });

    // Fetch academic history
    const { data: academicHistory, isLoading: historyLoading } = useQuery({
        queryKey: ['academicHistory', studentId],
        queryFn: async () => {
            const result = await academicHistoryService.getStudentAcademicHistory(studentId);
            return result.records;
        },
    });

    // Fetch class progression
    const { data: progression } = useQuery({
        queryKey: ['classProgression', studentId],
        queryFn: async () => {
            const result = await academicHistoryService.getStudentClassProgression(studentId);
            return result.progression;
        },
    });

    // Fetch performance trends
    const { data: trends } = useQuery({
        queryKey: ['performanceTrend', studentId],
        queryFn: async () => {
            const result = await academicHistoryService.getPerformanceTrend(studentId);
            return result;
        },
    });

    // Fetch graduation record
    const { data: graduationRecord } = useQuery({
        queryKey: ['graduationRecord', studentId],
        queryFn: async () => {
            const result = await academicHistoryService.getGraduationRecord(studentId);
            return result.data;
        },
    });

    const handleExportHistory = async () => {
        try {
            const result = await academicHistoryService.exportStudentHistory(studentId);
            if (result.data) {
                // Trigger download
                const dataStr = JSON.stringify(result.data, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${student?.first_name}_${student?.last_name}_history.json`;
                link.click();
            }
        } catch (error) {
            console.error('Error exporting history:', error);
        }
    };

    if (historyLoading) {
        return <div>Loading academic history...</div>;
    }

    // Prepare chart data for performance trends
    const performanceChartData = trends?.results?.map((result: any, index: number) => ({
        term: `Term ${index + 1}`,
        academicScore: result.average_score || 0,
        attendance: trends?.attendance?.[index]?.attendance_percentage || 0,
        riskScore: trends?.risk?.[index]?.risk_score || 0,
    })) || [];

    return (
        <div className="space-y-6">
            {/* Student Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>
                                {student?.first_name} {student?.last_name}
                            </CardTitle>
                            <CardDescription>
                                Admission #: {student?.admission_number} | ID: {student?.student_id}
                            </CardDescription>
                        </div>
                        {graduationRecord && (
                            <div className="text-right">
                                <p className="text-sm font-medium text-green-600">Graduated</p>
                                <p className="text-xs text-gray-600">
                                    {new Date(graduationRecord.graduation_date).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {/* View Mode Selector */}
            <div className="flex gap-2">
                <Button
                    variant={viewMode === 'timeline' ? 'default' : 'outline'}
                    onClick={() => setViewMode('timeline')}
                >
                    Timeline View
                </Button>
                <Button
                    variant={viewMode === 'trends' ? 'default' : 'outline'}
                    onClick={() => setViewMode('trends')}
                >
                    Performance Trends
                </Button>
                <Button
                    variant={viewMode === 'details' ? 'default' : 'outline'}
                    onClick={() => setViewMode('details')}
                >
                    Detailed View
                </Button>
                <Button variant="outline" onClick={handleExportHistory} className="ml-auto">
                    Export History
                </Button>
            </div>

            {/* Timeline View */}
            {viewMode === 'timeline' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Academic Timeline</CardTitle>
                        <CardDescription>Complete academic journey</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {academicHistory?.map((record: any, index: number) => (
                                <div key={record.id} className="relative pb-4 pl-4 border-l-2 border-blue-300">
                                    <div className="absolute -left-3 top-0 w-4 h-4 bg-blue-400 rounded-full"></div>

                                    <div className="space-y-1">
                                        <p className="font-medium">
                                            {record.academic_sessions?.name} - {record.academic_terms?.name}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Class: {record.classes?.name} ({record.classes?.grade_level})
                                        </p>

                                        <div className="flex flex-wrap gap-4 mt-2 text-sm">
                                            {record.average_score && (
                                                <span>
                                                    Average: <span className="font-bold">{record.average_score.toFixed(1)}</span>
                                                </span>
                                            )}
                                            {record.attendance_rate && (
                                                <span>
                                                    Attendance: <span className="font-bold">{record.attendance_rate.toFixed(1)}%</span>
                                                </span>
                                            )}
                                            {record.behaviour_score && (
                                                <span>
                                                    Behaviour: <span className="font-bold">{record.behaviour_score}</span>
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm font-medium mt-2">
                                            Status:{' '}
                                            <span className={`
                        ${record.promotion_status === 'promoted' ? 'text-green-600' : ''}
                        ${record.promotion_status === 'repeat' ? 'text-yellow-600' : ''}
                        ${record.promotion_status === 'graduated' ? 'text-blue-600' : ''}
                      `}>
                                                {record.promotion_status ? record.promotion_status.charAt(0).toUpperCase() + record.promotion_status.slice(1) : '—'}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Performance Trends */}
            {viewMode === 'trends' && performanceChartData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Performance Trends</CardTitle>
                        <CardDescription>Academic score, attendance, and risk trends over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={performanceChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="term" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="academicScore"
                                    stroke="#3b82f6"
                                    name="Academic Score"
                                    strokeWidth={2}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="attendance"
                                    stroke="#10b981"
                                    name="Attendance %"
                                    strokeWidth={2}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="riskScore"
                                    stroke="#ef4444"
                                    name="Risk Score"
                                    strokeWidth={2}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Class Progression */}
            {progression && progression.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Class Progression</CardTitle>
                        <CardDescription>Student's journey through different classes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {progression.map((prog: any, index: number) => (
                                <div key={index} className="flex items-center gap-2">
                                    <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                        {prog.class}
                                    </div>
                                    {index < progression.length - 1 && (
                                        <div className="text-gray-400">→</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Detailed Records */}
            {viewMode === 'details' && (
                <div className="grid grid-cols-1 gap-4">
                    {academicHistory?.map((record: any) => (
                        <Card key={record.id}>
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {record.academic_sessions?.name} - {record.academic_terms?.name}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Class</p>
                                    <p className="font-medium">{record.classes?.name}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Average Score</p>
                                    <p className="font-medium">{record.average_score?.toFixed(1) || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Attendance</p>
                                    <p className="font-medium">{record.attendance_rate?.toFixed(1) || 'N/A'}%</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Behaviour</p>
                                    <p className="font-medium">{record.behaviour_score || 'N/A'}</p>
                                </div>
                                {record.risk_level && (
                                    <div>
                                        <p className="text-sm text-gray-600">Risk Level</p>
                                        <p className={`font-medium capitalize ${record.risk_level === 'low' ? 'text-green-600' :
                                                record.risk_level === 'medium' ? 'text-yellow-600' :
                                                    record.risk_level === 'high' ? 'text-orange-600' :
                                                        'text-red-600'
                                            }`}>
                                            {record.risk_level}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StudentAcademicHistoryViewer;
