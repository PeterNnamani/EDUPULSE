import { useAppStore } from '@/store';
import { useParentChildClasses } from '@/hooks/useParentChildClasses';
import ParentChildClassBadge from '@/components/parent/ParentChildClassBadge';
import { getInitials } from '@/utils/displayUtils';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  className?: string;
}

interface Props {
  variant?: 'hero' | 'default';
  className?: string;
  /** Hero dashboard: no outer panel box — content only. */
  bare?: boolean;
}

export default function ParentChildSelector({
  variant = 'default',
  className = '',
  bare = false,
}: Props) {
  const { user, selectedParentChildId, setSelectedParentChildId } = useAppStore();
  const childClassNames = useParentChildClasses();
  const children = (user?.children ?? []) as Child[];
  const multi = children.length > 1;
  const selectedChild = children.find((c) => c.id === selectedParentChildId);

  if (!selectedChild) return null;

  const classFor = (child: Child) => child.className ?? childClassNames[child.id] ?? null;
  const isHero = variant === 'hero';
  const usePanel = !bare && isHero;
  const panelClass = usePanel
    ? 'rounded-xl bg-white/10 border border-white/10 px-4 py-3'
    : isHero
      ? ''
      : 'rounded-xl bg-secondary-bg dark:bg-dark-card border border-gray-200 dark:border-gray-700 px-4 py-3';

  if (!multi) {
    const cls = classFor(selectedChild);
    return (
      <div className={`flex items-center gap-3 w-full ${className || 'mt-5'} ${panelClass}`}>
        <div
          className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
            isHero ? 'bg-white/15 text-white' : 'bg-white dark:bg-dark-bg text-primary-text'
          }`}
        >
          {getInitials(selectedChild.firstName, selectedChild.lastName)}
        </div>
        <div className="min-w-0">
          <p className={`font-semibold truncate ${isHero ? 'text-white' : ''}`}>
            {selectedChild.firstName} {selectedChild.lastName}
          </p>
          <div className="mt-1">
            <ParentChildClassBadge className={cls} size="sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className || 'mt-5'} ${panelClass}`}>
      <p
        className={`text-[11px] uppercase tracking-wider font-medium mb-2.5 ${
          isHero ? 'text-gray-400' : 'text-secondary-text'
        }`}
      >
        Switch child
      </p>
      <div className="flex flex-wrap gap-2.5">
        {children.map((child) => {
          const selected = child.id === selectedParentChildId;
          const cls = classFor(child);
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => setSelectedParentChildId(child.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left min-w-0 max-w-full sm:max-w-[220px] ${
                isHero
                  ? selected
                    ? 'bg-white/20 ring-1 ring-white/35'
                    : 'bg-white/10 hover:bg-white/15 border border-white/10'
                  : selected
                    ? 'bg-primary/10 ring-2 ring-primary/40 border border-primary/30'
                    : 'bg-secondary-bg dark:bg-dark-card hover:bg-gray-100 dark:hover:bg-dark-bg border border-gray-200 dark:border-gray-700'
              }`}
            >
              <div
                className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  isHero
                    ? selected
                      ? 'bg-white/25 text-white'
                      : 'bg-white/15 text-white/90'
                    : selected
                      ? 'bg-primary text-white'
                      : 'bg-white dark:bg-dark-bg text-primary-text'
                }`}
              >
                {getInitials(child.firstName, child.lastName)}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium truncate ${
                    isHero ? (selected ? 'text-white' : 'text-white/90') : ''
                  }`}
                >
                  {child.firstName} {child.lastName}
                </p>
                {cls && (
                  <p
                    className={`text-[11px] truncate mt-0.5 ${
                      isHero ? 'text-gray-400' : 'text-secondary-text'
                    }`}
                  >
                    {cls}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
