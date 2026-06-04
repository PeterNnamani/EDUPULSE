import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useAppStore } from '@/store';
import { getClasses } from '@/services/classService';
import { supabase } from '@/lib/supabase';

interface DaySummary {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  rate: number;
}

interface ClassSummary {
  className: string;
  rate: number;
  present: number;
  total: number;
}

export default function PrincipalAttendanceOverview() {
  const { user } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);
  const [weekTrend, setWeekTrend] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.schoolId) return;
    loadAttendance();
  }, [user?.schoolId, selectedDate]);

  const loadAttendance = async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      const schoolId = user.schoolId;
      const classList = await getClasses(schoolId);
      const classMap = new Map(classList.map((c) => [c.id, c.name]));

      const { data: dayRows } = await supabase
        .from('attendance')
        .select('status, class_id, date')
        .eq('school_id', schoolId)
        .eq('date', selectedDate);

      const present = dayRows?.filter((r) => r.status === 'present').length ?? 0;
      const late = dayRows?.filter((r) => r.status === 'late').length ?? 0;
      const absent = dayRows?.filter((r) => r.status === 'absent').length ?? 0;
      const total = dayRows?.length ?? 0;
      const rate = total ? Math.round(((present + late) / total) * 100) : 0;

      setDaySummary({
        date: selectedDate,
        present: present + late,
        absent,
        late,
        total,
        rate,
      });

      const byClass = new Map<string, { present: number; total: number }>();
      dayRows?.forEach((r) => {
        if (!r.class_id) return;
        const cur = byClass.get(r.class_id) ?? { present: 0, total: 0 };
        cur.total += 1;
        if (r.status === 'present' || r.status === 'late') cur.present += 1;
        byClass.set(r.class_id, cur);
      });

      setClassSummaries(
        Array.from(byClass.entries())
          .map(([id, v]) => ({
            className: classMap.get(id) ?? 'Unknown',
            rate: v.total ? Math.round((v.present / v.total) * 100) : 0,
            present: v.present,
            total: v.total,
          }))
          .sort((a, b) => b.rate - a.rate)
      );

      const week: DaySummary[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(selectedDate), i), 'yyyy-MM-dd');
        const { data: rows } = await supabase
          .from('attendance')
          .select('status')
          .eq('school_id', schoolId)
          .eq('date', d);

        const t = rows?.length ?? 0;
        const p = rows?.filter((r) => r.status === 'present' || r.status === 'late').length ?? 0;
        week.push({
          date: d,
          present: p,
          absent: rows?.filter((r) => r.status === 'absent').length ?? 0,
          late: rows?.filter((r) => r.status === 'late').length ?? 0,
          total: t,
          rate: t ? Math.round((p / t) * 100) : 0,
        });
      }
      setWeekTrend(week);
    } catch (e) {
      console.error('[Principal] Attendance load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-7 h-7" />
            Attendance
          </h1>
          <p className="text-secondary-text">School-wide attendance — view only</p>
        </div>
        <input
          type="date"
          className="input-field w-auto"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Attendance rate" value={`${daySummary?.rate ?? 0}%`} />
            <StatCard label="Present / late" value={String(daySummary?.present ?? 0)} />
            <StatCard label="Absent" value={String(daySummary?.absent ?? 0)} />
            <StatCard label="Records" value={String(daySummary?.total ?? 0)} />
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <h2 className="font-semibold mb-4">Last 7 days</h2>
            <div className="flex items-end gap-2 h-32">
              {weekTrend.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-black dark:bg-white rounded-t transition-all min-h-[4px]"
                    style={{ height: `${Math.max(4, d.rate)}%` }}
                    title={`${d.rate}%`}
                  />
                  <span className="text-[10px] text-secondary-text">
                    {format(new Date(d.date), 'EEE')}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
            <h2 className="font-semibold mb-4">By class — {format(new Date(selectedDate), 'PPP')}</h2>
            {classSummaries.length === 0 ? (
              <p className="text-sm text-secondary-text py-8 text-center">
                No attendance marked for this date.
              </p>
            ) : (
              <div className="space-y-3">
                {classSummaries.map((c) => (
                  <div key={c.className} className="flex items-center gap-4">
                    <p className="w-28 font-medium truncate">{c.className}</p>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full"
                        style={{ width: `${c.rate}%` }}
                      />
                    </div>
                    <span className="text-sm w-24 text-right">
                      {c.rate}% ({c.present}/{c.total})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-secondary-text mt-1">{label}</p>
    </div>
  );
}
