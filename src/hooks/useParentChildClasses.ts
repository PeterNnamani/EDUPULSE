import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';

/** Resolves class names for all of the parent's children (cached per child id). */
export function useParentChildClasses(): Record<string, string> {
  const { user } = useAppStore();
  const [classNames, setClassNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const children = user?.children ?? [];
    if (children.length === 0) {
      setClassNames({});
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      const resolved: Record<string, string> = {};
      const classIdsToFetch = new Set<string>();

      for (const child of children) {
        if (child.className) {
          resolved[child.id] = child.className;
        } else if (child.classId) {
          classIdsToFetch.add(child.classId);
        }
      }

      if (classIdsToFetch.size > 0) {
        const { data } = await supabase
          .from('classes')
          .select('id, name')
          .in('id', [...classIdsToFetch]);

        const byClassId = Object.fromEntries((data ?? []).map((c) => [c.id, c.name]));

        for (const child of children) {
          if (!resolved[child.id] && child.classId && byClassId[child.classId]) {
            resolved[child.id] = byClassId[child.classId];
          }
        }
      }

      if (!cancelled) setClassNames(resolved);
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [user?.children]);

  return classNames;
}

export function useSelectedChildClassName(): string | null {
  const { selectedParentChildId } = useAppStore();
  const classNames = useParentChildClasses();
  if (!selectedParentChildId) return null;
  return classNames[selectedParentChildId] ?? null;
}
