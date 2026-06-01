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
import { reportCardService } from '@/services/reportCardService';

interface ReportCardGeneratorProps {
    schoolId: string;
    sessionId: string;
    termId: string;
    classId?: string;
}

export const ReportCardGenerator: React.FC<ReportCardGeneratorProps> = ({
    schoolId,
    sessionId,
    termId,
    classId,
}) => {
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedCard, setGeneratedCard] = useState<any>(null);

    // Fetch students
    const { data: students } = useQuery({
        queryKey: ['classStudents', classId],
        queryFn: async () => {
            if (!classId) return [];
            const response = await fetch(`/api/classes/${classId}/students`);
            return response.json();
        },
        enabled: !!classId,
    });

    const handleGenerateCard = async () => {
        if (!selectedStudent) return;

        setIsGenerating(true);
        try {
            const result = await reportCardService.generateReportCard(
                selectedStudent,
                sessionId,
                termId
            );

            if (result.success) {
                setGeneratedCard(result.data);
            } else {
                alert('Failed to generate report card');
            }
        } catch (error) {
            console.error('Error generating report card:', error);
            alert('Error generating report card');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExportPDF = async () => {
        if (!generatedCard) return;

        try {
            const result = await reportCardService.exportReportCardPDF(generatedCard);
            if (result.success) {
                alert(`Report card ready for export: ${result.pdfRef}`);
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
        }
    };

    const handleShareWithParent = async () => {
        if (!generatedCard) return;

        try {
            // In a real app, you'd fetch the parent ID
            // For now, this is a placeholder
            alert('Parent sharing functionality would be implemented here');
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Selection Panel */}
            <Card>
                <CardHeader>
                    <CardTitle>Generate Report Card</CardTitle>
                    <CardDescription>Select a student to generate their report card</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Select Student</label>
                        <select
                            value={selectedStudent || ''}
                            onChange={(e) => setSelectedStudent(e.target.value || null)}
                            className="w-full px-3 py-2 border rounded-md"
                        >
                            <option value="">Choose a student...</option>
                            {students?.map((student: any) => (
                                <option key={student.id} value={student.id}>
                                    {student.first_name} {student.last_name} ({student.admission_number})
                                </option>
                            ))}
                        </select>
                    </div>

                    <Button
                        onClick={handleGenerateCard}
                        disabled={!selectedStudent || isGenerating}
                        className="w-full"
                    >
                        {isGenerating ? 'Generating...' : 'Generate Report Card'}
                    </Button>
                </CardContent>
            </Card>

            {/* Generated Report Card */}
            {generatedCard && (
                <div className="space-y-4">
                    {/* Header */}
                    <Card>
                        <CardHeader className="bg-blue-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-2xl">{generatedCard.student.name}</CardTitle>
                                    <CardDescription>
                                        Admission #: {generatedCard.student.admissionNumber}
                                    </CardDescription>
                                </div>
                                <div className="text-right text-sm text-gray-600">
                                    <p>Session: {generatedCard.session}</p>
                                    <p>Term: {generatedCard.term}</p>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* Academic Performance */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Academic Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-2 font-medium">Subject</th>
                                            <th className="text-center py-2 font-medium">CA1</th>
                                            <th className="text-center py-2 font-medium">CA2</th>
                                            <th className="text-center py-2 font-medium">CA3</th>
                                            <th className="text-center py-2 font-medium">Test</th>
                                            <th className="text-center py-2 font-medium">Exam</th>
                                            <th className="text-center py-2 font-medium">Total</th>
                                            <th className="text-center py-2 font-medium">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {generatedCard.academicPerformance.subjects.map((subject: any) => (
                                            <tr key={subject.name} className="border-b hover:bg-gray-50">
                                                <td className="py-2 font-medium">{subject.name}</td>
                                                <td className="text-center">{subject.ca1 || '-'}</td>
                                                <td className="text-center">{subject.ca2 || '-'}</td>
                                                <td className="text-center">{subject.ca3 || '-'}</td>
                                                <td className="text-center">{subject.test || '-'}</td>
                                                <td className="text-center">{subject.exam || '-'}</td>
                                                <td className="text-center font-bold">{subject.total}</td>
                                                <td className="text-center font-bold text-blue-600">{subject.grade}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
                                <div>
                                    <p className="text-sm text-gray-600">Class Average</p>
                                    <p className="text-2xl font-bold">
                                        {generatedCard.academicPerformance.averageScore?.toFixed(1) || 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Total Subjects</p>
                                    <p className="text-2xl font-bold">
                                        {generatedCard.academicPerformance.totalSubjects}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Class Position</p>
                                    <p className="text-2xl font-bold">
                                        {generatedCard.academicPerformance.classPosition || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Attendance */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Attendance Record</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Present</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {generatedCard.attendance.presentDays}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Absent</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        {generatedCard.attendance.absentDays}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Late</p>
                                    <p className="text-2xl font-bold text-yellow-600">
                                        {generatedCard.attendance.lateDays}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Total Days</p>
                                    <p className="text-2xl font-bold">{generatedCard.attendance.totalDays}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Percentage</p>
                                    <p className="text-2xl font-bold">
                                        {generatedCard.attendance.percentage.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Behaviour */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Behaviour & Conduct</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Behaviour Score</p>
                                    <p className="text-2xl font-bold">{generatedCard.behaviour.score}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Merits</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {generatedCard.behaviour.merits}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Demerits</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        {generatedCard.behaviour.demerits}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Commendations</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {generatedCard.behaviour.commendations}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Risk Assessment */}
                    {generatedCard.riskAssessment && (
                        <Card className={`border-2 ${generatedCard.riskAssessment.riskLevel === 'high' ? 'border-red-300' :
                                generatedCard.riskAssessment.riskLevel === 'medium' ? 'border-yellow-300' :
                                    'border-green-300'
                            }`}>
                            <CardHeader>
                                <CardTitle>Risk Assessment</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Risk Score</p>
                                        <p className="text-2xl font-bold">{generatedCard.riskAssessment.riskScore}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Risk Level</p>
                                        <p className={`text-2xl font-bold capitalize ${generatedCard.riskAssessment.riskLevel === 'high' ? 'text-red-600' :
                                                generatedCard.riskAssessment.riskLevel === 'medium' ? 'text-yellow-600' :
                                                    'text-green-600'
                                            }`}>
                                            {generatedCard.riskAssessment.riskLevel}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Export Options */}
                    <div className="flex gap-2">
                        <Button onClick={handleExportPDF} className="flex-1" variant="outline">
                            Export as PDF
                        </Button>
                        <Button onClick={handleShareWithParent} className="flex-1" variant="outline">
                            Share with Parent
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportCardGenerator;
