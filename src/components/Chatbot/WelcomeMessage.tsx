import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store';
import EdubotAvatar from './EdubotAvatar';
import { EDUBOT_NAME } from '@/services/chatConversationsStorage';

const VISIBLE_MS = 3500;

interface WelcomeMessageProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export default function WelcomeMessage({ isVisible, onDismiss }: WelcomeMessageProps) {
  const { user } = useAppStore();
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const displayName = (user?.fullName || user?.name || 'there').trim();
  const firstName = displayName.split(/\s+/)[0] || displayName;

  const messages: Record<string, string> = {
    admin: `Hi ${firstName} — ${EDUBOT_NAME} can help with school operations, staff, fees, and curriculum.`,
    teacher: `Hi ${firstName} — ask ${EDUBOT_NAME} for lesson notes, timetables, classes, and teaching help.`,
    principal: `Hi ${firstName} — ${EDUBOT_NAME} supports school-wide data, risk, and interventions.`,
    counselor: `Hi ${firstName} — ${EDUBOT_NAME} helps with cases, at-risk students, and support workflows.`,
    finance: `Hi ${firstName} — ask ${EDUBOT_NAME} about fees, payments, and virtual accounts.`,
    parent: `Hi ${firstName} — ${EDUBOT_NAME} can help with attendance, grades, fees, and assignments.`,
  };

  const message = user?.role ? messages[user.role] || messages.teacher : messages.teacher;

  useEffect(() => {
    if (!isVisible) return;
    const dismissTimer = setTimeout(() => onDismissRef.current(), VISIBLE_MS);
    return () => clearTimeout(dismissTimer);
  }, [isVisible, message]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed bottom-[5.75rem] right-6 z-40 max-w-[17rem]"
        >
          <div className="rounded-2xl rounded-br-sm border border-neutral-200 bg-white p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)]">
            <div className="mb-2.5">
              <EdubotAvatar size="sm" showOnline />
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
