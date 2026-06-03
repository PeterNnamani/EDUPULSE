import React, { useState, useCallback } from 'react';
import { Bell, Check, Archive, X, Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { notificationService, Notification } from '@/services/notificationService';

interface NotificationBellProps {
    className?: string;
}

export default function NotificationBell({ className = '' }: NotificationBellProps) {
    const { user } = useAppStore();
    const [showPanel, setShowPanel] = useState(false);
    const { playSound } = useNotificationSound();

    // Fetch notifications with real-time polling
    const { data: notifications = [], isLoading, refetch } = useQuery({
        queryKey: ['notifications', user?.id, user?.schoolId],
        queryFn: async () => {
            if (!user?.id || !user?.schoolId) return [];
            try {
                const notifs = await notificationService.getNotifications(
                    user.schoolId,
                    user.id,
                    {
                        limit: 50,
                        status: 'unread'
                    }
                );
                return notifs;
            } catch (error) {
                console.error('Error fetching notifications:', error);
                return [];
            }
        },
        refetchInterval: 5000, // Poll every 5 seconds for new notifications
        enabled: !!user?.id && !!user?.schoolId
    });

    // Fetch notification counts
    const { data: counts = { unread: 0, total: 0, archived: 0 } } = useQuery({
        queryKey: ['notification-counts', user?.id, user?.schoolId],
        queryFn: async () => {
            if (!user?.id || !user?.schoolId) return { unread: 0, total: 0, archived: 0 };
            try {
                return await notificationService.getNotificationCounts(
                    user.schoolId,
                    user.id
                );
            } catch (error) {
                console.error('Error fetching notification counts:', error);
                return { unread: 0, total: 0, archived: 0 };
            }
        },
        refetchInterval: 5000, // Poll every 5 seconds for updated counts
        enabled: !!user?.id && !!user?.schoolId
    });

    const handleMarkAsRead = useCallback(
        async (notificationId: string) => {
            try {
                const result = await notificationService.markAsRead(notificationId);
                if (result.success) {
                    refetch();
                }
            } catch (error) {
                console.error('Error marking notification as read:', error);
            }
        },
        [refetch]
    );

    const handleArchive = useCallback(
        async (notificationId: string) => {
            try {
                const result = await notificationService.archive(notificationId);
                if (result.success) {
                    refetch();
                }
            } catch (error) {
                console.error('Error archiving notification:', error);
            }
        },
        [refetch]
    );

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical':
                return 'border-l-4 border-red-600 bg-red-50';
            case 'high':
                return 'border-l-4 border-orange-500 bg-orange-50';
            case 'medium':
                return 'border-l-4 border-yellow-500 bg-yellow-50';
            default:
                return 'border-l-4 border-gray-300 bg-gray-50';
        }
    };

    const getPriorityBadgeColor = (priority: string) => {
        switch (priority) {
            case 'critical':
                return 'bg-red-600 text-white';
            case 'high':
                return 'bg-orange-500 text-white';
            case 'medium':
                return 'bg-yellow-500 text-white';
            default:
                return 'bg-gray-300 text-gray-800';
        }
    };

    const getPriorityBubbleColor = (priority: string) => {
        switch (priority) {
            case 'critical':
                return 'bg-red-50 border-red-200';
            case 'high':
                return 'bg-orange-50 border-orange-200';
            case 'medium':
                return 'bg-yellow-50 border-yellow-200';
            default:
                return 'bg-blue-50 border-blue-200';
        }
    };

    const formatTime = (dateString: string) => {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

            if (diffMinutes < 1) return 'Just now';
            if (diffMinutes < 60) return `${diffMinutes}m ago`;
            if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
            return `${Math.floor(diffMinutes / 1440)}d ago`;
        } catch {
            return 'Just now';
        }
    };

    return (
        <div className={`relative ${className}`}>
            {/* Recent Notification Bubbles */}
            <AnimatePresence>
                {notifications.slice(0, 3).map((notification, index) => (
                    <motion.div
                        key={`recent-${notification.id}`}
                        initial={{ opacity: 0, y: -20, x: 20 }}
                        animate={{ opacity: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.1 }}
                        className={`absolute right-0 top-12 w-80 p-4 rounded-lg shadow-lg border pointer-events-none ${getPriorityBubbleColor(notification.priority)}`}
                    >
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm text-gray-900">{notification.title}</h4>
                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notification.message}</p>
                                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                    <Clock className="w-3 h-3" />
                                    {formatTime(notification.createdAt)}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Bell Button */}
            <button
                onClick={() => setShowPanel(!showPanel)}
                className="relative p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Notifications"
            >
                <Bell size={24} />
                {counts.unread > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-1 right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full"
                    >
                        {counts.unread > 99 ? '99+' : counts.unread}
                    </motion.span>
                )}
            </button>

            {/* Notification Panel */}
            {showPanel && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-96 max-h-[600px] bg-white rounded-lg shadow-xl z-50 flex flex-col"
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        <button
                            onClick={() => setShowPanel(false)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-4 text-center text-gray-500">Loading notifications...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No new notifications</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200">
                                {notifications.map((notification, index) => (
                                    <motion.div
                                        key={notification.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`p-4 hover:bg-gray-50 transition-colors ${getPriorityColor(notification.priority)}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className="flex-shrink-0 pt-1">
                                                {notification.priority === 'critical' && (
                                                    <AlertCircle size={20} className="text-red-600" />
                                                )}
                                                {notification.priority === 'high' && (
                                                    <AlertCircle size={20} className="text-orange-500" />
                                                )}
                                                {notification.priority === 'medium' && (
                                                    <Clock size={20} className="text-yellow-500" />
                                                )}
                                                {notification.priority === 'low' && (
                                                    <Bell size={20} className="text-gray-400" />
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 text-sm">
                                                            {notification.title}
                                                        </h4>
                                                        <p className="text-gray-700 text-sm mt-1">{notification.message}</p>
                                                    </div>
                                                    <span
                                                        className={`px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${getPriorityBadgeColor(notification.priority)}`}
                                                    >
                                                        {notification.priority}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                    <Clock size={14} />
                                                    {formatTime(notification.createdAt)}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2 mt-2">
                                                    {notification.status === 'unread' && (
                                                        <button
                                                            onClick={() => handleMarkAsRead(notification.id)}
                                                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                                        >
                                                            <Check size={14} />
                                                            Mark as read
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleArchive(notification.id)}
                                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                                                    >
                                                        <Archive size={14} />
                                                        Archive
                                                    </button>
                                                    {notification.actionUrl && (
                                                        <a
                                                            href={notification.actionUrl}
                                                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                                        >
                                                            View
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-gray-200">
                        <a
                            href="/notifications"
                            className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                        >
                            View all notifications →
                        </a>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
