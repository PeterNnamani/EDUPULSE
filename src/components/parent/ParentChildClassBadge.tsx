import { GraduationCap } from 'lucide-react';

interface ParentChildClassBadgeProps {
  className?: string | null;
  size?: 'sm' | 'md';
}

export default function ParentChildClassBadge({
  className,
  size = 'md',
}: ParentChildClassBadgeProps) {
  if (!className) {
    return (
      <span className="text-secondary-text text-sm">Class not assigned</span>
    );
  }

  const sizeClasses =
    size === 'sm'
      ? 'text-xs px-2 py-0.5'
      : 'text-sm px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-medium ${sizeClasses}`}
    >
      <GraduationCap className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {className}
    </span>
  );
}
