import type { UserRole } from '@/types';

const STORAGE_KEY = 'edupulse-remembered-account';

export interface RememberedAccount {
  role: UserRole;
  fullName: string;
  photoUrl?: string | null;
  email?: string;
  staffId?: string;
  phone?: string;
  savedAt: string;
}

export function getRememberedAccount(role?: UserRole | null): RememberedAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RememberedAccount;
    if (!parsed?.fullName || !parsed?.role) return null;
    if (role && parsed.role !== role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRememberedAccount(account: RememberedAccount): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...account, savedAt: new Date().toISOString() })
  );
}

export function clearRememberedAccount(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getRememberedIdentifier(account: RememberedAccount): string {
  if (account.email) return account.email;
  if (account.staffId) return account.staffId;
  if (account.phone) return account.phone;
  return '';
}
