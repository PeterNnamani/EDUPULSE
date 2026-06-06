import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, LogIn, LogOut, Loader, Search, UserCheck, AlertTriangle, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import {
  dutyAttendanceService,
  DutyAttendanceRow,
  DutyDashboardMetrics,
  DutyRoster,
} from '@/services/dutyAttendanceService';

interface StudentLite {
  id: string;
  name: string;
  className: string;
}

interface StaffLite {
  id: string;
  name: string;
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

export default function DutyAttendancePage() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [records, setRecords] = useState<Record<string, DutyAttendanceRow>>({});
  const [metrics, setMetrics] = useState<DutyDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManageRoster = user?.role === 'admin' || user?.role === 'principal';
  const [staff, setStaff] = useState<StaffLite[]>([]);
  const [roster, setRoster] = useState<DutyRoster[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [teacherDropdownOpen, setTeacherDropdownOpen] = useState(false);
  const teacherDropdownRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: studentRows }, { data: classes }, attendance, m] = await Promise.all([
      supabase
        .from('students')
        .select('id, first_name, last_name, class_id')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('last_name'),
      supabase.from('classes').select('id, name').eq('school_id', schoolId),
      dutyAttendanceService.getAttendanceForDate(schoolId, date),
      dutyAttendanceService.getDashboardMetrics(schoolId, date),
    ]);

    const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));
    setStudents(
      (studentRows ?? []).map((s) => ({
        id: s.id,
        name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
        className: s.class_id ? classMap.get(s.class_id) ?? 'Unassigned' : 'Unassigned',
      }))
    );
    const recMap: Record<string, DutyAttendanceRow> = {};
    for (const r of attendance) recMap[r.student_id] = r;
    setRecords(recMap);
    setMetrics(m);

    const weekStart = dutyAttendanceService.weekStartFor(date);
    const [{ data: staffRows }, rosterRows] = await Promise.all([
      canManageRoster
        ? supabase
            .from('staff')
            .select('id, full_name')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .order('full_name')
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
      dutyAttendanceService.getRosterForWeek(schoolId, weekStart),
    ]);
    setStaff((staffRows ?? []).map((s) => ({ id: s.id, name: s.full_name })));
    setRoster(rosterRows);

    setLoading(false);
  };

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const handleAssignDuty = async () => {
    if (!schoolId || selectedStaffIds.length === 0) return;
    setAssigning(true);
    await dutyAttendanceService.assignDutyTeachers(
      schoolId,
      selectedStaffIds,
      date,
      user?.id,
      undefined
    );
    setSelectedStaffIds([]);
    setTeacherDropdownOpen(false);
    await load();
    setAssigning(false);
  };

  const handleRemoveFromRoster = async (rosterId: string) => {
    await dutyAttendanceService.removeFromRoster(rosterId);
    await load();
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, date]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (teacherDropdownRef.current && !teacherDropdownRef.current.contains(e.target as Node)) {
        setTeacherDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q)
    );
  }, [students, search]);

  const handleArrival = async (studentId: string) => {
    if (!schoolId) return;
    setBusyId(studentId);
    const t = nowTime();
    const isLate = t > '08:00';
    await dutyAttendanceService.recordArrival(schoolId, studentId, date, t, isLate, undefined, user?.id);
    await load();
    setBusyId(null);
  };

  const handleDeparture = async (studentId: string) => {
    if (!schoolId) return;
    setBusyId(studentId);
    const t = nowTime();
    await dutyAttendanceService.recordDeparture(schoolId, studentId, date, t, {
      pickupStatus: 'picked_up',
      recordedBy: user?.id,
    });
    await load();
    setBusyId(null);
  };

  const metricCards = [
    { label: 'Present', value: metrics?.present ?? 0, icon: UserCheck, color: 'text-green-600' },
    { label: 'Late', value: metrics?.lateArrivals ?? 0, icon: Clock, color: 'text-amber-600' },
    { label: 'Departed', value: metrics?.departed ?? 0, icon: LogOut, color: 'text-blue-600' },
    {
      label: 'Missing Pickup',
      value: metrics?.missingPickups ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Teacher-On-Duty Attendance</h1>
          <p className="text-secondary-text">Record student arrival & departure across all classes</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-field max-w-[200px]"
        />
      </div>

      {canManageRoster && (
        <div className="card">
          <h2 className="font-semibold mb-3">Duty Roster (week of {dutyAttendanceService.weekStartFor(date)})</h2>
          <p className="text-sm text-secondary-text mb-3">Select one or more teachers for duty this week.</p>
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div ref={teacherDropdownRef} className="relative flex-1 min-w-[220px] max-w-sm">
              <button
                type="button"
                onClick={() => setTeacherDropdownOpen((open) => !open)}
                className="w-full input-field flex items-center justify-between text-left"
              >
                <span className={selectedStaffIds.length === 0 ? 'text-secondary-text' : ''}>
                  {selectedStaffIds.length === 0
                    ? 'Select teachers...'
                    : staff
                        .filter((s) => selectedStaffIds.includes(s.id))
                        .map((s) => s.name)
                        .join(', ')}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-secondary-text shrink-0 transition-transform ${
                    teacherDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {teacherDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-dark-bg border border-border dark:border-gray-700 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {staff.length === 0 ? (
                    <p className="p-3 text-sm text-secondary-text">No teachers found</p>
                  ) : (
                    staff.map((s) => {
                      const onRoster = roster.some((r) => r.staff_id === s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-secondary-bg dark:hover:bg-dark-card ${
                            onRoster ? 'opacity-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedStaffIds.includes(s.id)}
                            disabled={onRoster}
                            onChange={() => toggleStaffSelection(s.id)}
                            className="w-4 h-4 rounded border-border"
                          />
                          <span className="truncate">
                            {s.name}
                            {onRoster ? ' (on roster)' : ''}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleAssignDuty}
              disabled={assigning || selectedStaffIds.length === 0}
              className="btn-primary disabled:opacity-50 shrink-0"
            >
              {assigning
                ? 'Assigning...'
                : `Assign ${selectedStaffIds.length || ''} teacher${selectedStaffIds.length === 1 ? '' : 's'}`}
            </button>
          </div>
          {roster.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {roster.map((r) => (
                <span
                  key={r.id}
                  className="px-3 py-1 rounded-full bg-secondary-bg text-sm flex items-center gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {r.staff_name || 'Staff'}
                  <button
                    type="button"
                    onClick={() => handleRemoveFromRoster(r.id)}
                    className="ml-1 text-xs text-red-600 hover:underline"
                    title="Remove from roster"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="card">
              <div className="flex items-center gap-3">
                <Icon className={`w-6 h-6 ${c.color}`} />
                <div>
                  <p className="text-2xl font-bold">{c.value}</p>
                  <p className="text-xs text-secondary-text">{c.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-text" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="Search students or classes..."
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-7 h-7 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left rounded-l-lg">Student</th>
                  <th className="px-4 py-3 text-left">Class</th>
                  <th className="px-4 py-3 text-left">Arrival</th>
                  <th className="px-4 py-3 text-left">Departure</th>
                  <th className="px-4 py-3 text-left rounded-r-lg">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const rec = records[s.id];
                  return (
                    <tr key={s.id} className="table-row">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-sm text-secondary-text">{s.className}</td>
                      <td className="px-4 py-3 text-sm">
                        {rec?.arrival_time ? (
                          <span className={rec.is_late ? 'text-amber-600 font-medium' : ''}>
                            {rec.arrival_time}
                            {rec.is_late ? ' (late)' : ''}
                          </span>
                        ) : (
                          <span className="text-secondary-text">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {rec?.departure_time ?? <span className="text-secondary-text">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleArrival(s.id)}
                            disabled={busyId === s.id || !!rec?.arrival_time}
                            className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-40"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            Arrived
                          </button>
                          <button
                            onClick={() => handleDeparture(s.id)}
                            disabled={busyId === s.id || !rec?.arrival_time || !!rec?.departure_time}
                            className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-40"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Departed
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center text-secondary-text py-8">No students found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
