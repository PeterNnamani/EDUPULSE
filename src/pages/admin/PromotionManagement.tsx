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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { promotionEngine } from '@/services/promotionEngine';
import { sessionManagementService } from '@/services/sessionManagementService';

interface PromotionManagementProps {
    schoolId: string;
    sessionId: string;
    classId: string;
}

export const PromotionManagement: React.FC<PromotionManagementProps> = ({
    schoolId,
    sessionId,
    classId,
}) => {
    const [processingClass, setProcessingClass] = useState(false);
    const [selectedAction, setSelectedAction] = useState<'all' | 'manual'>('all');

    // Fetch students in class
    const { data: students, isLoading } = useQuery({
        queryKey: ['classStudents', classId],
        queryFn: async () => {
            const response = await fetch(
                `/api/classes/${classId}/students`
            );
            const data = await response.json();
            return data;
        },
    });

    // Fetch promotion rules
    const { data: rules } = useQuery({
        queryKey: ['promotionRules', schoolId],
        queryFn: async () => {
            const result = await promotionEngine.getPromotionRules(schoolId);
            return result.data;
        },
    });

    // Check eligibility for each student
    const { data: eligibilityResults } = useQuery({
        queryKey: ['promotionEligibility', students?.map((s: any) => s.id)],
        queryFn: async () => {
            if (!students) return [];

            const results = [];
            for (const student of students) {
                const matchingRule = rules?.find((r: any) => r.from_class_id === classId);
                if (matchingRule) {
                    const eligibility = await promotionEngine.checkPromotionEligibility(
                        student.id,
                        sessionId,
                        classId,
                        matchingRule.to_class_id,
                        schoolId
                    );
                    results.push({
                        studentId: student.id,
                        studentName: `${student.first_name} ${student.last_name}`,
                        eligibility,
                    });
                }
            }
            return results;
        },
        enabled: !!(students && rules),
    });

    const handleBatchPromotion = async () => {
        setProcessingClass(true);
        try {
            const matchingRule = rules?.find((r: any) => r.from_class_id === classId);
            if (!matchingRule) {
                alert('No promotion rule found for this class');
                return;
            }

            const result = await promotionEngine.processBatchPromotions(
                schoolId,
                sessionId,
                classId,
                matchingRule.to_class_id
            );

            alert(
                `Promotions processed:\nPromoted: ${result.promoted}\nRepeated: ${result.repeated}\nManual Review: ${result.manualReview}`
            );
        } catch (error) {
            console.error('Error processing promotions:', error);
            alert('Error processing promotions');
        } finally {
            setProcessingClass(false);
        }
    };

    const getEligibilityColor = (status: string) => {
        switch (status) {
            case 'promoted':
                return 'text-green-600 bg-green-50';
            case 'repeat':
                return 'text-yellow-600 bg-yellow-50';
            case 'manual_review':
                return 'text-blue-600 bg-blue-50';
            default:
                return 'text-gray-600 bg-gray-50';
        }
    };

    const promotedCount = eligibilityResults?.filter(
        (r: any) => r.eligibility.status === 'promoted'
    ).length || 0;

    const repeatCount = eligibilityResults?.filter(
        (r: any) => r.eligibility.status === 'repeat'
    ).length || 0;

    const manualCount = eligibilityResults?.filter(
        (r: any) => r.eligibility.status === 'manual_review'
    ).length || 0;

    if (isLoading) {
        return <div>Loading promotion data...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Students</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{students?.length || 0}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-green-600">Eligible for Promotion</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-green-600">{promotedCount}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-yellow-600">For Repetition</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-yellow-600">{repeatCount}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-blue-600">Manual Review</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-blue-600">{manualCount}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Promotion Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Student Promotion Eligibility</CardTitle>
                    <CardDescription>Review and process student promotions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <Button
                            onClick={handleBatchPromotion}
                            disabled={processingClass || promotedCount === 0}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {processingClass ? 'Processing...' : 'Process All Promotions'}
                        </Button>
                    </div>

                    {/* Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student Name</TableHead>
                                    <TableHead>Average Score</TableHead>
                                    <TableHead>Attendance</TableHead>
                                    <TableHead>Behaviour</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reason</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {eligibilityResults?.map((result: any) => (
                                    <TableRow key={result.studentId}>
                                        <TableCell className="font-medium">{result.studentName}</TableCell>
                                        <TableCell>
                                            {result.eligibility.checks?.grades ? '✓' : '✗'}
                                        </TableCell>
                                        <TableCell>
                                            {result.eligibility.checks?.attendance ? '✓' : '✗'}
                                        </TableCell>
                                        <TableCell>
                                            {result.eligibility.checks?.behaviour ? '✓' : '✗'}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded text-sm font-medium ${getEligibilityColor(result.eligibility.status)}`}>
                                                {result.eligibility.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-600">
                                            {result.eligibility.reason}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PromotionManagement;
