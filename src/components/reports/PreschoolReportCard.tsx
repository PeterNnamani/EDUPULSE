import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Baby, Loader, Star, Heart } from 'lucide-react';
import {
  preschoolAssessmentService,
  PRESCHOOL_CATEGORIES,
  RATING_LABEL,
  RATING_COLOR,
  RATING_VALUE,
  ProgressSummary,
  PreschoolAssessmentRow,
} from '@/services/preschoolAssessmentService';

interface Props {
  schoolId: string;
  studentId: string;
  childName?: string;
}

function ratingStars(value: number) {
  // value 1..6 -> show filled blocks out of 6
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${i < value ? '' : 'opacity-20'}`}
          style={{ backgroundColor: i < value ? '#16A34A' : '#9CA3AF' }}
        />
      ))}
    </div>
  );
}

export default function PreschoolReportCard({ schoolId, studentId, childName }: Props) {
  const [rows, setRows] = useState<PreschoolAssessmentRow[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const data = await preschoolAssessmentService.getStudentAssessments(schoolId, studentId);
      if (!active) return;
      setRows(data);
      setSummary(preschoolAssessmentService.buildProgressSummary(data));
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [schoolId, studentId]);

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card text-center py-10">
        <Baby className="w-10 h-10 text-pink-400 mx-auto mb-2 opacity-60" />
        <p className="text-secondary-text">No early-years assessment recorded yet.</p>
      </div>
    );
  }

  // Latest rating per category.
  const latestByCategory = new Map<string, PreschoolAssessmentRow>();
  for (const r of rows) {
    const prev = latestByCategory.get(r.category);
    if (!prev || r.assessed_at > prev.assessed_at) latestByCategory.set(r.category, r);
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/10 dark:to-purple-900/10 border border-pink-200 dark:border-pink-900/30"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center">
            <Baby className="w-6 h-6 text-pink-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold">
              {childName ? `${childName}'s` : ''} Early-Years Progress
            </h2>
            <p className="text-sm text-secondary-text">
              Overall: <span className="font-semibold">{summary?.averageLabel}</span>
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {summary && summary.strengths.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold">Strengths</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.strengths.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {summary && summary.needsAttention.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold">Areas to Support</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.needsAttention.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Competency Ratings</h3>
        <div className="space-y-3">
          {PRESCHOOL_CATEGORIES.map((cat) => {
            const r = latestByCategory.get(cat.key);
            if (!r) return null;
            const val = RATING_VALUE[r.rating] ?? 0;
            return (
              <div key={cat.key} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{cat.label}</span>
                <div className="flex items-center gap-3">
                  {ratingStars(val)}
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: RATING_COLOR[r.rating] }}
                  >
                    {RATING_LABEL[r.rating]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {rows.some((r) => r.teacher_comment) && (
        <div className="card">
          <h3 className="font-semibold mb-2">Teacher's Comment</h3>
          <p className="text-sm text-secondary-text">
            {rows.find((r) => r.teacher_comment)?.teacher_comment}
          </p>
        </div>
      )}
    </div>
  );
}
