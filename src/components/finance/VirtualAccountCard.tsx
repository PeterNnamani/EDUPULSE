import { useEffect, useState } from 'react';
import { Copy, Check, Loader, CreditCard, Wallet } from 'lucide-react';
import { monnifyService, type VirtualAccount } from '@/services/monnifyService';
import { feeAssignmentService, type StudentFeeStatus } from '@/services/feeAssignmentService';

interface Props {
  schoolId: string;
  studentId: string;
  /** Known class id (e.g. from parent login) — used for fee lookup without students RLS. */
  classId?: string | null;
  /** Full child name — shown on the card and synced to Monnify. */
  studentName?: string;
  allowProvision?: boolean;
  /** Compact card for the parent dashboard hero (right column). */
  embedded?: boolean;
  className?: string;
}

function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

function feeStatusLabel(status: StudentFeeStatus, balance: number): string {
  if (status === 'paid' || balance <= 0) return 'Fully paid';
  if (status === 'partial') return 'Partial payment';
  if (status === 'unpaid') return 'Payment due';
  return 'No fee assigned';
}

export default function VirtualAccountCard({
  schoolId,
  studentId,
  classId,
  studentName,
  allowProvision,
  embedded = false,
  className = '',
}: Props) {
  const [account, setAccount] = useState<VirtualAccount | null>(null);
  const [amountDue, setAmountDue] = useState(0);
  const [feeStatus, setFeeStatus] = useState<StudentFeeStatus>('no_fee');
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const displayName = studentName?.trim() || account?.accountName?.trim() || '—';

  useEffect(() => {
    if (!schoolId || !studentId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    const load = async () => {
      const [acct, feeSummary] = await Promise.all([
        monnifyService.getVirtualAccount(schoolId, studentId),
        feeAssignmentService
          .getStudentFeeSummary(schoolId, studentId, { classId })
          .catch(() => null),
      ]);

      if (!active) return;
      setAccount(acct);
      if (feeSummary) {
        setAmountDue(Math.max(0, feeSummary.balance));
        setFeeStatus(feeSummary.status);
      }
      setLoading(false);

      void monnifyService.syncVirtualAccountName(schoolId, studentId).then(async () => {
        if (!active) return;
        const refreshed = await monnifyService.getVirtualAccount(schoolId, studentId);
        if (refreshed && active) setAccount(refreshed);
      });
    };

    void load();
    return () => {
      active = false;
    };
  }, [schoolId, studentId, classId, studentName]);

  const handleProvision = async () => {
    setProvisioning(true);
    setError('');
    const res = await monnifyService.ensureVirtualAccount(schoolId, studentId);
    setProvisioning(false);
    if (res.success && res.account) {
      setAccount(res.account);
    } else {
      setError(res.error || 'Could not create virtual account. Check Monnify settings.');
    }
  };

  const handleCopy = () => {
    if (account?.accountNumber) {
      navigator.clipboard.writeText(account.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const wrapClass = embedded
    ? `w-full h-full ${className}`
    : `w-full max-w-[400px] mx-auto ${className}`;

  if (loading) {
    return (
      <div className={wrapClass}>
        <div
          className={`rounded-xl bg-gradient-to-br from-slate-800 to-emerald-900 animate-pulse flex items-center justify-center ${
            embedded ? 'h-full' : 'min-h-[200px]'
          }`}
        >
          <Loader className="w-5 h-5 text-white/60 animate-spin" />
        </div>
      </div>
    );
  }

  if (!account?.accountNumber) {
    if (!allowProvision) return null;
    return (
      <div className={`${wrapClass} card`}>
        <p className="text-sm text-secondary-text mb-3">
          No payment account yet{displayName !== '—' ? ` for ${displayName}` : ''}.
        </p>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <button onClick={handleProvision} disabled={provisioning} className="btn-secondary flex items-center gap-2 text-sm">
          {provisioning ? <Loader className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          Generate Virtual Account
        </button>
      </div>
    );
  }

  const isPaid = feeStatus === 'paid' || (amountDue <= 0 && feeStatus !== 'unpaid' && feeStatus !== 'partial');
  const showAmount = feeStatus !== 'no_fee';

  if (embedded) {
    return (
      <div className={wrapClass}>
        <div className="relative overflow-hidden rounded-xl border border-emerald-700/50 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white w-full h-full shadow-lg flex flex-col justify-end">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />
          <div className="absolute top-3 left-4 right-4">
            <p className="text-[9px] uppercase tracking-widest text-emerald-200/50">Pay school fees</p>
            <p className="text-[11px] font-medium text-white/70 truncate">{account.bankName ?? 'Virtual account'}</p>
          </div>

          <div className="relative px-4 pb-3 pt-2 flex flex-col gap-2.5">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 shrink-0 rounded-full bg-white/15 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-emerald-200" />
                </div>
                <div className="min-w-0 lg:hidden">
                  <p className="text-[8px] uppercase tracking-wider text-emerald-200/60">Bank</p>
                  <p className="text-xs font-medium truncate">{account.bankName ?? 'Virtual account'}</p>
                </div>
              </div>
              <div className="text-right shrink-0 min-w-[88px]">
                <p className="text-[8px] uppercase tracking-wider text-emerald-200/60 flex items-center justify-end gap-0.5">
                  <Wallet className="w-2.5 h-2.5" /> Amount to pay
                </p>
                <p className="text-base font-bold tabular-nums leading-tight text-white">
                  {showAmount
                    ? isPaid
                      ? formatNaira(0)
                      : formatNaira(amountDue)
                    : '—'}
                </p>
                <p className={`text-[8px] font-semibold uppercase ${isPaid ? 'text-emerald-300' : 'text-amber-200'}`}>
                  {feeStatusLabel(feeStatus, amountDue)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <div className="min-w-0">
                <p className="text-[8px] uppercase tracking-wider text-emerald-200/60 mb-0.5">Virtual account no.</p>
                <div className="flex items-center gap-1 min-w-0">
                  <p className="text-sm font-semibold tabular-nums truncate">{account.accountNumber}</p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 rounded bg-white/10 hover:bg-white/20 border border-white/10 shrink-0"
                    title="Copy account number"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="min-w-0 border-l border-white/10 pl-3">
                <p className="text-[8px] uppercase tracking-wider text-emerald-200/60 mb-0.5">Account name</p>
                <p className="text-sm font-medium text-white/95 truncate" title={displayName}>
                  {displayName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <div className="relative overflow-hidden rounded-2xl border border-emerald-700/50 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white shadow-lg min-h-[200px]">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />

        <div className="relative p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-7 rounded bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-amber-900/80" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-emerald-200/70">Pay school fees</p>
                <p className="text-sm font-medium text-white/90">{account.bankName ?? 'Virtual account'}</p>
              </div>
            </div>
            <span
              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                isPaid ? 'bg-emerald-500/25 text-emerald-100' : 'bg-amber-500/25 text-amber-100'
              }`}
            >
              {feeStatusLabel(feeStatus, amountDue)}
            </span>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-200/60 flex items-center gap-1 mb-1">
              <Wallet className="w-3.5 h-3.5" /> Amount to pay
            </p>
            <p className="text-2xl font-bold tabular-nums text-white">
              {showAmount
                ? isPaid
                  ? formatNaira(0)
                  : formatNaira(amountDue)
                : '—'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/10">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-200/60 mb-1">Virtual account no.</p>
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold tracking-wide tabular-nums">{account.accountNumber}</p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10"
                  title="Copy account number"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="sm:border-l sm:border-white/10 sm:pl-4">
              <p className="text-[10px] uppercase tracking-wider text-emerald-200/60 mb-1">Account name</p>
              <p className="text-sm font-medium text-white/95 break-words">{displayName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
