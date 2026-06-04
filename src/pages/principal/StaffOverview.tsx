import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, GraduationCap, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { supabase } from '@/lib/supabase';

interface StaffRow {
  id: string;
  staff_id: string;
  full_name: string;
  role: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

export default function PrincipalStaffOverview() {
  const { user } = useAppStore();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    if (!user?.schoolId) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('staff')
          .select('id, staff_id, full_name, role, email, phone, is_active')
          .eq('school_id', user.schoolId)
          .order('full_name');

        if (error) throw error;
        setRows(data ?? []);
      } catch (e) {
        console.error('[Principal] Staff load failed:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.schoolId]);

  const roles = useMemo(() => [...new Set(rows.map((r) => r.role))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (roleFilter && s.role !== roleFilter) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.staff_id.toLowerCase().includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, search, roleFilter]);

  const activeCount = rows.filter((r) => r.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="w-7 h-7" />
          Staff
        </h1>
        <p className="text-secondary-text">
          {activeCount} active of {rows.length} staff members — view only
        </p>
      </div>

      <div className="card flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
          <input
            className="input-field pl-10 w-full"
            placeholder="Search staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field sm:w-44"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
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
                <tr className="border-b border-border dark:border-gray-800 bg-secondary-bg/50 dark:bg-dark-card/50">
                  <th className="text-left py-3 px-4 font-semibold">Staff ID</th>
                  <th className="text-left py-3 px-4 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Role</th>
                  <th className="text-left py-3 px-4 font-semibold">Contact</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-secondary-text">
                      No staff match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-border dark:border-gray-800 hover:bg-secondary-bg/30"
                    >
                      <td className="py-3 px-4 font-mono text-xs">{s.staff_id}</td>
                      <td className="py-3 px-4 font-medium">{s.full_name}</td>
                      <td className="py-3 px-4 capitalize">{s.role}</td>
                      <td className="py-3 px-4 text-secondary-text">
                        {s.email || s.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            s.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
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
