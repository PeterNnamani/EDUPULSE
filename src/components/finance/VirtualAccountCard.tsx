import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, Loader, CreditCard, Wallet, Lock } from 'lucide-react';
import {
  monnifyService,
  type MonnifySetupStatus,
  type VirtualAccount,
} from '@/services/monnifyService';
import { feeAssignmentService, type StudentFeeStatus } from '@/services/feeAssignmentService';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import VirtualAccountSummary from '@/components/finance/VirtualAccountSummary';

interface Props {
  schoolId: string;
  studentId: string;
  classId?: string | null;
  studentName?: string;
  allowProvision?: boolean;
  /** When true, creates a virtual account automatically if none exists in the DB. */
  autoProvision?: boolean;
  /** Simpler layout for admin edit modals. */
  variant?: 'default' | 'admin';
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
  autoProvision = false,
  variant = 'default',
  embedded = false,
  className = '',
}: Props) {
  const { hasFeature, resolved: planResolved, plan } = useFeatureAccess();
  const virtualAccountsEnabled = planResolved && hasFeature('virtual_accounts');
  const isAdmin = variant === 'admin';

  const [account, setAccount] = useState<VirtualAccount | null>(null);
  const [amountDue, setAmountDue] = useState(0);
  const [feeStatus, setFeeStatus] = useState<StudentFeeStatus>('no_fee');
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [monnifySetup, setMonnifySetup] = useState<MonnifySetupStatus | null>(null);
  const [autoProvisionAttempted, setAutoProvisionAttempted] = useState(false);

  const childFullName = studentName?.trim() || account?.accountName?.trim() || '—';
  const canUseVirtualAccounts = virtualAccountsEnabled;
  const monnifyReady = monnifySetup?.state === 'ready';
  const canProvision = canUseVirtualAccounts && monnifyReady && !!allowProvision;

  const wrapClass = embedded
    ? `w-full ${className}`
    : isAdmin
      ? `w-full ${className}`
      : `w-full max-w-[400px] mx-auto ${className}`;

  const handleProvision = useCallback(async () => {
    if (!canProvision) return false;
    setProvisioning(true);
    setProvisionError(null);
    const res = await monnifyService.ensureVirtualAccount(schoolId, studentId);
    setProvisioning(false);
    if (res.success && res.account?.accountNumber) {
      const fullName = studentName?.trim();
      setAccount({
        ...res.account,
        accountName: fullName || res.account.accountName,
      });
      return true;
    }
    setProvisionError(res.error ?? 'Failed to generate virtual account.');
    return false;
  }, [canProvision, schoolId, studentId, studentName]);

  const refreshMonnifySetup = useCallback(() => {
    if (!schoolId || !virtualAccountsEnabled) {
      setMonnifySetup(virtualAccountsEnabled ? null : { state: 'not_saved' });
      return;
    }
    void monnifyService.getSetupStatus(schoolId).then(setMonnifySetup);
  }, [schoolId, virtualAccountsEnabled]);

  useEffect(() => {
    if (!schoolId || !planResolved) return;
    if (!virtualAccountsEnabled) {
      setMonnifySetup({ state: 'not_saved' });
      return;
    }
    refreshMonnifySetup();
  }, [schoolId, planResolved, virtualAccountsEnabled, refreshMonnifySetup]);

  useEffect(() => {
    const onConfigUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ schoolId?: string }>).detail;
      if (!detail?.schoolId || detail.schoolId === schoolId) {
        refreshMonnifySetup();
      }
    };
    const onFocus = () => refreshMonnifySetup();
    window.addEventListener('monnify-config-updated', onConfigUpdated);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('monnify-config-updated', onConfigUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [schoolId, refreshMonnifySetup]);

  useEffect(() => {
    setAutoProvisionAttempted(false);
    setProvisionError(null);
    setAccount(null);
  }, [schoolId, studentId]);

  useEffect(() => {
    if (!schoolId || !studentId) {
      setLoading(false);
      return;
    }
    if (!planResolved) {
      setLoading(true);
      return;
    }
    if (!virtualAccountsEnabled) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const load = async () => {
      const [acct, feeSummary] = await Promise.all([
        monnifyService.getVirtualAccount(schoolId, studentId),
        isAdmin
          ? Promise.resolve(null)
          : feeAssignmentService
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
    };

    void load();
    return () => {
      active = false;
    };
  }, [
    schoolId,
    studentId,
    classId,
    planResolved,
    virtualAccountsEnabled,
    isAdmin,
  ]);

  useEffect(() => {
    if (
      !autoProvision ||
      !canProvision ||
      loading ||
      provisioning ||
      autoProvisionAttempted ||
      account?.accountNumber
    ) {
      return;
    }
    setAutoProvisionAttempted(true);
    void handleProvision();
  }, [
    autoProvision,
    canProvision,
    loading,
    provisioning,
    autoProvisionAttempted,
    account?.accountNumber,
    handleProvision,
  ]);

  const handleCopy = () => {
    if (account?.accountNumber) {
      navigator.clipboard.writeText(account.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading || !planResolved) {
    return (
      <div className={wrapClass}>
        <div
          className={`rounded-xl flex items-center justify-center gap-2 text-secondary-text ${
            isAdmin
              ? 'border border-border dark:border-gray-800 py-6'
              : `bg-gradient-to-br from-slate-800 to-emerald-900 animate-pulse text-white/60 ${
                  embedded ? 'min-h-[140px]' : 'min-h-[200px]'
                }`
          }`}
        >
          <Loader className="w-5 h-5 animate-spin" />
          {isAdmin && <span className="text-sm">Loading virtual account…</span>}
        </div>
      </div>
    );
  }

  if (!canUseVirtualAccounts) {
    if (!allowProvision) return null;
    return (
      <div className={`${wrapClass} card border border-border dark:border-gray-800`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-secondary-text" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium mb-1">Virtual accounts locked</p>
            <p className="text-sm text-secondary-text mb-3">
              Student virtual accounts are available on the Enterprise plan. Your school is on{' '}
              {plan.name}.
            </p>
            <Link to="/admin/subscriptions" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View subscription plans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (account?.accountNumber) {
    if (isAdmin) {
      return (
        <div className={wrapClass}>
          <VirtualAccountSummary
            bankName={account.bankName}
            accountNumber={account.accountNumber}
            accountName={childFullName}
          />
        </div>
      );
    }
  } else if (!allowProvision) {
    return null;
  }

  if (!account?.accountNumber) {
    if (monnifySetup === null) {
      return (
        <div className={`${wrapClass} card flex items-center justify-center py-8 gap-2`}>
          <Loader className="w-5 h-5 animate-spin text-secondary-text" />
          {isAdmin && <span className="text-sm text-secondary-text">Checking Monnify…</span>}
        </div>
      );
    }

    if (monnifySetup.state !== 'ready') {
      const setupMessage =
        monnifySetup.state === 'disabled'
          ? `Monnify is saved but not enabled. Turn on "Enable Monnify" in Settings → Payments${
              childFullName !== '—' ? ` before generating an account for ${childFullName}` : ''
            }.`
          : monnifySetup.state === 'incomplete' || monnifySetup.state === 'unreadable'
            ? monnifySetup.message
            : `Add your Monnify API keys in Settings → Payments${
                childFullName !== '—' ? ` before generating an account for ${childFullName}` : ''
              }.`;

      const setupTitle =
        monnifySetup.state === 'disabled'
          ? 'Enable Monnify'
          : monnifySetup.state === 'not_saved'
            ? 'Monnify not configured'
            : 'Monnify setup incomplete';

      return (
        <div className={`${wrapClass} card border border-border dark:border-gray-800`}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary-bg dark:bg-dark-card flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-secondary-text" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium mb-1">{setupTitle}</p>
              <p className="text-sm text-secondary-text mb-3">{setupMessage}</p>
              <Link to="/settings" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                Open payment settings
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`${wrapClass} ${isAdmin ? '' : 'card'}`}>
        {isAdmin ? (
          <div className="rounded-xl border border-dashed border-border dark:border-gray-700 p-4">
            <p className="text-sm font-medium mb-1">Virtual account</p>
            <p className="text-sm text-secondary-text mb-3">
              {provisioning || (autoProvision && !autoProvisionAttempted)
                ? 'Generating virtual account…'
                : `No payment account yet${childFullName !== '—' ? ` for ${childFullName}` : ''}.`}
            </p>
            {(provisioning || (autoProvision && !provisionError && !autoProvisionAttempted)) && (
              <div className="flex items-center gap-2 text-sm text-secondary-text">
                <Loader className="w-4 h-4 animate-spin" />
                Creating account with Monnify…
              </div>
            )}
            {!autoProvision && !provisioning && (
              <button
                type="button"
                onClick={() => void handleProvision()}
                disabled={provisioning || !canProvision}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                Generate Virtual Account
              </button>
            )}
            {provisionError && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">{provisionError}</p>
            )}
            {provisionError && (
              <button
                type="button"
                onClick={() => {
                  setAutoProvisionAttempted(false);
                  void handleProvision();
                }}
                className="btn-secondary text-xs mt-2"
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-secondary-text mb-3">
              {provisioning
                ? 'Generating virtual account…'
                : `No payment account yet${childFullName !== '—' ? ` for ${childFullName}` : ''}.`}
            </p>
            {provisioning ? (
              <div className="flex items-center gap-2 text-sm text-secondary-text">
                <Loader className="w-4 h-4 animate-spin" />
                Creating account…
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleProvision()}
                disabled={provisioning || !canProvision}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                Generate Virtual Account
              </button>
            )}
            {provisionError && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">{provisionError}</p>
            )}
          </>
        )}
      </div>
    );
  }

  const isPaid = feeStatus === 'paid' || (amountDue <= 0 && feeStatus !== 'unpaid' && feeStatus !== 'partial');
  const showAmount = feeStatus !== 'no_fee';

  if (embedded) {
    return (
      <div className={wrapClass}>
        <div className="relative overflow-hidden rounded-xl border border-emerald-700/40 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white w-full shadow-lg">
          <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />

          <div className="relative p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-200" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-widest text-emerald-200/60 leading-none">
                    Pay school fees
                  </p>
                  <p className="text-xs font-medium text-white/90 truncate" title={account.bankName ?? undefined}>
                    {account.bankName ?? 'Virtual account'}
                  </p>
                </div>
              </div>
              <span
                className={`text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
                  isPaid ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-100'
                }`}
              >
                {feeStatusLabel(feeStatus, amountDue)}
              </span>
            </div>

            <div className="flex items-end justify-between gap-3 rounded-lg bg-black/20 border border-white/5 px-2.5 py-2">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-wider text-emerald-200/60 flex items-center gap-0.5">
                  <Wallet className="w-2.5 h-2.5" />
                  Amount
                </p>
                <p className="text-lg font-bold tabular-nums leading-tight text-white">
                  {showAmount ? (isPaid ? formatNaira(0) : formatNaira(amountDue)) : '—'}
                </p>
              </div>
              <div className="text-right min-w-0 max-w-[48%]">
                <p className="text-[9px] uppercase tracking-wider text-emerald-200/60">Account name</p>
                <p className="text-xs font-medium text-white/95 truncate" title={childFullName}>
                  {childFullName}
                </p>
              </div>
            </div>

            <div className="pt-1.5 border-t border-white/10">
              <p className="text-[9px] uppercase tracking-wider text-emerald-200/60 mb-1">Account number</p>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-sm font-semibold tabular-nums text-white truncate flex-1 min-w-0">
                  {account.accountNumber}
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded bg-white/10 hover:bg-white/20 border border-white/10 shrink-0 transition-colors"
                  title="Copy account number"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                </button>
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
              <p className="text-sm font-medium text-white/95 break-words">{childFullName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
