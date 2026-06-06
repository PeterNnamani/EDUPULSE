import { useEffect, useState } from 'react';
import { Landmark, Copy, Check, Loader } from 'lucide-react';
import { monnifyService, type VirtualAccount } from '@/services/monnifyService';

interface Props {
  schoolId: string;
  studentId: string;
  studentName?: string;
  /** Allow admins/finance to provision an account on demand. */
  allowProvision?: boolean;
}

export default function VirtualAccountCard({ schoolId, studentId, studentName, allowProvision }: Props) {
  const [account, setAccount] = useState<VirtualAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schoolId || !studentId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    monnifyService
      .getVirtualAccount(schoolId, studentId)
      .then((acct) => {
        if (active) setAccount(acct);
      })
      .catch(() => {
        if (active) setAccount(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, studentId]);

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

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-6">
        <Loader className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!account?.accountNumber) {
    if (!allowProvision) return null;
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Landmark className="w-5 h-5 text-secondary-text" />
          <h3 className="font-semibold">Virtual Account</h3>
        </div>
        <p className="text-sm text-secondary-text mb-3">
          No dedicated payment account yet{studentName ? ` for ${studentName}` : ''}.
        </p>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <button onClick={handleProvision} disabled={provisioning} className="btn-secondary flex items-center gap-2">
          {provisioning ? <Loader className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
          Generate Virtual Account
        </button>
      </div>
    );
  }

  return (
    <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-900">
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="w-5 h-5 text-emerald-600" />
        <h3 className="font-semibold">Virtual Account</h3>
      </div>
      <p className="text-xs text-secondary-text mb-1">
        Transfer fees to this dedicated account — payments reconcile automatically.
      </p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-secondary-text">Account Number</p>
            <p className="text-2xl font-bold tracking-wider">{account.accountNumber}</p>
          </div>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-white/60 dark:bg-black/20 hover:bg-white transition-colors"
            title="Copy"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <p className="text-xs text-secondary-text">Bank</p>
            <p className="font-medium">{account.bankName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-secondary-text">Account Name</p>
            <p className="font-medium">{account.accountName ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
