import { motion } from 'framer-motion';
import { useAppStore } from '@/store';
import {
  useParentChildClasses,
  useSelectedChildClassName,
} from '@/hooks/useParentChildClasses';
import ParentChildClassBadge from '@/components/parent/ParentChildClassBadge';

interface ParentChildPageHeaderProps {
  title: string;
  subtitleSuffix: string;
}

export default function ParentChildPageHeader({
  title,
  subtitleSuffix,
}: ParentChildPageHeaderProps) {
  const { user, selectedParentChildId, setSelectedParentChildId } = useAppStore();
  const childClassNames = useParentChildClasses();
  const selectedChildClassName = useSelectedChildClassName();
  const selectedChild = user?.children?.find((c) => c.id === selectedParentChildId);

  const childOptionLabel = (child: {
    id: string;
    firstName: string;
    lastName: string;
    className?: string;
  }) => {
    const cls = child.className ?? childClassNames[child.id];
    const name = `${child.firstName} ${child.lastName}`;
    return cls ? `${name} · ${cls}` : name;
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-secondary-text mt-1">
          View {selectedChild?.firstName}&apos;s {subtitleSuffix}
        </p>
        <div className="mt-2">
          <ParentChildClassBadge className={selectedChildClassName} />
        </div>
      </motion.div>

      {user?.children && user.children.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <label className="block text-sm font-semibold mb-3">Select Child</label>
          <select
            value={selectedParentChildId || ''}
            onChange={(e) => setSelectedParentChildId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-secondary-bg dark:bg-dark-card border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {user.children.map((child) => (
              <option key={child.id} value={child.id}>
                {childOptionLabel(child)}
              </option>
            ))}
          </select>
        </motion.div>
      )}
    </>
  );
}
