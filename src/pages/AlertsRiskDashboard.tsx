import React, { useState } from 'react';
import {
    AlertTriangle,
    TrendingUp,
    Users,
    Clock,
    CheckCircle2,
    MoreVertical,
    Eye
} from 'lucide-react';
import { alertManagementService, StudentAlert } from '@/services/alertManagementService';
import { riskDetectionService, RiskScore } from '@/services/riskDetectionService';
import { useAppStore } from '@/store';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

export default function AlertsRiskDashboard() {
    const schoolId = useAppStore((s) => s.user?.schoolId);
    const [selectedAlert, setSelectedAlert] = useState<StudentAlert | null>(null);

    const { data: openAlerts = [], isLoading: alertsLoading } = useQuery({
        queryKey: ['open-alerts', schoolId],
        queryFn: async () => {
            if (!schoolId) return [] as StudentAlert[];
            return await alertManagementService.getOpenAlerts(schoolId);
        },
        enabled: !!schoolId,
        refetchInterval: 60000,
    });

    const { data: highRiskStudents = [], isLoading: riskLoading } = useQuery({
        queryKey: ['high-risk-students', schoolId],
        queryFn: async () => {
            if (!schoolId) return [] as RiskScore[];
            return await riskDetectionService.getHighRiskStudents(schoolId, 'high');
        },
        enabled: !!schoolId,
        refetchInterval: 60000,
    });

    const { data: criticalStudents = [] } = useQuery({
        queryKey: ['critical-risk-students', schoolId],
        queryFn: async () => {
            if (!schoolId) return [] as RiskScore[];
            return await riskDetectionService.getHighRiskStudents(schoolId, 'critical');
        },
        enabled: !!schoolId,
        refetchInterval: 60000,
    });

    // Calculate statistics
    const stats = {
        totalAlerts: openAlerts.length,
        criticalAlerts: openAlerts.filter(a => a.riskLevel === 'critical').length,
        highRiskAlerts: openAlerts.filter(a => a.riskLevel === 'high').length,
        mediumRiskAlerts: openAlerts.filter(a => a.riskLevel === 'medium').length,
        highRiskStudentCount: highRiskStudents.length,
        criticalStudentCount: criticalStudents.length
    };

    // Alert distribution data
    const alertDistributionData = [
        {
            name: 'Critical',
            value: stats.criticalAlerts,
            fill: '#dc2626'
        },
        {
            name: 'High',
            value: stats.highRiskAlerts,
            fill: '#f97316'
        },
        {
            name: 'Medium',
            value: stats.mediumRiskAlerts,
            fill: '#eab308'
        }
    ].filter(item => item.value > 0);

    // Alert types distribution
    const alertTypeData = openAlerts.reduce(
        (acc, alert) => {
            const existing = acc.find(a => a.type === alert.alertType);
            if (existing) {
                existing.count++;
            } else {
                acc.push({ type: alert.alertType, count: 1 });
            }
            return acc;
        },
        [] as Array<{ type: string; count: number }>
    );

    const getRiskLevelColor = (level: string) => {
        switch (level) {
            case 'critical':
                return 'bg-red-100 text-red-800 border-red-300';
            case 'high':
                return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            default:
                return 'bg-green-100 text-green-800 border-green-300';
        }
    };

    const getAlertTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            attendance: 'Attendance',
            academic_decline: 'Academic Decline',
            missing_assignment: 'Missing Assignment',
            behaviour_incident: 'Behaviour',
            fee_overdue: 'Fees',
            composite_risk: 'Composite Risk',
            critical_incident: 'Critical Incident'
        };
        return labels[type] || type;
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle size={32} className="text-red-600" />
                    Alerts & Risk Management Dashboard
                </h1>
                <p className="text-gray-600 mt-2">Monitor student risks and manage alerts</p>
            </div>

            {/* Key Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Alerts */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-lg shadow p-6"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm font-medium">Open Alerts</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalAlerts}</p>
                        </div>
                        <AlertTriangle size={40} className="text-yellow-500 opacity-20" />
                    </div>
                </motion.div>

                {/* Critical Alerts */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-lg shadow p-6"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm font-medium">Critical Alerts</p>
                            <p className={`text-3xl font-bold mt-2 ${stats.criticalAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {stats.criticalAlerts}
                            </p>
                        </div>
                        <AlertTriangle size={40} className="text-red-500 opacity-20" />
                    </div>
                </motion.div>

                {/* High Risk Students */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-lg shadow p-6"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm font-medium">High Risk Students</p>
                            <p className="text-3xl font-bold text-orange-600 mt-2">{stats.highRiskStudentCount}</p>
                        </div>
                        <Users size={40} className="text-orange-500 opacity-20" />
                    </div>
                </motion.div>

                {/* Critical Students */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-lg shadow p-6"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm font-medium">Critical Students</p>
                            <p className={`text-3xl font-bold mt-2 ${stats.criticalStudentCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {stats.criticalStudentCount}
                            </p>
                        </div>
                        <TrendingUp size={40} className="text-red-500 opacity-20" />
                    </div>
                </motion.div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Alert Distribution */}
                {alertDistributionData.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Distribution by Risk Level</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={alertDistributionData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value }) => `${name}: ${value}`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {alertDistributionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Alert Types */}
                {alertTypeData.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alerts by Type</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={alertTypeData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="type" angle={-45} textAnchor="end" height={80} />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="count" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Open Alerts Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <AlertTriangle size={20} className="text-red-600" />
                        Open Alerts
                    </h3>
                </div>

                {alertsLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading alerts...</div>
                ) : openAlerts.length === 0 ? (
                    <div className="p-8 text-center">
                        <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500 opacity-50" />
                        <p className="text-gray-600 font-medium">No open alerts</p>
                        <p className="text-gray-500 text-sm mt-1">Great news! All students are performing well.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Student
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Alert Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Risk Level
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {openAlerts.map(alert => (
                                    <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm font-medium text-gray-900">Student ID: {alert.studentId}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm text-gray-700">{getAlertTypeLabel(alert.alertType)}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-3 py-1 text-xs font-semibold rounded-full ${getRiskLevelColor(alert.riskLevel)}`}
                                            >
                                                {alert.riskLevel.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {alert.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <Clock size={14} />
                                                {new Date(alert.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => setSelectedAlert(alert)}
                                                className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                                            >
                                                <Eye size={16} />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Alert Detail Modal */}
            {selectedAlert && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">{selectedAlert.title}</h2>
                            <button
                                onClick={() => setSelectedAlert(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <p className="text-gray-700">{selectedAlert.description}</p>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Risk Level</p>
                                    <span
                                        className={`inline-block px-3 py-1 text-sm font-semibold rounded-full mt-1 ${getRiskLevelColor(selectedAlert.riskLevel)}`}
                                    >
                                        {selectedAlert.riskLevel.toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Status</p>
                                    <p className="text-gray-900 font-semibold mt-1">{selectedAlert.status}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-gray-600 font-medium mb-2">Recommended Action</p>
                                <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedAlert.recommendedAction}</p>
                            </div>

                            {selectedAlert.secondaryActions.length > 0 && (
                                <div>
                                    <p className="text-sm text-gray-600 font-medium mb-2">Secondary Actions</p>
                                    <ul className="space-y-1">
                                        {selectedAlert.secondaryActions.map((action, i) => (
                                            <li key={i} className="text-gray-700 flex items-start gap-2">
                                                <span className="text-blue-600 font-bold">•</span>
                                                <span>{action}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setSelectedAlert(null)}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                            >
                                Close
                            </button>
                            <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                                Take Action
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
