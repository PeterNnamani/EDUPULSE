import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSound } from '@/hooks';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
    id: string;
    message: string;
    type: NotificationType;
    duration?: number;
}

interface NotificationContextType {
    notifications: Notification[];
    addNotification: (message: string, type: NotificationType, duration?: number) => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const { playSound } = useSound();

    const addNotification = useCallback(
        (message: string, type: NotificationType, duration = 4000) => {
            const id = Date.now().toString();

            // Play notification sound when adding notification
            playSound('notification', { volume: 0.7 });

            setNotifications((prev) => [...prev, { id, message, type, duration }]);

            // Auto-remove after duration
            if (duration > 0) {
                setTimeout(() => {
                    removeNotification(id);
                }, duration);
            }
        },
        [playSound]
    );

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within NotificationProvider');
    }
    return context;
};
