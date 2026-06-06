import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, TrendingUp, AlertTriangle, Wallet, Loader, FileWarning } from 'lucide-react';
import { useAppStore } from '@/store';
import {
  reconciliationService,
  type ReconciliationSummary,
  type OutstandingRow,
} from '@/services/reconciliationService';

function naira(n: number) {
  return `₦${Math.round(n).toLocaleString()}`;
}

export default function ReconciliationPage() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;

  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    const [s, o] = await Promise.all([
      reconciliationService.buildSummary(schoolId),
      reconciliationService.getOutstandingReport(schoolId),
    ]);
    setSummary(s);
    setOutstanding(o);
    setLoading(false);
  };

  useEffect(() => {
    if (schoolId) void load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const handleRunDaily = async () => {
    if (!schoolId) return;
    setRunning(true);
    const s = await reconciliationService.runDailyReconciliation(schoolId);
    setSummary(s);
    setRunning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const cards = [
    { label: 'Expected', value: summary?.expected ?? 0, icon: Wallet, color: 'text-blue-600' },
    { label: 'Received', value: summary?.received ?? 0, icon: TrendingUp, color: 'text-emerald-600' },
    { label: 'Outstanding', value: summary?.outstanding ?? 0, icon: FileWarning, color: 'text-amber-600' },
    { label: 'Overpaid', value: summary?.overpaid ?? 0, icon: AlertTriangle, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payment Reconciliation</h1>
          <p className="text-secondary-text">Expected vs received fees, anomalies and outstanding balances</p>
        </div>
        <button onClick={handleRunDaily} disabled={running} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {running ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Daily Reconciliation
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
              <div className="flex items-center justify-between">
                <p className="text-sm text-secondary-text">{c.label}</p>
                <Icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <p className="text-2xl font-bold mt-2">{naira(c.value)}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Collection Rate</h2>
          <span className="text-2xl font-bold">{summary?.collectionRate ?? 0}%</span>
        </div>
        <div className="w-full bg-secondary-bg dark:bg-dark-card rounded-full h-3 mt-3">
          <div
            className="bg-emerald-500 h-3 rounded-full transition-all"
            style={{ width: `${Math.min(100, summary?.collectionRate ?? 0)}%` }}
          />
        </div>
      </div>

      {summary && summary.anomalies.length > 0 && (
        <div className="card border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold">Anomalies ({summary.anomalies.length})</h2>
          </div>
          <div className="space-y-2">
            {summary.anomalies.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-white/60 dark:bg-black/20">
                <span>
                  <strong>{a.studentName}</strong> — {a.detail}
                </span>
                <span className="font-semibold">{naira(a.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-4">Outstanding Balances ({outstanding.length})</h2>
        {outstanding.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left rounded-l-lg">Student</th>
                  <th className="px-4 py-3 text-left">Class</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right rounded-r-lg">Balance</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((r) => (
                  <tr key={r.studentId} className="table-row">
                    <td className="px-4 py-3 font-medium">{r.studentName}</td>
                    <td className="px-4 py-3">{r.className}</td>
                    <td className="px-4 py-3 text-right">{naira(r.totalDue)}</td>
                    <td className="px-4 py-3 text-right">{naira(r.totalPaid)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600">{naira(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-secondary-text py-8">No outstanding balances. All fees collected.</p>
        )}
      </div>
    </div>
  );
}
