import React, { useState } from 'react';
import {
    Bell,
    Archive,
    Trash2,
    Filter,
    Clock,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { notificationService, Notification, NotificationStatus } from '@/services/notificationService';
import { useAppStore } from '@/store';
import { useQuery } from '@tanstack/react-query';

interface NotificationFilters {
    status: NotificationStatus | 'all';
    priority: string;
    type: string;
    search: string;
}

export default function NotificationCenter() {
    const { user } = useAppStore();
    const schoolId = user?.schoolId;
    const [filters, setFilters] = useState<NotificationFilters>({
        status: 'unread',
        priority: 'all',
        type: 'all',
        search: ''
    });

    const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());

    // Fetch all notifications
    const { data: notifications = [], isLoading, refetch } = useQuery(
        ['all-notifications', user?.id, schoolId, filters],
        async () => {
            if (!user?.id || !schoolId) return [];

            let allNotifications: Notification[] = [];

            if (filters.status === 'all') {
                const unread = await notificationService.getNotifications(schoolId, user.id, {
                    status: 'unread',
                    limit: 100
                });
                const read = await notificationService.getNotifications(schoolId, user.id, {
                    status: 'read',
                    limit: 100
                });
                allNotifications = [...unread, ...read];
            } else {
                allNotifications = await notificationService.getNotifications(schoolId, user.id, {
                    status: filters.status as NotificationStatus,
                    limit: 100
                });
            }

            // Apply filters
            return allNotifications.filter(n => {
                if (filters.priority !== 'all' && n.priority !== filters.priority) return false;
                if (filters.type !== 'all' && n.notificationType !== filters.type) return false;
                if (
                    filters.search &&
                    !n.title.toLowerCase().includes(filters.search.toLowerCase()) &&
                    !n.message.toLowerCase().includes(filters.search.toLowerCase())
                )
                    return false;
                return true;
            });
        },
        { refetchInterval: 30000 }
    );

    const handleMarkAsRead = async (notificationId: string) => {
        await notificationService.markAsRead(notificationId);
        refetch();
    };

    const handleArchive = async (notificationId: string) => {
        await notificationService.archive(notificationId);
        refetch();
    };

    const handleBulkMarkAsRead = async () => {
        for (const id of selectedNotifications) {
            await notificationService.markAsRead(id);
        }
        setSelectedNotifications(new Set());
        refetch();
    };

    const handleBulkArchive = async () => {
        for (const id of selectedNotifications) {
            await notificationService.archive(id);
        }
        setSelectedNotifications(new Set());
        refetch();
    };

    const toggleNotification = (id: string) => {
        const newSelected = new Set(selectedNotifications);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedNotifications(newSelected);
    };

    const toggleAll = () => {
        if (selectedNotifications.size === notifications.length) {
            setSelectedNotifications(new Set());
        } else {
            setSelectedNotifications(new Set(notifications.map(n => n.id)));
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical':
                return 'bg-red-100 text-red-800 border-red-300';
            case 'high':
                return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getPriorityIcon = (priority: string) => {
        if (priority === 'critical' || priority === 'high') {
            return <AlertCircle size={16} />;
        }
        return <Clock size={16} />;
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
        return date.toLocaleDateString();
    };

    const notificationTypes = [
        { value: 'attendance_alert', label: 'Attendance' },
        { value: 'academic_alert', label: 'Academic' },
        { value: 'behaviour_alert', label: 'Behaviour' },
        { value: 'assignment_alert', label: 'Assignment' },
        { value: 'fee_reminder', label: 'Fee Reminder' },
        { value: 'fee_alert', label: 'Fee Alert' },
        { value: 'risk_alert', label: 'Risk Alert' },
        { value: 'intervention_reminder', label: 'Intervention' },
        { value: 'escalation_alert', label: 'Escalation' }
    ];

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <Bell size={32} />
                    Notification Center
                </h1>
                <p className="text-gray-600 mt-2">Manage all your notifications in one place</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow mb-6 p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={20} className="text-gray-600" />
                    <h3 className="font-semibold text-gray-900">Filters</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                            value={filters.status}
                            onChange={e =>
                                setFilters(prev => ({ ...prev, status: e.target.value as any }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All</option>
                            <option value="unread">Unread</option>
                            <option value="read">Read</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>

                    {/* Priority Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                        <select
                            value={filters.priority}
                            onChange={e =>
                                setFilters(prev => ({ ...prev, priority: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>

                    {/* Type Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                        <select
                            value={filters.type}
                            onChange={e =>
                                setFilters(prev => ({ ...prev, type: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All</option>
                            {notificationTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                        <input
                            type="text"
                            placeholder="Search notifications..."
                            value={filters.search}
                            onChange={e =>
                                setFilters(prev => ({ ...prev, search: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedNotifications.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">
                        {selectedNotifications.size} selected
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={handleBulkMarkAsRead}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <CheckCircle2 size={16} />
                            Mark as Read
                        </button>
                        <button
                            onClick={handleBulkArchive}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            <Archive size={16} />
                            Archive
                        </button>
                    </div>
                </div>
            )}

            {/* Notifications List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center">
                        <Bell size={48} className="mx-auto mb-4 opacity-50 text-gray-400" />
                        <p className="text-gray-600 font-medium">No notifications found</p>
                        <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {/* Header with checkbox */}
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
                            <input
                                type="checkbox"
                                checked={selectedNotifications.size === notifications.length && notifications.length > 0}
                                onChange={toggleAll}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                            />
                            <span className="text-sm font-medium text-gray-700">
                                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Notifications */}
                        {notifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`px-6 py-4 hover:bg-gray-50 transition-colors flex items-start gap-4 ${notification.status === 'unread' ? 'bg-blue-50' : ''
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedNotifications.has(notification.id)}
                                    onChange={() => toggleNotification(notification.id)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer mt-1"
                                />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900">
                                                {notification.title}
                                            </h3>
                                            <p className="text-gray-700 text-sm mt-1">{notification.message}</p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                <Clock size={14} />
                                                {formatTime(notification.createdAt)}
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getPriorityColor(notification.priority)}`}
                                            >
                                                {getPriorityIcon(notification.priority)}
                                                {notification.priority}
                                            </span>

                                            {notification.status === 'unread' && (
                                                <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                                                    New
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-3">
                                        {notification.status === 'unread' && (
                                            <button
                                                onClick={() => handleMarkAsRead(notification.id)}
                                                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                            >
                                                <CheckCircle2 size={14} />
                                                Mark as read
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleArchive(notification.id)}
                                            className="text-xs text-gray-600 hover:text-gray-700 font-medium flex items-center gap-1"
                                        >
                                            <Archive size={14} />
                                            Archive
                                        </button>
                                        {notification.actionUrl && (
                                            <a
                                                href={notification.actionUrl}
                                                className="text-xs text-green-600 hover:text-green-700 font-medium"
                                            >
                                                View →
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
