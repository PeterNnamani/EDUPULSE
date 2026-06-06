export interface StaffClassAssignment {
  classId: string;
  className: string;
  gradeLevel?: string;
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
  if (!profile) return null;

  const classChips = profile.classes;
  const subjectChips = [
    ...profile.classes.flatMap((c) => c.subjects),
    ...profile.generalSubjects,
  ].filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);

  if (classChips.length === 0 && subjectChips.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {classChips.map((cls) => (
        <span
          key={`class-${cls.classId}`}
          className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shrink-0"
          title={cls.isFormTeacher ? 'Class teacher' : undefined}
        >
          {cls.className}
          {cls.isFormTeacher ? ' ★' : ''}
        </span>
      ))}
      {subjectChips.map((subject) => (
        <span
          key={`subject-${subject.id}`}
          className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 shrink-0"
        >
          {subject.name}
        </span>
      ))}
    </div>
  );
}
