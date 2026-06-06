import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Loader, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store';
import { auditService, AuditLogRow } from '@/services/auditService';
import { formatDateTime } from '@/utils/displayUtils';

const ACTION_LABELS: Record<string, string> = {
  payment_recorded: 'Payment recorded',
  payment_confirmed: 'Payment confirmed',
  fee_changed: 'Fee changed',
  fee_structure_changed: 'Fee structure changed',
  student_registered: 'Student registered',
  student_promoted: 'Student promoted',
  student_graduated: 'Student graduated',
  student_transferred: 'Student transferred',
  student_class_changed: 'Student class changed',
  attendance_edited: 'Attendance edited',
  result_uploaded: 'Results uploaded',
  subscription_changed: 'Subscription changed',
  virtual_account_created: 'Virtual account created',
  reconciliation_run: 'Reconciliation run',
};

export default function AuditLogPage() {
  const { user } = useAppStore();
  const schoolId = user?.schoolId;
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await auditService.getAuditLogs(schoolId, {
      action: filter || undefined,
      limit: 200,
    });
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Audit & Compliance</h1>
          <p className="text-secondary-text">Every critical action, logged and traceable</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-field"
          >
            <option value="">All actions</option>
            {Object.keys(ACTION_LABELS).map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]}
              </option>
            ))}
          </select>
          <button onClick={() => void load()} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-7 h-7 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-12 h-12 text-secondary-text mx-auto mb-3 opacity-50" />
            <p className="text-secondary-text">No audit records yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left rounded-l-lg">Action</th>
                  <th className="px-4 py-3 text-left">Entity</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left rounded-r-lg">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="table-row">
                    <td className="px-4 py-3 font-medium">
                      {ACTION_LABELS[log.action] || log.action}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-text">
                      {log.entity_type || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-text">
                      {log.user_type || 'system'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
