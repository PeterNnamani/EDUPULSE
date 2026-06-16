import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, Users, Loader, Star } from 'lucide-react';
import { useAppStore } from '@/store';
import {
    getTeacherTeachingLoad,
    type TeacherClassLoad,
    type TeacherSubjectSlot,
} from '@/services/classService';
import { formatClassDisplay } from '@/utils/displayUtils';

const SUBJECT_COLORS = [
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200',
    'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
];

function subjectColor(index: number): string {
    return SUBJECT_COLORS[index % SUBJECT_COLORS.length];
}

function SubjectChips({ subjects, size = 'md' }: { subjects: TeacherSubjectSlot[]; size?: 'sm' | 'md' }) {
    if (subjects.length === 0) {
        return (
            <span className="text-xs text-secondary-text italic">No subject assigned yet</span>
        );
    }

    const chipClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

    return (
        <div className="flex flex-wrap gap-1.5">
            {subjects.map((sub, i) => (
                <span
                    key={sub.subjectId}
                    className={`inline-flex items-center gap-1 rounded-full font-medium ${chipClass} ${subjectColor(i)}`}
                >
                    <BookOpen className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                    {sub.subjectName}
                    {sub.subjectCode && (
                        <span className="opacity-70 font-normal">({sub.subjectCode})</span>
                    )}
                </span>
            ))}
        </div>
    );
}

function ClassCard({ entry, index, compact }: { entry: TeacherClassLoad; index: number; compact?: boolean }) {
    const displayName = formatClassDisplay(entry);

    if (compact) {
        return (
            <div className="p-3 rounded-xl bg-secondary-bg/80 dark:bg-dark-card border border-border dark:border-gray-800">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{displayName}</p>
                    </div>
                    {entry.isFormTeacher && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            <Star className="w-2.5 h-2.5" />
                            Form
                        </span>
                    )}
                </div>
                <SubjectChips subjects={entry.subjects} size="sm" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="group relative overflow-hidden rounded-2xl border border-border dark:border-gray-800 bg-gradient-to-br from-white to-secondary-bg/60 dark:from-dark-card dark:to-dark-bg p-5 hover:shadow-md transition-shadow"
        >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none" />

            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 dark:from-white dark:to-gray-200 flex items-center justify-center shrink-0 shadow-sm">
                        <GraduationCap className="w-5 h-5 text-white dark:text-slate-900" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-lg leading-tight truncate">{displayName}</h4>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-secondary-text">
                            <Users className="w-3.5 h-3.5" />
                            {entry.studentCount} student{entry.studentCount !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
                {entry.isFormTeacher && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100 border border-amber-200/80 dark:border-amber-800">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        Class Teacher
                    </span>
                )}
            </div>

            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary-text mb-2">
                    Your subject{entry.subjects.length !== 1 ? 's' : ''} in this class
                </p>
                <SubjectChips subjects={entry.subjects} />
            </div>
        </motion.div>
    );
}

interface TeacherTeachingLoadProps {
    compact?: boolean;
    className?: string;
}

export default function TeacherTeachingLoad({ compact = false, className = '' }: TeacherTeachingLoadProps) {
    const { user } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<TeacherClassLoad[]>([]);
    const [generalSubjects, setGeneralSubjects] = useState<TeacherSubjectSlot[]>([]);

    useEffect(() => {
        if (!user?.schoolId || !user?.id || user.role !== 'teacher') {
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        getTeacherTeachingLoad(user.schoolId, user.id)
            .then((load) => {
                if (cancelled) return;
                setClasses(load.classes);
                setGeneralSubjects(load.generalSubjects);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [user?.schoolId, user?.id, user?.role]);

    if (user?.role !== 'teacher') return null;

    if (loading) {
        return (
            <div className={`flex justify-center py-6 ${className}`}>
                <Loader className="w-5 h-5 animate-spin text-secondary-text" />
            </div>
        );
    }

    if (classes.length === 0 && generalSubjects.length === 0) {
        return (
            <div className={`text-center py-8 ${className}`}>
                <GraduationCap className="w-10 h-10 text-secondary-text mx-auto mb-2 opacity-40" />
                <p className="text-sm text-secondary-text">No classes or subjects assigned yet.</p>
                <p className="text-xs text-secondary-text mt-1">
                    Contact your administrator to assign your classes and subjects.
                </p>
            </div>
        );
    }

    if (compact) {
        return (
            <div className={`space-y-2 ${className}`}>
                {classes.map((entry, i) => (
                    <ClassCard key={entry.classId} entry={entry} index={i} compact />
                ))}
                {generalSubjects.length > 0 && (
                    <div className="p-3 rounded-xl border border-dashed border-border dark:border-gray-700">
                        <p className="text-[11px] font-semibold text-secondary-text mb-1.5 uppercase tracking-wide">
                            Subjects (all classes)
                        </p>
                        <SubjectChips subjects={generalSubjects} size="sm" />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map((entry, i) => (
                    <ClassCard key={entry.classId} entry={entry} index={i} />
                ))}
            </div>

            {generalSubjects.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-xl border border-dashed border-border dark:border-gray-700 bg-secondary-bg/40 dark:bg-dark-card/40"
                >
                    <p className="text-sm font-semibold mb-2">Subjects assigned to you</p>
                    <p className="text-xs text-secondary-text mb-3">
                        These subjects are on your profile. Class-specific assignments may be added by admin.
                    </p>
                    <SubjectChips subjects={generalSubjects} />
                </motion.div>
            )}

            {classes.length > 1 && (
                <p className="text-xs text-secondary-text mt-4 text-center">
                    You teach across {classes.length} classes
                    {classes.some((c) => !c.isFormTeacher) &&
                        ' — including classes where you teach specific subjects only'}
                </p>
            )}
        </div>
    );
}
