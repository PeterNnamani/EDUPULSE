import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, GraduationCap } from 'lucide-react';
import { formatClassDisplay } from '@/utils/displayUtils';

export interface StaffClassAssignment {
  classId: string;
  className: string;
  gradeLevel?: string;
  section?: string;
  isFormTeacher: boolean;
  subjects: Array<{ id: string; name: string }>;
  studentCount?: number;
}

export interface StaffTeachingProfile {
  classes: StaffClassAssignment[];
  generalSubjects: Array<{ id: string; name: string }>;
}

interface StaffTeachingAssignmentsProps {
  profile?: StaffTeachingProfile | null;
}

export default function StaffTeachingAssignments({ profile }: StaffTeachingAssignmentsProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!profile) return null;

  const classChips = profile.classes;
  const subjectChips = [
    ...profile.classes.flatMap((c) => c.subjects),
    ...profile.generalSubjects,
  ].filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);

  if (classChips.length === 0 && subjectChips.length === 0) return null;

  const classCount = classChips.length;
  const subjectCount = subjectChips.length;

  return (
    <div className="mt-2 relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary-text hover:text-foreground transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {classCount > 0 && (
          <>
            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
            <span>
              {classCount} class{classCount !== 1 ? 'es' : ''}
            </span>
          </>
        )}
        {classCount > 0 && subjectCount > 0 && (
          <span className="text-border dark:text-gray-600">·</span>
        )}
        {subjectCount > 0 && (
          <>
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>
              {subjectCount} subject{subjectCount !== 1 ? 's' : ''}
            </span>
          </>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-72 max-h-52 overflow-y-auto rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-dark-bg shadow-lg p-3 space-y-3">
          {classChips.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-text mb-1.5">
                Classes
              </p>
              <div className="flex flex-wrap gap-1">
                {classChips.map((cls) => (
                  <span
                    key={`class-${cls.classId}`}
                    className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    title={cls.isFormTeacher ? 'Class teacher' : undefined}
                  >
                    {formatClassDisplay(cls)}
                    {cls.isFormTeacher ? ' ★' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
          {subjectChips.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-text mb-1.5">
                Subjects
              </p>
              <div className="flex flex-wrap gap-1">
                {subjectChips.map((subject) => (
                  <span
                    key={`subject-${subject.id}`}
                    className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                  >
                    {subject.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
