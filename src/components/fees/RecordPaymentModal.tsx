import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Check, Loader2, User, AlertCircle } from 'lucide-react';
import {
  fetchStudentsForPayment,
  recordPayment,
  type StudentFeeContext,
} from '@/services/paymentService';

interface RecordPaymentModalProps {
  schoolId: string;
  staffId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordPaymentModal({
  schoolId,
  staffId,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const [students, setStudents] = useState<StudentFeeContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'card'>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchStudentsForPayment(schoolId)
      .then(setStudents)
      .catch(() => setError('Failed to load students.'))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const classes = useMemo(
    () => [...new Set(students.map((s) => s.className))].filter((c) => c !== 'Unassigned').sort(),
    [students]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (classFilter && s.className !== classFilter) return false;
      if (!q) return true;
      return (
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
      );
    });
  }, [students, search, classFilter]);

  const selected = students.find((s) => s.id === selectedId);

  useEffect(() => {
    if (selected && !amount) {
      const suggested = selected.balance > 0 ? selected.balance : selected.expectedFee;
      if (suggested > 0) setAmount(String(suggested));
    }
  }, [selectedId]);

  const handleSubmit = async () => {
    if (!selected) {
      setError('Select a student from the list first.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Enter a valid payment amount.');
      return;
    }

    setSaving(true);
    setError('');
    const result = await recordPayment({
      schoolId,
      studentId: selected.id,
      amount: parsedAmount,
      paymentMethod,
      paymentReference: reference,
      notes,
      recordedByStaffId: staffId,
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Payment could not be saved.');
      return;
    }

    setSuccess(`Payment recorded. Receipt: ${result.receiptNumber}`);
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-dark-bg rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        <div className="p-5 border-b border-border dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Record payment</h2>
            <p className="text-sm text-secondary-text mt-0.5">
              Select a student, then enter payment details — avoids recording for the wrong child.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-secondary-bg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 text-sm">
            {success}
          </div>
        )}

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 min-h-0 overflow-hidden">
          {/* Student list */}
          <div className="lg:col-span-3 flex flex-col border-r border-border dark:border-gray-800 min-h-0">
            <div className="p-4 flex flex-col sm:flex-row gap-2 border-b border-border dark:border-gray-800">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
                <input
                  className="input-field pl-9 w-full"
                  placeholder="Search name or ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="input-field sm:w-36"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-secondary-bg/80 dark:bg-dark-card/80 backdrop-blur">
                    <tr>
                      <th className="text-left py-2 px-4 font-semibold">Student</th>
                      <th className="text-left py-2 px-4">Class</th>
                      <th className="text-right py-2 px-4">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedId(s.id)}
                        className={`cursor-pointer border-t border-border dark:border-gray-800 transition-colors ${
                          selectedId === s.id
                            ? 'bg-blue-50 dark:bg-blue-900/30'
                            : 'hover:bg-secondary-bg/50'
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <p className="font-medium">
                            {s.firstName} {s.lastName}
                          </p>
                          <p className="text-xs text-secondary-text font-mono">{s.studentId}</p>
                        </td>
                        <td className="py-2.5 px-4">{s.className}</td>
                        <td className="py-2.5 px-4 text-right font-medium">
                          {s.expectedFee > 0 ? `₦${s.balance.toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <p className="text-xs text-secondary-text px-4 py-2 border-t border-border dark:border-gray-800">
              {filtered.length} students · click a row to select
            </p>
          </div>

          {/* Payment form */}
          <div className="lg:col-span-2 p-5 flex flex-col gap-4 overflow-y-auto">
            {selected ? (
              <>
                <div className="p-4 rounded-xl bg-secondary-bg dark:bg-dark-card border border-border dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {selected.firstName} {selected.lastName}
                      </p>
                      <p className="text-xs text-secondary-text">
                        {selected.studentId} · {selected.className}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                    <div>
                      <p className="font-bold">₦{selected.expectedFee.toLocaleString()}</p>
                      <p className="text-secondary-text">Expected</p>
                    </div>
                    <div>
                      <p className="font-bold text-green-600">₦{selected.totalPaid.toLocaleString()}</p>
                      <p className="text-secondary-text">Paid</p>
                    </div>
                    <div>
                      <p className="font-bold text-red-600">₦{selected.balance.toLocaleString()}</p>
                      <p className="text-secondary-text">Balance</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label mb-1.5 block">Amount (NGN) *</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field w-full"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Payment method *</label>
                  <select
                    className="input-field w-full"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5 block">Reference</label>
                  <input
                    className="input-field w-full"
                    placeholder="Transaction / teller ref."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Notes</label>
                  <textarea
                    className="input-field w-full min-h-[72px]"
                    placeholder="Optional"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-secondary-text text-sm px-4">
                <p>Select a student from the list on the left to record their payment.</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-border dark:border-gray-800 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !selected}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
