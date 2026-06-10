import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Bell,
    Archive,
    Filter,
    Clock,
    AlertCircle,
    CheckCircle2,
} from 'lucide-react';
import { notificationService, Notification, NotificationStatus } from '@/services/notificationService';
import { filterNotificationsForViewer } from '@/services/notificationDispatchService';
import { useAppStore } from '@/store';
import { useQuery } from '@tanstack/react-query';
import NotificationDetailPanel from '@/components/NotificationDetailPanel';

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
    const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const preview = searchParams.get('preview');
        if (!preview) return;
        setActiveNotification({
            id: 'url-preview',
            schoolId: schoolId ?? '',
            recipientId: user?.id ?? '',
            recipientRole: user?.role ?? 'admin',
            notificationType: 'teacher_activity',
            title: 'Activity preview',
            message: 'Opened from notification link',
            priority: 'medium',
            status: 'unread',
            actionUrl: `/notifications?${searchParams.toString()}`,
            createdAt: new Date().toISOString(),
        });
        setSearchParams({}, { replace: true });
    }, [searchParams, setSearchParams, schoolId, user?.id, user?.role]);

    const queryEnabled = Boolean(user?.id && schoolId);

    const { data: notifications = [], isLoading, isError, refetch } = useQuery({
        queryKey: ['all-notifications', user?.id, schoolId, filters],
        enabled: queryEnabled,
        queryFn: async () => {
            if (!user?.id || !schoolId) return [];

            let allNotifications: Notification[] = [];

            if (filters.status === 'all') {
                const unread = await notificationService.getNotifications(schoolId, user.id, {
                    status: 'unread',
                    limit: 100,
                });
                const read = await notificationService.getNotifications(schoolId, user.id, {
                    status: 'read',
                    limit: 100,
                });
                allNotifications = [...unread, ...read];
            } else {
                allNotifications = await notificationService.getNotifications(schoolId, user.id, {
                    status: filters.status as NotificationStatus,
                    limit: 100,
                });
            }

            const visible = filterNotificationsForViewer(allNotifications, user.role);

            return visible.filter((n) => {
                if (filters.priority !== 'all' && n.priority !== filters.priority) return false;
                if (filters.type !== 'all' && n.notificationType !== filters.type) return false;
                if (
                    filters.search &&
                    !n.title.toLowerCase().includes(filters.search.toLowerCase()) &&
                    !n.message.toLowerCase().includes(filters.search.toLowerCase())
                ) {
                    return false;
                }
                return true;
            });
        },
        refetchInterval: 30000,
    });

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
        { value: 'escalation_alert', label: 'Escalation' },
        { value: 'teacher_activity', label: 'Teacher Activity' },
        { value: 'arrival_alert', label: 'Duty Arrival' },
        { value: 'departure_alert', label: 'Duty Departure' },
    ];

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text flex items-center gap-2">
                    <Bell size={32} />
                    Notification Center
                </h1>
                <p className="text-gray-600 dark:text-dark-muted mt-2">
                  Tap any notification to open it in a side panel. Teacher and duty alerts include
                  attendance, grades, and activity previews when available.
                </p>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-dark-elevated mb-6 p-4 border border-transparent dark:border-dark-border">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={20} className="text-gray-600 dark:text-dark-muted" />
                    <h3 className="font-semibold text-gray-900 dark:text-dark-text">Filters</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-2">Status</label>
                        <select
                            value={filters.status}
                            onChange={e =>
                                setFilters(prev => ({ ...prev, status: e.target.value as NotificationFilters['status'] }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-elevated text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All</option>
                            <option value="unread">Unread</option>
                            <option value="read">Read</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>

                    {/* Priority Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-2">Priority</label>
                        <select
                            value={filters.priority}
                            onChange={e =>
                                setFilters(prev => ({ ...prev, priority: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-elevated text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-2">Type</label>
                        <select
                            value={filters.type}
                            onChange={e =>
                                setFilters(prev => ({ ...prev, type: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-elevated text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-2">Search</label>
                        <input
                            type="text"
                            placeholder="Search notifications..."
                            value={filters.search}
                            onChange={e =>
                                setFilters(prev => ({ ...prev, search: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-elevated text-gray-900 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="bg-white dark:bg-dark-card rounded-lg shadow dark:shadow-dark-elevated overflow-hidden border border-transparent dark:border-dark-border">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500 dark:text-dark-muted">Loading notifications...</div>
                ) : isError ? (
                    <div className="p-8 text-center">
                        <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
                        <p className="text-gray-700 dark:text-dark-text font-medium">Could not load notifications</p>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                            Try again
                        </button>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center">
                        <Bell size={48} className="mx-auto mb-4 opacity-50 text-gray-400" />
                        <p className="text-gray-600 dark:text-dark-text font-medium">No notifications found</p>
                        <p className="text-gray-500 dark:text-dark-muted text-sm mt-1">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-dark-border">
                        {/* Header with checkbox */}
                        <div className="px-6 py-4 bg-gray-50 dark:bg-dark-elevated/50 border-b border-gray-200 dark:border-dark-border flex items-center gap-4">
                            <input
                                type="checkbox"
                                checked={selectedNotifications.size === notifications.length && notifications.length > 0}
                                onChange={toggleAll}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-dark-muted">
                                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Notifications */}
                        {notifications.map(notification => (
                            <div
                                key={notification.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => setActiveNotification(notification)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setActiveNotification(notification);
                                    }
                                }}
                                className={`px-6 py-4 hover:bg-gray-50 dark:hover:bg-dark-elevated/40 transition-colors flex items-start gap-4 cursor-pointer ${
                                    notification.status === 'unread' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                } ${
                                    activeNotification?.id === notification.id
                                        ? 'ring-2 ring-inset ring-blue-500 dark:ring-blue-400'
                                        : ''
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedNotifications.has(notification.id)}
                                    onChange={() => toggleNotification(notification.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer mt-1"
                                />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-dark-text">
                                                {notification.title}
                                            </h3>
                                            <p className="text-gray-700 dark:text-dark-muted text-sm mt-1">{notification.message}</p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-dark-muted">
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
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleMarkAsRead(notification.id);
                                                }}
                                                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1"
                                            >
                                                <CheckCircle2 size={14} />
                                                Mark as read
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void handleArchive(notification.id);
                                            }}
                                            className="text-xs text-gray-600 hover:text-gray-700 dark:text-dark-muted font-medium flex items-center gap-1"
                                        >
                                            <Archive size={14} />
                                            Archive
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <NotificationDetailPanel
                notification={activeNotification}
                onClose={() => setActiveNotification(null)}
                onMarkAsRead={async (id) => {
                    await handleMarkAsRead(id);
                }}
                onArchive={async (id) => {
                    await handleArchive(id);
                    setActiveNotification(null);
                }}
                formatTime={formatTime}
                getPriorityColor={getPriorityColor}
            />
        </div>
    );
}
