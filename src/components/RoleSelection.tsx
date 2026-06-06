import { motion } from 'framer-motion';
import { Building2, BookOpen, GraduationCap, Brain, DollarSign, Users } from 'lucide-react';
import { useAppStore } from '@/store';
import type { UserRole } from '@/types';

const roles: Array<{
  id: UserRole;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    id: 'admin',
    label: 'School Administrator',
    icon: Building2,
    description: 'Manage school settings, staff, and subscriptions',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    icon: BookOpen,
    description: 'Manage classes, grades, and attendance',
  },
  {
    id: 'principal',
    label: 'Principal',
    icon: GraduationCap,
    description: 'View analytics and oversee school operations',
  },
  {
    id: 'counselor',
    label: 'Counselor',
    icon: Brain,
    description: 'Manage student interventions and risk cases',
  },
  {
    id: 'finance',
    label: 'Finance Officer',
    icon: DollarSign,
    description: 'Manage fees, payments, and financial reports',
  },
  {
    id: 'parent',
    label: 'Parent',
    icon: Users,
    description: 'View your child\'s academic progress',
  },
];

export default function RoleSelection() {
  const setSelectedRole = useAppStore((s) => s.setSelectedRole);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-black dark:text-white mb-3">
            Who Are You?
          </h1>
          <p className="text-secondary-text dark:text-gray-400">
            Select your role to continue
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role, index) => {
            const Icon = role.icon;
            return (
              <motion.button
                key={role.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleRoleSelect(role.id)}
                className="card-hover text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary-bg dark:bg-dark-card flex items-center justify-center shrink-0 group-hover:bg-black dark:group-hover:bg-white transition-colors">
                    <Icon className="w-6 h-6 text-black dark:text-white group-hover:text-white dark:group-hover:text-black transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-black dark:text-white mb-1">
                      {role.label}
                    </h3>
                    <p className="text-sm text-secondary-text dark:text-gray-400">
                      {role.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
