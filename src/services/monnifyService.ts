import { supabase } from '@/lib/supabase';
import { resolveMonnifyBaseUrl } from '@/config/monnifyConfig';
import { schoolHasFeature } from '@/services/subscriptionService';

/**
 * MONNIFY SERVICE (client)
 *
 * Manages per-school Monnify credentials and student virtual accounts.
 * Account reservation and webhook processing happen server-side in the
 * `monnify-webhook` Edge Function (secrets never touch the client).
 */

/** Shown in the UI when a secret is stored server-side but not returned to the client. */
export const MONNIFY_SECRET_MASK = '••••••••••••';

export interface MonnifyConfig {
  apiKey: string;
  secretKey: string;
  contractCode: string;
  baseUrl: string;
  isActive: boolean;
  /** True when a secret exists in the database (client never receives the raw value). */
  hasStoredSecret?: boolean;
}

function isMaskedOrEmptySecret(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || trimmed === MONNIFY_SECRET_MASK || /^•+$/.test(trimmed);
}

export interface VirtualAccount {
  accountNumber: string | null;
  accountName: string | null;
  bankName: string | null;
  reservationReference: string | null;
}

async function parseFunctionInvokeError(
  error: { message?: string; context?: Response } | null,
  data: unknown
): Promise<string> {
  const payload = data as { error?: string; message?: string } | null;
  if (payload?.error) return payload.error;
  if (payload?.message) return payload.message;

  const response = error?.context;
  if (response && typeof response.json === 'function') {
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // Response body unavailable or already consumed.
    }
  }

  const msg = error?.message || 'Request failed';
  if (/failed to send a request|fetch/i.test(msg)) {
    return 'The Monnify payment function is not deployed yet. Deploy it with: supabase functions deploy monnify-webhook';
  }
  if (/non-2xx/i.test(msg)) {
    return 'Monnify request failed. Verify API key, secret, contract code, and that Payments is enabled in Settings.';
  }
  return msg;
}

export type MonnifySetupStatus =
  | { state: 'ready' }
  | { state: 'not_saved' }
  | { state: 'disabled' }
  | { state: 'incomplete'; message: string }
  | { state: 'unreadable'; message: string };

function mapConfigRow(row: {
  monnify_api_key?: string | null;
  monnify_contract_code?: string | null;
  monnify_base_url?: string | null;
  is_active?: boolean | null;
  monnify_secret_set?: boolean | null;
}): MonnifyConfig {
  const apiKey = row.monnify_api_key?.trim() ?? '';
  const contractCode = row.monnify_contract_code?.trim() ?? '';
  const isActive = row.is_active ?? false;
  const hasStoredSecret =
    row.monnify_secret_set === true ||
    (row.monnify_secret_set == null && isActive && !!apiKey && !!contractCode);

  return {
    apiKey,
    secretKey: hasStoredSecret ? MONNIFY_SECRET_MASK : '',
    contractCode,
    baseUrl: row.monnify_base_url ?? 'https://api.monnify.com',
    isActive,
    hasStoredSecret,
  };
}

