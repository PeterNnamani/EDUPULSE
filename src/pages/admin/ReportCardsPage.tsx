import { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';
import ReportCardManagementPage from './ReportCardManagementPage';

interface SelectOption {
  id: string;
  name: string;
}

export default function ReportCardsPage() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId ?? '';
  const [classes, setClasses] = useState<SelectOption[]>([]);
  const [sessions, setSessions] = useState<SelectOption[]>([]);
  const [terms, setTerms] = useState<SelectOption[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const [{ data: classRows }, { data: sessionRows }] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
        supabase
          .from('academic_sessions')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: false }),
      ]);

      setClasses(classRows ?? []);
      setSessions(sessionRows ?? []);

      if (classRows?.length) setSelectedClass(classRows[0].id);
      if (sessionRows?.length) setSelectedSession(sessionRows[0].id);

      setLoading(false);
    };

    void load();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !selectedSession) {
      setTerms([]);
      return;
    }

    const loadTerms = async () => {
      const { data } = await supabase
        .from('academic_terms')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('session_id', selectedSession)
        .order('start_date');

      setTerms(data ?? []);
      if (data?.length) setSelectedTerm(data[0].id);
    };

    void loadTerms();
  }, [schoolId, selectedSession]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!classes.length || !sessions.length || !terms.length) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">Report Cards</h1>
        <p className="text-secondary-text">
          Set up classes and the academic calendar before managing report cards.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-bold mb-4">Report Cards</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label mb-1.5 block">Class</label>
            <select
              className="input-field"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Session</label>
            <select
              className="input-field"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Term</label>
            <select
              className="input-field"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedClass && selectedSession && selectedTerm && (
        <ReportCardManagementPage
          schoolId={schoolId}
          classId={selectedClass}
          sessionId={selectedSession}
          termId={selectedTerm}
          userRole={user?.role ?? 'admin'}
        />
      )}
    </div>
  );
}
