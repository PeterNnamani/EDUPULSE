import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, ArrowRight, RefreshCw, Loader2, Plus, Check } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { getCurrentSession } from '@/utils/calendarUtils';
import { syncAllStudentsAcademicRecords } from '@/services/academicRecordService';
import { promotionEngine } from '@/services/promotionEngine';
import { graduationService } from '@/services/graduationService';
import { formatClassDisplay } from '@/utils/displayUtils';

interface ClassRow {
  id: string;
  name: string;
  grade_level?: string;
  section?: string | null;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
}

export default function AcademicLifecyclePage() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fromClassId, setFromClassId] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    void load();
  }, [schoolId]);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const session = await getCurrentSession(schoolId);
      setSessionId(session?.id ?? null);

      const [{ data: cls }, { data: studs }] = await Promise.all([
        supabase.from('classes').select('id, name, grade_level, section').eq('school_id', schoolId).eq('is_active', true).order('name'),
        supabase
          .from('students')
          .select('id, first_name, last_name, class_id')
          .eq('school_id', schoolId)
          .eq('status', 'active')
          .order('last_name'),
      ]);
      setClasses(
        (cls ?? []).map((c) => ({
          ...c,
          name: formatClassDisplay(c),
        }))
      );
      setStudents(studs ?? []);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncRecords = async () => {
    if (!schoolId) return;
    setSyncing(true);
    setError('');
    const { synced, failed } = await syncAllStudentsAcademicRecords(schoolId);
    setMessage(`Synced academic records for ${synced} students${failed ? ` (${failed} failed)` : ''}.`);
    setSyncing(false);
  };

  const handleCreateRule = async () => {
    if (!schoolId || !fromClassId || !toClassId) {
      setError('Select both source and destination classes.');
      return;
    }
    setError('');
    const result = await promotionEngine.createPromotionRule(
      schoolId,
      fromClassId,
      toClassId,
      75,
      40,
      40
    );
    if (!result.success) setError('Could not save promotion rule.');
    else setMessage('Promotion rule saved.');
  };

  const handleBatchPromote = async () => {
    if (!schoolId || !sessionId || !fromClassId || !toClassId) {
      setError('Select session, source class, and destination class.');
      return;
    }
    setProcessing(true);
    setError('');
    await syncAllStudentsAcademicRecords(schoolId);
    const result = await promotionEngine.processBatchPromotions(
      schoolId,
      sessionId,
      fromClassId,
      toClassId
    );
    setProcessing(false);
    if (result.error) {
      setError(String(result.error));
    } else {
      setMessage(
        `Promotion complete: ${result.promoted} promoted, ${result.repeated} repeating, ${result.manualReview} need review.`
      );
      await load();
    }
  };

  const handleGraduateClass = async () => {
    if (!schoolId || !sessionId || !fromClassId) {
      setError('Select a class to graduate.');
      return;
    }
    setProcessing(true);
    setError('');
    let graduated = 0;
    const classStudents = students.filter((s) => s.class_id === fromClassId);
    for (const s of classStudents) {
      await syncAllStudentsAcademicRecords(schoolId);
      const check = await graduationService.checkGraduationEligibility(
        s.id,
        fromClassId,
        sessionId
      );
      if (check.eligible) {
        const res = await graduationService.graduateStudent(
          s.id,
          schoolId,
          fromClassId,
          sessionId
        );
        if (res.success) graduated++;
      }
    }
    setProcessing(false);
    setMessage(`Graduated ${graduated} of ${classStudents.length} students in selected class.`);
    await load();
  };

  const classStudents = students.filter((s) => s.class_id === fromClassId);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Promotion & graduation</h1>
        <p className="text-secondary-text text-sm mt-1">
          Sync records from attendance, grades, and fees — then promote or graduate students with a full audit trail.
        </p>
      </div>

      {message && (
        <div className="card bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-sm">{message}</div>
      )}
      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div className="card lg:col-span-1">
          <h3 className="font-semibold mb-3">1. Sync records</h3>
          <p className="text-xs text-secondary-text mb-4">
            Pulls live attendance, grades, behaviour, and fee status into `student_academic_records` for the current session.
          </p>
          <button type="button" onClick={handleSyncRecords} disabled={syncing} className="btn-primary w-full flex items-center justify-center gap-2">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync all students
          </button>
        </motion.div>

        <motion.div className="card lg:col-span-2">
          <h3 className="font-semibold mb-3">2. Promotion rule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select className="input-field" value={fromClassId} onChange={(e) => setFromClassId(e.target.value)}>
              <option value="">From class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className="input-field" value={toClassId} onChange={(e) => setToClassId(e.target.value)}>
              <option value="">To class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="button" onClick={handleCreateRule} className="btn-secondary flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Save rule
            </button>
          </div>
        </motion.div>
      </div>

      <motion.div className="card">
        <h3 className="font-semibold mb-3">3. Run promotion or graduation</h3>
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            type="button"
            onClick={handleBatchPromote}
            disabled={processing || !sessionId}
            className="btn-primary flex items-center gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Promote class
          </button>
          <button
            type="button"
            onClick={handleGraduateClass}
            disabled={processing || !sessionId}
            className="btn-secondary flex items-center gap-2"
          >
            <GraduationCap className="w-4 h-4" />
            Graduate eligible (final class)
          </button>
        </div>

        <p className="text-sm text-secondary-text mb-2">
          {fromClassId
            ? `${classStudents.length} active students in selected source class`
            : 'Select a source class above'}
        </p>

        {fromClassId && classStudents.length > 0 && (
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="text-left py-2 px-3">Student</th>
                  <th className="text-left py-2 px-3">Current class</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((s) => (
                  <tr key={s.id} className="table-row">
                    <td className="py-2 px-3">{s.first_name} {s.last_name}</td>
                    <td className="py-2 px-3">{classes.find((c) => c.id === s.class_id)?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {!sessionId && (
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          No current academic session. Set one under Academic calendar first.
        </p>
      )}
    </div>
  );
}
