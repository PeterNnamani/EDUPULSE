import type { StaffTeachingProfile } from '@/components/admin/StaffTeachingAssignments';

interface ClassRow {
  id: string;
  name: string;
  grade_level?: string;
  class_teacher_id: string | null;
}

interface ClassSubjectRow {
  teacher_id: string | null;
  class_id: string;
  subject_id: string;
  classes?: { id: string; name: string; grade_level?: string } | null;
  subjects?: { id: string; name: string } | null;
}

export function buildStaffTeachingMap(
  classes: ClassRow[],
  classSubjectRows: ClassSubjectRow[],
  staffSubjects: Record<string, string[]>,
  subjectNameById: Record<string, string>
): Record<string, StaffTeachingProfile> {
  const map: Record<string, StaffTeachingProfile> = {};
  const linkedSubjectByStaff = new Map<string, Set<string>>();

  const ensureStaff = (staffId: string) => {
    if (!map[staffId]) {
      map[staffId] = { classes: [], generalSubjects: [] };
    }
    return map[staffId];
  };

  const ensureClass = (staffId: string, classId: string, className: string, gradeLevel?: string, isFormTeacher = false) => {
    const profile = ensureStaff(staffId);
    let entry = profile.classes.find((c) => c.classId === classId);
    if (!entry) {
      entry = {
        classId,
        className,
        gradeLevel,
        isFormTeacher,
        subjects: [],
      };
      profile.classes.push(entry);
    } else if (isFormTeacher) {
      entry.isFormTeacher = true;
    }
    return entry;
  };

  for (const cls of classes) {
    if (cls.class_teacher_id) {
      ensureClass(cls.class_teacher_id, cls.id, cls.name, cls.grade_level, true);
    }
  }

  for (const row of classSubjectRows) {
    if (!row.teacher_id) continue;
    const cls = row.classes;
    const sub = row.subjects;
    if (!cls || !sub) continue;

    const entry = ensureClass(row.teacher_id, cls.id, cls.name, cls.grade_level, false);
    if (!entry.subjects.some((s) => s.id === sub.id)) {
      entry.subjects.push({ id: sub.id, name: sub.name });
    }

    if (!linkedSubjectByStaff.has(row.teacher_id)) {
      linkedSubjectByStaff.set(row.teacher_id, new Set());
    }
    linkedSubjectByStaff.get(row.teacher_id)!.add(sub.id);
  }

  for (const [staffId, subjectIds] of Object.entries(staffSubjects)) {
    const profile = ensureStaff(staffId);
    const linked = linkedSubjectByStaff.get(staffId) ?? new Set();
    const formClasses = profile.classes.filter((c) => c.isFormTeacher);

    for (const subjectId of subjectIds) {
      const name = subjectNameById[subjectId];
      if (!name) continue;

      if (linked.has(subjectId)) continue;

      if (formClasses.length === 1) {
        const entry = formClasses[0];
        if (!entry.subjects.some((s) => s.id === subjectId)) {
          entry.subjects.push({ id: subjectId, name });
        }
      } else if (formClasses.length > 1) {
        for (const entry of formClasses) {
          if (!entry.subjects.some((s) => s.id === subjectId)) {
            entry.subjects.push({ id: subjectId, name });
          }
        }
      } else {
        if (!profile.generalSubjects.some((s) => s.id === subjectId)) {
          profile.generalSubjects.push({ id: subjectId, name });
        }
      }
    }
  }

  for (const profile of Object.values(map)) {
    profile.classes.sort((a, b) => a.className.localeCompare(b.className));
    profile.classes.forEach((c) => {
      c.subjects.sort((a, b) => a.name.localeCompare(b.name));
    });
    profile.generalSubjects.sort((a, b) => a.name.localeCompare(b.name));
  }

  return map;
}
