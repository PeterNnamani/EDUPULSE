import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useNotification, NotificationType } from '@/contexts/NotificationContext';

const getNotificationStyles = (type: NotificationType) => {
    const styles = {
        success: {
            bg: 'bg-green-50 dark:bg-green-900/20',
            border: 'border-green-200 dark:border-green-800',
            text: 'text-green-800 dark:text-green-200',
            icon: CheckCircle,
            iconColor: 'text-green-600',
        },
        error: {
            bg: 'bg-red-50 dark:bg-red-900/20',
            border: 'border-red-200 dark:border-red-800',
            text: 'text-red-800 dark:text-red-200',
            icon: AlertCircle,
            iconColor: 'text-red-600',
        },
        info: {
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            border: 'border-blue-200 dark:border-blue-800',
            text: 'text-blue-800 dark:text-blue-200',
            icon: Info,
            iconColor: 'text-blue-600',
        },
        warning: {
            bg: 'bg-yellow-50 dark:bg-yellow-900/20',
            border: 'border-yellow-200 dark:border-yellow-800',
            text: 'text-yellow-800 dark:text-yellow-200',
            icon: AlertTriangle,
            iconColor: 'text-yellow-600',
        },
    };
    return styles[type];
};

export default function ToastContainer() {
    const { notifications, removeNotification } = useNotification();

    return (
        <AnimatePresence>
            <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
                {notifications.map((notification) => {
                    const style = getNotificationStyles(notification.type);
                    const Icon = style.icon;

                    return (
                        <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: 100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 100 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className={`flex items-start gap-3 p-4 rounded-lg border ${style.bg} ${style.border} ${style.text} pointer-events-auto max-w-sm`}
                        >
                            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.iconColor}`} />
                            <div className="flex-1">
                                <p className="font-medium text-sm">{notification.message}</p>
                            </div>
                            <button
                                onClick={() => removeNotification(notification.id)}
                                className="flex-shrink-0 hover:opacity-70 transition-opacity"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    );
                })}
            </div>
        </AnimatePresence>
    );
}
