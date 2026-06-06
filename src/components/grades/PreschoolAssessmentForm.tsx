import { useEffect, useMemo, useState } from 'react';
import { Loader, Save, Baby } from 'lucide-react';
import {
  preschoolAssessmentService,
  PRESCHOOL_CATEGORIES,
  PRESCHOOL_RATINGS,
  PreschoolCategory,
  PreschoolRating,
} from '@/services/preschoolAssessmentService';

interface StudentLite {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  schoolId: string;
  classId: string;
  termId: string;
  assessedBy: string;
  students: StudentLite[];
}

type RatingMap = Record<string, PreschoolRating | ''>;

export default function PreschoolAssessmentForm({
  schoolId,
  classId,
  termId,
  assessedBy,
  students,
}: Props) {
  const [selectedStudent, setSelectedStudent] = useState<string>(students[0]?.id ?? '');
  const [ratings, setRatings] = useState<RatingMap>({});
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (students.length && !selectedStudent) setSelectedStudent(students[0].id);
  }, [students, selectedStudent]);

  useEffect(() => {
    const loadExisting = async () => {
      if (!selectedStudent || !termId) return;
      setLoading(true);
      setMessage('');
      const rows = await preschoolAssessmentService.getStudentAssessments(
        schoolId,
        selectedStudent,
        termId
      );
      const map: RatingMap = {};
      let firstComment = '';
      for (const r of rows) {
        map[r.category] = r.rating as PreschoolRating;
        if (!firstComment && r.teacher_comment) firstComment = r.teacher_comment;
      }
      setRatings(map);
      setComment(firstComment);
      setLoading(false);
    };
    void loadExisting();
  }, [schoolId, selectedStudent, termId]);

  const completed = useMemo(
    () => PRESCHOOL_CATEGORIES.filter((c) => ratings[c.key]).length,
    [ratings]
  );

  const setRating = (category: PreschoolCategory, rating: PreschoolRating) => {
    setRatings((prev) => ({ ...prev, [category]: rating }));
    setMessage('');
  };

  const handleSave = async () => {
    if (!selectedStudent || !termId) {
      setMessage('Select a student and term first.');
      return;
    }
    const payload = PRESCHOOL_CATEGORIES.filter((c) => ratings[c.key]).map((c) => ({
      category: c.key as PreschoolCategory,
      rating: ratings[c.key] as PreschoolRating,
      comment: comment || undefined,
    }));
    if (payload.length === 0) {
      setMessage('Please rate at least one category.');
      return;
    }
    setSaving(true);
    const res = await preschoolAssessmentService.saveAssessments(
      schoolId,
      selectedStudent,
      classId,
      termId,
      assessedBy,
      payload
    );
    setSaving(false);
    setMessage(res.success ? 'Assessment saved.' : res.error || 'Failed to save.');
  };

  return (
    <div className="space-y-6">
      <div className="card bg-pink-50 dark:bg-pink-900/10 border border-pink-200 dark:border-pink-900/30">
        <div className="flex items-start gap-3">
          <Baby className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Early-Years Competency Assessment</p>
            <p className="text-sm text-secondary-text">
              This is a Nursery/Kindergarten class. Select competency ratings instead of numeric
              scores.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="label mb-1.5 block">Pupil</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="input-field"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-secondary-text">
            {completed}/{PRESCHOOL_CATEGORIES.length} competencies rated
          </div>
        </div>
      </div>

      {message && (
        <div className="card bg-secondary-bg">
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {PRESCHOOL_CATEGORIES.map((cat) => (
              <div key={cat.key} className="border-b border-border dark:border-gray-800 pb-4 last:border-0">
                <p className="font-medium mb-2">{cat.label}</p>
                <div className="flex flex-wrap gap-2">
                  {PRESCHOOL_RATINGS.map((r) => {
                    const active = ratings[cat.key] === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setRating(cat.key as PreschoolCategory, r.key as PreschoolRating)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          active
                            ? 'text-white border-transparent'
                            : 'border-border dark:border-gray-700 text-secondary-text hover:bg-secondary-bg'
                        }`}
                        style={active ? { backgroundColor: r.color } : undefined}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <label className="label mb-1.5 block">Teacher's comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="input-field"
                rows={3}
                placeholder="Overall remarks about the pupil's progress..."
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Assessment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
