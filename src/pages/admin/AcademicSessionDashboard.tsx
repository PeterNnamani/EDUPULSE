import React, { useEffect, useState } from 'react';
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
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { sessionManagementService } from '@/services/sessionManagementService';
import { sessionRolloverService } from '@/services/sessionRolloverService';
import { feeAutomationService } from '@/services/feeAutomationService';

export const AcademicSessionDashboard: React.FC<{ schoolId: string }> = ({ schoolId }) => {
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [isRollingOver, setIsRollingOver] = useState(false);

    // Fetch current session
    const { data: currentSession, isLoading: sessionLoading } = useQuery({
        queryKey: ['currentSession', schoolId],
        queryFn: async () => {
            const result = await sessionManagementService.getCurrentSession(schoolId);
            return result.data;
        },
    });

    // Fetch all sessions
    const { data: allSessions } = useQuery({
        queryKey: ['allSessions', schoolId],
        queryFn: async () => {
            const result = await sessionManagementService.getAllSessions(schoolId);
            return result.data;
        },
    });

    // Fetch current term
    const { data: currentTerm } = useQuery({
        queryKey: ['currentTerm', selectedSession || currentSession?.id],
        queryFn: async () => {
            if (selectedSession || currentSession?.id) {
                const result = await sessionManagementService.getCurrentTerm(
                    schoolId,
                    selectedSession || currentSession?.id || ''
                );
                return result.data;
            }
            return null;
        },
        enabled: !!(selectedSession || currentSession?.id),
    });

    // Fetch terms for current session
    const { data: terms } = useQuery({
        queryKey: ['sessionTerms', selectedSession || currentSession?.id],
        queryFn: async () => {
            if (selectedSession || currentSession?.id) {
                const result = await sessionManagementService.getSessionTerms(
                    selectedSession || currentSession?.id || ''
                );
                return result.data;
            }
            return null;
        },
        enabled: !!(selectedSession || currentSession?.id),
    });

    // Fetch fee collection data
    const { data: feeData } = useQuery({
        queryKey: ['feeCollection', selectedSession || currentSession?.id],
        queryFn: async () => {
            if (selectedSession || currentSession?.id) {
                return await feeAutomationService.getFeeCollectionReport(
                    schoolId,
                    selectedSession || currentSession?.id || ''
                );
            }
            return null;
        },
        enabled: !!(selectedSession || currentSession?.id),
    });

    // Fetch rollover status
    const { data: rolloverStatus } = useQuery({
        queryKey: ['rolloverStatus', schoolId],
        queryFn: async () => {
            return await sessionRolloverService.getRolloverStatus(schoolId);
        },
    });

    const handleActivateTerm = async (termId: string) => {
        if (!currentSession?.id) return;

        try {
            await sessionManagementService.activateTerm(
                schoolId,
                currentSession.id,
                termId
            );
            window.location.reload();
        } catch (error) {
            console.error('Error activating term:', error);
        }
    };

    const handleSessionRollover = async () => {
        setIsRollingOver(true);

        try {
            const currentYear = new Date().getFullYear();
            const nextSessionName = `${currentYear + 1}/${currentYear + 2}`;

            if (!currentSession?.id) {
                throw new Error('No active session');
            }

            await sessionRolloverService.executeSessionRollover(
                schoolId,
                currentSession.id,
                nextSessionName,
                currentYear + 1,
                currentYear + 2,
                'admin-user'
            );

            window.location.reload();
        } catch (error) {
            console.error('Error during session rollover:', error);
            alert('Session rollover failed. Check console for details.');
        } finally {
            setIsRollingOver(false);
        }
    };

    const feeChartData = feeData
        ? [
            { name: 'Paid', value: feeData.totalPaid, fill: '#10b981' },
            { name: 'Outstanding', value: feeData.totalOutstanding, fill: '#ef4444' },
        ]
        : [];

    return (
        <div className="space-y-6">
            {/* Session Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">Current Session</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sessionLoading ? (
                            <p>Loading...</p>
                        ) : (
                            <p className="text-2xl font-bold">{currentSession?.name}</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">Current Term</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{currentTerm?.name || 'No active term'}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-500">Fee Collection</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {feeData ? `${feeData.collectionRate.toFixed(1)}%` : '0%'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Session Management */}
            <Card>
                <CardHeader>
                    <CardTitle>Session Management</CardTitle>
                    <CardDescription>Manage academic sessions and terms</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Select Session</label>
                        <select
                            value={selectedSession || currentSession?.id || ''}
                            onChange={(e) => setSelectedSession(e.target.value || null)}
                            className="w-full px-3 py-2 border rounded-md"
                        >
                            {allSessions?.map(session => (
                                <option key={session.id} value={session.id}>
                                    {session.name} {session.is_current ? '(Current)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Terms for selected session */}
                    {terms && terms.length > 0 && (
                        <div>
                            <h3 className="font-medium mb-3">Terms</h3>
                            <div className="space-y-2">
                                {terms.map(term => (
                                    <div key={term.id} className="flex items-center justify-between p-3 border rounded">
                                        <div>
                                            <p className="font-medium">{term.name}</p>
                                            <p className="text-sm text-gray-600">
                                                {new Date(term.start_date).toLocaleDateString()} -{' '}
                                                {new Date(term.end_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <Button
                                            variant={term.is_current ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => handleActivateTerm(term.id)}
                                            disabled={term.is_current}
                                        >
                                            {term.is_current ? 'Active' : 'Activate'}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Fee Collection Status */}
            {feeData && (
                <Card>
                    <CardHeader>
                        <CardTitle>Fee Collection Status</CardTitle>
                        <CardDescription>Overall fee collection performance</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm text-gray-600">Total Due</p>
                                    <p className="text-2xl font-bold">₦{(feeData.totalDue / 1000).toFixed(1)}k</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Total Paid</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        ₦{(feeData.totalPaid / 1000).toFixed(1)}k
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Outstanding</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        ₦{(feeData.totalOutstanding / 1000).toFixed(1)}k
                                    </p>
                                </div>
                            </div>

                            {feeChartData.length > 0 && (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={feeChartData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, value, percent }) =>
                                                `${name}: ${(percent * 100).toFixed(0)}%`
                                            }
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {feeChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Session Rollover */}
            <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                    <CardTitle>Session Rollover</CardTitle>
                    <CardDescription>
                        Automatically transition to next academic session with promotions and fee setup
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {rolloverStatus && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm font-medium">Promotion Rules</p>
                                    <p className={`font-bold ${rolloverStatus.checks?.hasPromotionRules ? 'text-green-600' : 'text-red-600'}`}>
                                        {rolloverStatus.checks?.hasPromotionRules ? '✓ Configured' : '✗ Missing'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Fee Structures</p>
                                    <p className={`font-bold ${rolloverStatus.checks?.hasFeeStructures ? 'text-green-600' : 'text-red-600'}`}>
                                        {rolloverStatus.checks?.hasFeeStructures ? '✓ Configured' : '✗ Missing'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Active Classes</p>
                                    <p className={`font-bold ${rolloverStatus.checks?.hasActiveClasses ? 'text-green-600' : 'text-red-600'}`}>
                                        {rolloverStatus.checks?.hasActiveClasses ? '✓ Configured' : '✗ Missing'}
                                    </p>
                                </div>
                            </div>

                            <Button
                                onClick={handleSessionRollover}
                                disabled={!rolloverStatus.ready || isRollingOver}
                                className="w-full"
                                size="lg"
                            >
                                {isRollingOver ? 'Processing Rollover...' : 'Execute Session Rollover'}
                            </Button>

                            {!rolloverStatus.ready && (
                                <p className="text-sm text-red-600">
                                    Please configure all required settings before rolling over to the next session.
                                </p>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AcademicSessionDashboard;
