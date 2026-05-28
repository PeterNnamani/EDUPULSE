import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store';

interface WelcomeMessageProps {
    isVisible: boolean;
    onDismiss: () => void;
}

export default function WelcomeMessage({ isVisible, onDismiss }: WelcomeMessageProps) {
    const { user } = useAppStore();
    const [showTyping, setShowTyping] = useState(true);
    const [displayedText, setDisplayedText] = useState('');

    const messages: Record<string, string> = {
        admin: `Welcome back, ${user?.name?.split(' ')[0]}! 👋 I'm your EduPulse Assistant. I can help you manage students, staff, classes, subscriptions, and answer any questions about your school's operations. Need help with anything?`,
        teacher: `Welcome back, ${user?.name?.split(' ')[0]}! 👋 I'm here to help you manage attendance, grades, assignments, behavior records, and more. What would you like to do today?`,
        principal: `Welcome back, ${user?.name?.split(' ')[0]}! 👋 I'm your assistant for risk analysis, reports, and school management. How can I support your leadership today?`,
        counselor: `Welcome back, ${user?.name?.split(' ')[0]}! 👋 I'm here to support your interventions, risk analysis, and student support tasks. What can I help you with?`,
        finance: `Welcome back, ${user?.name?.split(' ')[0]}! 👋 I'm your finance assistant. I can help you manage fees, generate financial reports, and track school finances. Need any help?`,
        parent: `Welcome back, ${user?.name?.split(' ')[0]}! 👋 I'm here to help you stay updated on your child's attendance, grades, assignments, and behavior. What would you like to know?`,
    };

    const message = user?.role ? messages[user.role] || messages.teacher : messages.teacher;

    useEffect(() => {
        if (!isVisible) {
            setDisplayedText('');
            setShowTyping(true);
            return;
        }

        setShowTyping(true);
        let index = 0;
        const typingInterval = setInterval(() => {
            if (index <= message.length) {
                setDisplayedText(message.substring(0, index));
                index++;
            } else {
                setShowTyping(false);
                clearInterval(typingInterval);
            }
        }, 20);

        const dismissTimer = setTimeout(() => {
            onDismiss();
        }, 5000);

        return () => {
            clearInterval(typingInterval);
            clearTimeout(dismissTimer);
        };
    }, [isVisible, message, onDismiss]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="fixed bottom-28 right-6 z-40"
                >
                    {/* Typing Indicator */}
                    <div className="flex justify-end gap-1 mb-3">
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity }}
                            className="w-3 h-3 bg-blue-600 rounded-full"
                        />
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                            className="w-3 h-3 bg-blue-600 rounded-full"
                        />
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                            className="w-3 h-3 bg-blue-600 rounded-full"
                        />
                    </div>

                    {/* Message Bubble */}
                    <motion.div
                        className="max-w-sm bg-white dark:bg-dark-bg rounded-2xl rounded-br-none shadow-xl p-4 border border-border dark:border-gray-800"
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                    >
                        <p className="text-gray-800 dark:text-gray-100 text-sm leading-relaxed">
                            {displayedText}
                            {showTyping && <span className="animate-pulse">|</span>}
                        </p>
                    </motion.div>

                    {/* Arrow/Pointer */}
                    <motion.div
                        className="absolute bottom-0 right-6 w-0 h-0 border-l-8 border-r-0 border-t-8 border-l-transparent border-t-white dark:border-t-dark-bg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
