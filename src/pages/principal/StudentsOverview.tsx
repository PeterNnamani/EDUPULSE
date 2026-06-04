import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Users, Loader2, Filter } from 'lucide-react';
import { useAppStore } from '@/store';
import { getStudents } from '@/services/studentService';
import { getClasses } from '@/services/classService';
import { supabase } from '@/lib/supabase';

interface StudentRow {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  className: string;
  status: string;
  riskLevel: string;
}

export default function PrincipalStudentsOverview() {
  const { user } = useAppStore();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!user?.schoolId) return;

    const load = async () => {
      setLoading(true);
      try {
        const [students, classList] = await Promise.all([
          getStudents(user.schoolId),
          getClasses(user.schoolId),
        ]);

        setClasses(classList.map((c) => ({ id: c.id, name: c.name })));
        const classMap = new Map(classList.map((c) => [c.id, c.name]));

        const { data: riskRows } = await supabase
          .from('risk_scores')
          .select('student_id, risk_level')
          .eq('school_id', user.schoolId);

        const riskMap = new Map((riskRows ?? []).map((r) => [r.student_id, r.risk_level]));

        setRows(
          students.map((s) => ({
            id: s.id,
            student_id: s.student_id,
            first_name: s.first_name,
            last_name: s.last_name,
            className: s.class_id ? classMap.get(s.class_id) ?? 'Unassigned' : 'Unassigned',
            status: s.status,
            riskLevel: riskMap.get(s.id) ?? 'low',
          }))
        );
      } catch (e) {
        console.error('[Principal] Students load failed:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.schoolId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (classFilter && s.className !== classFilter) return false;
      if (!q) return true;
      return (
        s.first_name.toLowerCase().includes(q) ||
        s.last_name.toLowerCase().includes(q) ||
        s.student_id.toLowerCase().includes(q)
      );
    });
  }, [rows, search, classFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-7 h-7" />
          Students
        </h1>
        <p className="text-secondary-text">School-wide student roster — view only</p>
      </div>

      <div className="card flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
          <input
            className="input-field pl-10 w-full"
            placeholder="Search by name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative sm:w-48">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
          <select
            className="input-field pl-10 w-full"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border dark:border-gray-800 bg-secondary-bg/50 dark:bg-dark-card/50">
                  <th className="text-left py-3 px-4 font-semibold">Student ID</th>
                  <th className="text-left py-3 px-4 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Class</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-secondary-text">
                      No students match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-border dark:border-gray-800 hover:bg-secondary-bg/30 dark:hover:bg-dark-card/30"
                    >
                      <td className="py-3 px-4 font-mono text-xs">{s.student_id}</td>
                      <td className="py-3 px-4 font-medium">
                        {s.first_name} {s.last_name}
                      </td>
                      <td className="py-3 px-4">{s.className}</td>
                      <td className="py-3 px-4 capitalize">{s.status}</td>
                      <td className="py-3 px-4">
                        <RiskBadge level={s.riskLevel} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <p className="text-xs text-secondary-text px-4 py-3 border-t border-border dark:border-gray-800">
            Showing {filtered.length} of {rows.length} active students
          </p>
        )}
      </motion.div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${styles[level] ?? styles.low}`}>
      {level}
    </span>
  );
}
