/**
 * Display helpers that are safe against null/undefined database values.
 * These prevent the most common runtime crashes (indexing into null names,
 * NaN numbers, Invalid Date) and keep the UI consistent.
 */

/** Initials from first/last name, safe against null/undefined. */
export function getInitials(first?: string | null, last?: string | null): string {
  const a = (first ?? '').trim();
  const b = (last ?? '').trim();
  const initials = `${a.charAt(0)}${b.charAt(0)}`.toUpperCase();
  return initials || '?';
}

/** Initials from a single full-name string, safe against null/undefined. */
export function getInitialsFromName(fullName?: string | null): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return `${first}${last}`.toUpperCase() || '?';
}

/** Full name from parts, with a fallback for missing data. */
export function safeFullName(first?: string | null, last?: string | null, fallback = 'Unknown'): string {
  const name = `${first ?? ''} ${last ?? ''}`.trim();
  return name || fallback;
}

/** Format a number safely; returns `fallback` for null/undefined/NaN. */
export function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Locale-formatted number, safe against null/undefined/NaN. */
export function formatNumber(value: unknown, fallback = '0'): string {
  const n = safeNumber(value, NaN);
  return Number.isFinite(n) ? n.toLocaleString() : fallback;
}

/** Naira currency formatting, safe against bad values. */
export function formatNaira(value: unknown, fallback = '₦0'): string {
  const n = safeNumber(value, NaN);
  return Number.isFinite(n) ? `₦${Math.round(n).toLocaleString()}` : fallback;
}

/** Format a date string/Date safely; returns `fallback` for invalid input. */
export function formatDate(
  value: string | number | Date | null | undefined,
  fallback = '—'
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toLocaleDateString();
}

/** Format a date-time string/Date safely. */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  fallback = '—'
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toLocaleString();
}

/** Format a time safely. */
export function formatTime(
  value: string | number | Date | null | undefined,
  fallback = '—'
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toLocaleTimeString();
}
