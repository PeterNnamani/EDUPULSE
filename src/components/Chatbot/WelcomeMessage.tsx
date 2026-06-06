import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store';

const VISIBLE_MS = 3000;

interface WelcomeMessageProps {
    isVisible: boolean;
    onDismiss: () => void;
}

export default function WelcomeMessage({ isVisible, onDismiss }: WelcomeMessageProps) {
    const { user } = useAppStore();
    const onDismissRef = useRef(onDismiss);
    onDismissRef.current = onDismiss;

    const displayName = (user?.fullName || user?.name || 'there').trim();

    const messages: Record<string, string> = {
        admin: `Hello, ${displayName}! I'm your EduPulse Assistant. I can help with school operations and answer questions about your account data — students, staff, subscriptions, and more.`,
        teacher: `Hello, ${displayName}! I'm your EduPulse Assistant. I can help with your classes, school activities, lesson notes, and answer questions about your account — attendance, assignments, and students who may need attention.`,
        principal: `Hello, ${displayName}! I support early intervention oversight — risk monitoring, counselor workflows, behaviour trends, and school-wide data in your account.`,
        counselor: `Hello, ${displayName}! I help with intervention cases, student support workflows, and account data so you can act before issues escalate.`,
        finance: `Hello, ${displayName}! I can help with fees, payments, and questions about financial data in your account.`,
        parent: `Hello, ${displayName}! I can help you follow your child's attendance, grades, assignments, and behaviour updates from your account.`,
    };

    const message = user?.role ? messages[user.role] || messages.teacher : messages.teacher;

    useEffect(() => {
        if (!isVisible) return;

        const dismissTimer = setTimeout(() => {
            onDismissRef.current();
        }, VISIBLE_MS);

        return () => clearTimeout(dismissTimer);
    }, [isVisible, message]);

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
                    <motion.div
                        className="max-w-sm bg-white dark:bg-dark-bg rounded-2xl rounded-br-none shadow-xl p-4 border border-border dark:border-gray-800"
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                    >
                        <p className="text-gray-800 dark:text-gray-100 text-sm leading-relaxed">
                            {message}
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
