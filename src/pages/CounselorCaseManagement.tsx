import React, { useState } from 'react';
import {
    FileText,
    Plus,
    Clock,
    CheckCircle2,
    AlertCircle,
    Edit,
    Eye,
    Trash2,
    Calendar,
    User
} from 'lucide-react';
import { interventionService, InterventionCase, InterventionStatus } from '@/services/interventionService';
import { useAppStore } from '@/store';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

interface FilterOptions {
    status: InterventionStatus | 'all';
    priority: string;
    search: string;
}

export default function CounselorCaseManagement() {
    const user = useAppStore((s) => s.user);
    const schoolId = user?.schoolId;
    const [filters, setFilters] = useState<FilterOptions>({
        status: 'all',
        priority: 'all',
        search: ''
    });
    const [selectedCase, setSelectedCase] = useState<InterventionCase | null>(null);
    const [showNewCaseForm, setShowNewCaseForm] = useState(false);

    // Fetch counselor's cases
    const { data: allCases = [], isLoading, refetch } = useQuery({
        queryKey: ['counselor-cases', user?.id, schoolId],
        queryFn: async () => {
            if (!user?.id || !schoolId) return [] as InterventionCase[];
            return await interventionService.getCounselorCases(schoolId, user.id);
        },
        enabled: !!user?.id && !!schoolId,
        refetchInterval: 60000,
    });

    // Filter cases
    const cases = allCases.filter(c => {
        if (filters.status !== 'all' && c.status !== filters.status) return false;
        if (filters.priority !== 'all' && c.priority !== filters.priority) return false;
        if (
            filters.search &&
            !c.caseTitle.toLowerCase().includes(filters.search.toLowerCase())
        )
            return false;
        return true;
    });

    // Calculate statistics
    const stats = {
        total: allCases.length,
        open: allCases.filter(c => c.status === 'open').length,
        inProgress: allCases.filter(c => c.status === 'in_progress').length,
        closed: allCases.filter(c => c.status === 'closed').length,
        critical: allCases.filter(c => c.priority === 'critical').length
    };

    const getStatusColor = (status: InterventionStatus) => {
        switch (status) {
            case 'open':
                return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'in_progress':
                return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'closed':
                return 'bg-green-100 text-green-800 border-green-300';
            case 'escalated':
                return 'bg-red-100 text-red-800 border-red-300';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical':
                return 'bg-red-50 border-l-4 border-red-600';
            case 'high':
                return 'bg-orange-50 border-l-4 border-orange-500';
            case 'medium':
                return 'bg-yellow-50 border-l-4 border-yellow-500';
            default:
                return 'bg-gray-50 border-l-4 border-gray-300';
        }
    };

    const getPriorityBadgeColor = (priority: string) => {
        switch (priority) {
            case 'critical':
                return 'bg-red-100 text-red-800';
            case 'high':
                return 'bg-orange-100 text-orange-800';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: InterventionStatus) => {
        switch (status) {
            case 'open':
                return <AlertCircle size={16} className="text-blue-600" />;
            case 'in_progress':
                return <Clock size={16} className="text-yellow-600" />;
            case 'closed':
                return <CheckCircle2 size={16} className="text-green-600" />;
            default:
                return <AlertCircle size={16} />;
        }
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText size={32} className="text-blue-600" />
                        Case Management
                    </h1>
                    <p className="text-gray-600 mt-2">Manage intervention cases and student progress</p>
                </div>
                <button
                    onClick={() => setShowNewCaseForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                    <Plus size={20} />
                    New Case
                </button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-lg shadow p-4"
                >
                    <p className="text-gray-600 text-sm font-medium">Total Cases</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-lg shadow p-4"
                >
                    <p className="text-gray-600 text-sm font-medium">Open Cases</p>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{stats.open}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-lg shadow p-4"
                >
                    <p className="text-gray-600 text-sm font-medium">In Progress</p>
                    <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.inProgress}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-lg shadow p-4"
                >
                    <p className="text-gray-600 text-sm font-medium">Closed</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">{stats.closed}</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-lg shadow p-4"
                >
                    <p className="text-gray-600 text-sm font-medium">Critical</p>
                    <p className={`text-2xl font-bold mt-2 ${stats.critical > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {stats.critical}
                    </p>
                </motion.div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                            value={filters.status}
                            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                        <select
                            value={filters.priority}
                            onChange={e => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                        <input
                            type="text"
                            placeholder="Search cases..."
                            value={filters.search}
                            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Cases List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-12">
                        <p className="text-gray-600">Loading cases...</p>
                    </div>
                ) : cases.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <FileText size={48} className="mx-auto mb-4 opacity-30 text-gray-400" />
                        <p className="text-gray-600 font-medium">No cases found</p>
                        <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
                    </div>
                ) : (
                    cases.map(caseItem => (
                        <motion.div
                            key={caseItem.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`bg-white rounded-lg shadow p-6 ${getPriorityColor(caseItem.priority)}`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-semibold text-gray-900">{caseItem.caseTitle}</h3>
                                        <span
                                            className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getPriorityBadgeColor(caseItem.priority)}`}
                                        >
                                            {caseItem.priority.toUpperCase()}
                                        </span>
                                        <span
                                            className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getStatusColor(caseItem.status)}`}
                                        >
                                            {getStatusIcon(caseItem.status)}
                                            {caseItem.status}
                                        </span>
                                    </div>
                                    <p className="text-gray-700 text-sm mt-2">{caseItem.caseDescription}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-200">
                                <div>
                                    <p className="text-xs text-gray-600 font-medium">Category</p>
                                    <p className="text-sm font-semibold text-gray-900 mt-1">
                                        {caseItem.caseCategory.replace(/_/g, ' ')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600 font-medium">Created</p>
                                    <p className="text-sm font-semibold text-gray-900 mt-1 flex items-center gap-1">
                                        <Calendar size={14} />
                                        {formatDate(caseItem.createdAt)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600 font-medium">Next Review</p>
                                    <p className="text-sm font-semibold text-gray-900 mt-1">
                                        {caseItem.nextReviewDate ? formatDate(caseItem.nextReviewDate) : 'Not set'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600 font-medium">Outcome</p>
                                    <p className="text-sm font-semibold text-gray-900 mt-1">
                                        {caseItem.caseOutcome || 'Pending'}
                                    </p>
                                </div>
                            </div>

                            {caseItem.goals && caseItem.goals.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-sm font-semibold text-gray-900 mb-2">Goals</p>
                                    <ul className="space-y-1">
                                        {caseItem.goals.map((goal, i) => (
                                            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                                <span className="text-blue-600 font-bold">•</span>
                                                <span>{goal}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedCase(caseItem)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                                >
                                    <Eye size={16} />
                                    View Details
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                                    <Edit size={16} />
                                    Edit
                                </button>
                                {caseItem.status !== 'closed' && (
                                    <button className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium">
                                        <CheckCircle2 size={16} />
                                        Log Activity
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Case Detail Modal */}
            {selectedCase && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">{selectedCase.caseTitle}</h2>
                            <button
                                onClick={() => setSelectedCase(null)}
                                className="text-gray-500 hover:text-gray-700 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Overview */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Status</p>
                                    <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full mt-2 ${getStatusColor(selectedCase.status)}`}>
                                        {selectedCase.status}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Priority</p>
                                    <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full mt-2 ${getPriorityBadgeColor(selectedCase.priority)}`}>
                                        {selectedCase.priority}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Category</p>
                                    <p className="text-gray-900 font-semibold mt-2">{selectedCase.caseCategory.replace(/_/g, ' ')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Created</p>
                                    <p className="text-gray-900 font-semibold mt-2">{formatDate(selectedCase.createdAt)}</p>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <p className="text-sm text-gray-600 font-medium mb-2">Description</p>
                                <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedCase.caseDescription}</p>
                            </div>

                            {/* Intervention Plan */}
                            {selectedCase.interventionPlan && (
                                <div>
                                    <p className="text-sm text-gray-600 font-medium mb-2">Intervention Plan</p>
                                    <p className="text-gray-900 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                                        {selectedCase.interventionPlan}
                                    </p>
                                </div>
                            )}

                            {/* Goals */}
                            {selectedCase.goals && selectedCase.goals.length > 0 && (
                                <div>
                                    <p className="text-sm text-gray-600 font-medium mb-2">Goals</p>
                                    <ul className="space-y-2">
                                        {selectedCase.goals.map((goal, i) => (
                                            <li key={i} className="text-gray-900 bg-gray-50 p-3 rounded-lg flex items-start gap-2">
                                                <span className="text-blue-600 font-bold">•</span>
                                                <span>{goal}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setSelectedCase(null)}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                            >
                                Close
                            </button>
                            <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                                Log Activity
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
