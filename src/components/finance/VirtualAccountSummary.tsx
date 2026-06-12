import { useState } from 'react';
import { Copy, Check, CreditCard, Building2 } from 'lucide-react';

interface VirtualAccountSummaryProps {
  bankName?: string | null;
  accountNumber: string;
  accountName: string;
  className?: string;
}

export default function VirtualAccountSummary({
  bankName,
  accountNumber,
  accountName,
  className = '',
}: VirtualAccountSummaryProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-emerald-700/35 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-900 text-white shadow-md ${className}`}
    >
      <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />

      <div className="relative p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 border border-white/10">
              <CreditCard className="h-4 w-4 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-200/70">
                Virtual account
              </p>
              <p className="text-sm font-medium text-white/95 truncate" title={bankName ?? undefined}>
                {bankName ?? 'Bank transfer'}
              </p>
            </div>
          </div>
          {bankName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-emerald-100 shrink-0">
              <Building2 className="h-3 w-3" />
              Active
            </span>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-200/60 mb-1">Account number</p>
          <div className="flex items-center gap-2">
            <p className="flex-1 font-mono text-lg font-bold tracking-wide tabular-nums">{accountNumber}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-lg border border-white/10 bg-white/10 p-2 hover:bg-white/20 transition-colors"
              title="Copy account number"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-300" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 pt-2.5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-200/60 mb-0.5">Account name</p>
          <p className="text-sm font-medium text-white/95 break-words">{accountName}</p>
        </div>
      </div>
    </div>
  );
}