export const monnifyService = {
  async loadConfig(
    schoolId: string
  ): Promise<{ config: MonnifyConfig | null; readError?: string }> {
    const baseQuery = () =>
      supabase
        .from('school_payment_config')
        .select(
          'monnify_api_key, monnify_contract_code, monnify_base_url, is_active, monnify_secret_set'
        )
        .eq('school_id', schoolId)
        .eq('provider', 'monnify')
        .maybeSingle();

    let { data, error } = await baseQuery();

    if (error && /monnify_secret_set/i.test(error.message ?? '')) {
      const fallback = await supabase
        .from('school_payment_config')
        .select('monnify_api_key, monnify_contract_code, monnify_base_url, is_active')
        .eq('school_id', schoolId)
        .eq('provider', 'monnify')
        .maybeSingle();
      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      console.error('[MONNIFY] getConfig failed:', error.message);
      return { config: null, readError: error.message };
    }
    if (!data) return { config: null };
    return { config: mapConfigRow(data) };
  },

  async getConfig(schoolId: string): Promise<MonnifyConfig | null> {
    const { config } = await this.loadConfig(schoolId);
    return config;
  },

  async getSetupStatus(schoolId: string): Promise<MonnifySetupStatus> {
    const { config: cfg, readError } = await this.loadConfig(schoolId);
    if (readError) {
      return {
        state: 'unreadable',
        message:
          'Could not load Monnify settings. Confirm you are logged in as admin and run the latest database migration (029).',
      };
    }
    if (!cfg) return { state: 'not_saved' };

    const hasRow = !!(cfg.apiKey || cfg.contractCode || cfg.isActive);
    if (!hasRow) return { state: 'not_saved' };

    if (!cfg.apiKey || !cfg.contractCode) {
      return {
        state: 'incomplete',
        message: 'Add your Monnify API key and contract code in Settings → Payments.',
      };
    }

    if (!cfg.hasStoredSecret) {
      return {
        state: 'incomplete',
        message: 'Re-enter your Monnify secret key in Settings → Payments and save again.',
      };
    }

    if (!cfg.isActive) {
      return { state: 'disabled' };
    }

    return { state: 'ready' };
  },

  async saveConfig(
    schoolId: string,
    config: MonnifyConfig
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const allowed = await schoolHasFeature(schoolId, 'virtual_accounts');
      if (!allowed) {
        return {
          success: false,
          error: 'Virtual accounts require the Enterprise plan or higher. Upgrade in Subscriptions.',
        };
      }

      const apiKey = config.apiKey.trim();
      const contractCode = config.contractCode.trim();
      const secretInput = config.secretKey.trim();
      const updatingSecret = !isMaskedOrEmptySecret(secretInput);
      const existing = await this.getConfig(schoolId);

      if (config.isActive) {
        if (!apiKey || !contractCode) {
          return {
            success: false,
            error: 'API key and contract code are required to enable Monnify.',
          };
        }
        const hasSecret = updatingSecret || existing?.hasStoredSecret;
        if (!hasSecret) {
          return {
            success: false,
            error: 'Secret key is required to enable Monnify.',
          };
        }
      }

      const payload: Record<string, unknown> = {
        school_id: schoolId,
        provider: 'monnify',
        monnify_api_key: apiKey,
        monnify_contract_code: contractCode,
        monnify_base_url: resolveMonnifyBaseUrl(apiKey, config.baseUrl),
        is_active: config.isActive,
        updated_at: new Date().toISOString(),
      };
      if (updatingSecret) {
        payload.monnify_secret_key = secretInput;
      }
      if (updatingSecret || existing?.hasStoredSecret) {
        payload.monnify_secret_set = true;
      }

      let { error } = await supabase
        .from('school_payment_config')
        .upsert([payload], { onConflict: 'school_id,provider' });

      if (error && /monnify_secret_set/i.test(error.message ?? '')) {
        delete payload.monnify_secret_set;
        const retry = await supabase
          .from('school_payment_config')
          .upsert([payload], { onConflict: 'school_id,provider' });
        error = retry.error;
      }

      if (error) throw error;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('monnify-config-updated', { detail: { schoolId } }));
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save config' };
    }
  },

  /** Batch lookup for admin student lists (one query per school). */
  async getSchoolVirtualAccountIndex(
    schoolId: string
  ): Promise<Map<string, { accountNumber: string; bankName: string | null }>> {
    const { data, error } = await supabase
      .from('student_virtual_accounts')
      .select('student_id, account_number, bank_name')
      .eq('school_id', schoolId)
      .eq('provider', 'monnify')
      .not('account_number', 'is', null);

    if (error) {
      console.error('Error fetching virtual account index:', error);
      return new Map();
    }

    const index = new Map<string, { accountNumber: string; bankName: string | null }>();
    for (const row of data ?? []) {
      if (row.student_id && row.account_number) {
        index.set(row.student_id, {
          accountNumber: row.account_number,
          bankName: row.bank_name,
        });
      }
    }
    return index;
  },

  async getVirtualAccount(schoolId: string, studentId: string): Promise<VirtualAccount | null> {
    const { data } = await supabase
      .from('student_virtual_accounts')
      .select('account_number, account_name, bank_name, reservation_reference')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('provider', 'monnify')
      .not('account_number', 'is', null)
      .maybeSingle();
    if (!data?.account_number) return null;
    return {
      accountNumber: data.account_number,
      accountName: data.account_name,
      bankName: data.bank_name,
      reservationReference: data.reservation_reference,
    };
  },

  /**
   * Sync virtual account display name with the student's full legal name on Monnify + DB.
   */
  async syncVirtualAccountName(
    schoolId: string,
    studentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const allowed = await schoolHasFeature(schoolId, 'virtual_accounts');
      if (!allowed) return { success: false, error: 'Virtual accounts are not on your plan.' };

      const configured = await this.isConfigured(schoolId);
      if (!configured) return { success: false, error: 'Monnify is not configured.' };

      const { data, error } = await supabase.functions.invoke('monnify-webhook', {
        body: { action: 'sync_account_name', schoolId, studentId },
      });
      if (error) {
        return { success: false, error: await parseFunctionInvokeError(error, data) };
      }
      if (!data?.success) return { success: false, error: data?.error || 'Sync failed' };
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to sync account name',
      };
    }
  },

  /**
   * Reserve a virtual account for a student via the Edge Function. Safe to call
   * repeatedly - syncs the account name or creates the account if missing.
   */
  async ensureVirtualAccount(
    schoolId: string,
    studentId: string
  ): Promise<{ success: boolean; account?: VirtualAccount; error?: string }> {
    try {
      const allowed = await schoolHasFeature(schoolId, 'virtual_accounts');
      if (!allowed) {
        return {
          success: false,
          error: 'Virtual accounts require the Enterprise plan or higher.',
        };
      }

      const configured = await this.isConfigured(schoolId);
      if (!configured) {
        return {
          success: false,
          error: 'Monnify is not configured. Add your API keys in Settings → Payments.',
        };
      }

      const { data, error } = await supabase.functions.invoke('monnify-webhook', {
        body: { action: 'reserve_account', schoolId, studentId },
      });
      if (error) {
        return { success: false, error: await parseFunctionInvokeError(error, data) };
      }
      if (!data?.success) {
        return { success: false, error: data?.error || 'Failed to reserve account' };
      }
      const fromDb = await this.getVirtualAccount(schoolId, studentId);
      if (fromDb?.accountNumber) {
        return { success: true, account: fromDb };
      }
      const row = data.account as Record<string, unknown> | undefined;
      if (row?.account_number) {
        return {
          success: true,
          account: {
            accountNumber: String(row.account_number),
            accountName: row.account_name != null ? String(row.account_name) : null,
            bankName: row.bank_name != null ? String(row.bank_name) : null,
            reservationReference:
              row.reservation_reference != null ? String(row.reservation_reference) : null,
          },
        };
      }
      return { success: true, account: fromDb ?? undefined };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to reserve virtual account',
      };
    }
  },

  async isConfigured(schoolId: string): Promise<boolean> {
    const status = await this.getSetupStatus(schoolId);
    return status.state === 'ready';
  },
};
