import { Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { NotificationPreviewData } from '@/services/notificationPreviewService';

interface NotificationPreviewBodyProps {
  loading: boolean;
  error: string;
  preview: NotificationPreviewData | null;
  onNavigateAway?: () => void;
  emptyHint?: string;
  /** Compact layout for the side bubble — single column, capped tables */
  variant?: 'default' | 'bubble';
  maxTableRows?: number;
}

export default function NotificationPreviewBody({
  loading,
  error,
  preview,
  onNavigateAway,
  emptyHint,
  variant = 'default',
  maxTableRows = 5,
}: NotificationPreviewBodyProps) {
  const isBubble = variant === 'bubble';

  if (loading) {
    return (
      <div className={`flex justify-center ${isBubble ? 'py-4' : 'py-10'}`}>
        <Loader className={`animate-spin text-blue-600 ${isBubble ? 'w-5 h-5' : 'w-7 h-7'}`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <Link
          to="/admin/teacher-activity"
          onClick={onNavigateAway}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Open Teacher Activity page →
        </Link>
      </div>
    );
  }

  if (!preview) {
    if (emptyHint) {
      return <p className="text-sm text-secondary-text dark:text-dark-muted">{emptyHint}</p>;
    }
    return null;
  }

  const tableRows = preview.tableRows ?? [];
  const visibleTableRows = isBubble ? tableRows.slice(0, maxTableRows) : tableRows;
  const hiddenRowCount = tableRows.length - visibleTableRows.length;

  return (
    <div className={isBubble ? 'space-y-3' : 'space-y-4'}>
      <div>
        <h3
          className={`font-semibold text-gray-900 dark:text-dark-text ${isBubble ? 'text-sm' : 'text-base'}`}
        >
          {preview.title}
        </h3>
        {preview.summary && (
          <p className={`text-secondary-text dark:text-dark-muted mt-1 ${isBubble ? 'text-xs' : 'text-sm'}`}>
            {preview.summary}
          </p>
        )}
      </div>

      {preview.rows.length > 0 && (
        <div className={`grid gap-2 ${isBubble ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 gap-3'}`}>
          {preview.rows.map((row) => (
            <div
              key={row.label}
              className={`rounded-lg bg-secondary-bg dark:bg-dark-elevated border border-border/50 dark:border-dark-border ${
                isBubble ? 'px-2.5 py-2' : 'p-3'
              }`}
            >
              <p className="text-[11px] uppercase tracking-wide text-secondary-text dark:text-dark-muted">
                {row.label}
              </p>
              <p className={`font-medium break-words text-gray-900 dark:text-dark-text ${isBubble ? 'text-xs mt-0.5' : 'text-sm mt-0.5'}`}>
                {row.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {preview.tableHeaders && visibleTableRows.length > 0 && (
        <div className="overflow-x-auto border border-border dark:border-dark-border rounded-lg">
          <table className={`w-full ${isBubble ? 'text-xs' : 'text-sm'}`}>
            <thead>
              <tr className="bg-secondary-bg dark:bg-dark-elevated">
                {preview.tableHeaders.map((h) => (
                  <th
                    key={h}
                    className={`text-left font-semibold text-gray-900 dark:text-dark-text ${isBubble ? 'px-2 py-1.5' : 'px-3 py-2'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleTableRows.map((row, i) => (
                <tr key={i} className="border-t border-border dark:border-dark-border">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`text-gray-800 dark:text-dark-muted ${isBubble ? 'px-2 py-1.5' : 'px-3 py-2'}`}
                    >
                      {preview.tableStatusColumn === j ? (
                        <AttendanceStatusBadge status={cell} compact={isBubble} />
                      ) : (
                        <span className={j === 1 ? 'font-medium text-gray-900 dark:text-dark-text' : ''}>
                          {cell}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {hiddenRowCount > 0 && (
            <p className="text-[11px] text-center text-secondary-text dark:text-dark-muted py-1.5 border-t border-border dark:border-dark-border">
              +{hiddenRowCount} more not shown
            </p>
          )}
        </div>
      )}

      {preview.type === 'attendance_submitted' &&
        (!preview.tableRows || preview.tableRows.length === 0) && (
          <p className="text-sm text-secondary-text dark:text-dark-muted">
            No students were found for this class on the selected date.
          </p>
        )}
    </div>
  );
}

function AttendanceStatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  const normalized = status.toLowerCase();
  const styles: Record<string, string> = {
    present: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    absent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    late: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    excused: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    'not marked': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  const className =
    styles[normalized] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  return (
    <span
      className={`inline-flex rounded-full font-semibold capitalize ${className} ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
    >
      {status}
    </span>
  );
}
