import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';

interface BehaviourRow {
  id: string;
  studentName: string;
  className: string;
  behaviour_type: string;
  category: string | null;
  description: string;
  points: number;
  date: string;
}

export default function PrincipalBehaviourOverview() {
  const { user } = useAppStore();
  const [rows, setRows] = useState<BehaviourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    if (!user?.schoolId) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('behaviour_records')
          .select(`
            id,
            behaviour_type,
            category,
            description,
            points,
            date,
            students(first_name, last_name),
            classes(name)
          `)
          .eq('school_id', user.schoolId)
          .order('date', { ascending: false })
          .limit(100);

        if (error) throw error;

        setRows(
          (data ?? []).map((r: {
            id: string;
            behaviour_type: string;
            category: string | null;
            description: string;
            points: number;
            date: string;
            students?: { first_name: string; last_name: string };
            classes?: { name: string };
          }) => ({
            id: r.id,
            studentName: r.students
              ? `${r.students.first_name} ${r.students.last_name}`
              : 'Unknown',
            className: r.classes?.name ?? '—',
            behaviour_type: r.behaviour_type,
            category: r.category,
            description: r.description,
            points: r.points ?? 0,
            date: r.date,
          }))
        );
      } catch (e) {
        console.error('[Principal] Behaviour load failed:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.schoolId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter && r.behaviour_type !== typeFilter) return false;
      if (!q) return true;
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter]);

  const merits = rows.filter((r) => ['merit', 'commendation'].includes(r.behaviour_type)).length;
  const demerits = rows.filter((r) =>
    ['demerit', 'warning', 'suspension', 'expulsion'].includes(r.behaviour_type)
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-7 h-7" />
          Behaviour
        </h1>
        <p className="text-secondary-text">
          Recent records — {merits} positive, {demerits} incidents (last 100)
        </p>
      </div>

      <div className="card flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
          <input
            className="input-field pl-10 w-full"
            placeholder="Search student or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field sm:w-44"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          <option value="merit">Merit</option>
          <option value="commendation">Commendation</option>
          <option value="demerit">Demerit</option>
          <option value="warning">Warning</option>
        </select>
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
                <tr className="border-b border-border dark:border-gray-800 bg-secondary-bg/50">
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Student</th>
                  <th className="text-left py-3 px-4 font-semibold">Class</th>
                  <th className="text-left py-3 px-4 font-semibold">Type</th>
                  <th className="text-left py-3 px-4 font-semibold">Description</th>
                  <th className="text-right py-3 px-4 font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-secondary-text">
                      No behaviour records found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border dark:border-gray-800">
                      <td className="py-3 px-4 whitespace-nowrap">{r.date}</td>
                      <td className="py-3 px-4 font-medium">{r.studentName}</td>
                      <td className="py-3 px-4">{r.className}</td>
                      <td className="py-3 px-4 capitalize">{r.behaviour_type}</td>
                      <td className="py-3 px-4 max-w-xs truncate">{r.description}</td>
                      <td className="py-3 px-4 text-right">{r.points}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
