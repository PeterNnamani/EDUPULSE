import { supabase } from '@/lib/supabase';

/**
 * MONNIFY SERVICE (client)
 *
 * Manages per-school Monnify credentials and student virtual accounts.
 * Account reservation and webhook processing happen server-side in the
 * `monnify-webhook` Edge Function (secrets never touch the client).
 */

export interface MonnifyConfig {
  apiKey: string;
  secretKey: string;
  contractCode: string;
  baseUrl: string;
  isActive: boolean;
}

export interface VirtualAccount {
  accountNumber: string | null;
  accountName: string | null;
  bankName: string | null;
  reservationReference: string | null;
}

export const monnifyService = {
  async getConfig(schoolId: string): Promise<MonnifyConfig | null> {
    const { data } = await supabase
      .from('school_payment_config')
      .select('monnify_api_key, monnify_secret_key, monnify_contract_code, monnify_base_url, is_active')
      .eq('school_id', schoolId)
      .eq('provider', 'monnify')
      .maybeSingle();
    if (!data) return null;
    return {
      apiKey: data.monnify_api_key ?? '',
      secretKey: data.monnify_secret_key ?? '',
      contractCode: data.monnify_contract_code ?? '',
      baseUrl: data.monnify_base_url ?? 'https://api.monnify.com',
      isActive: data.is_active ?? false,
    };
  },

  async saveConfig(
    schoolId: string,
    config: MonnifyConfig
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = {
        school_id: schoolId,
        provider: 'monnify',
        monnify_api_key: config.apiKey.trim(),
        monnify_secret_key: config.secretKey.trim(),
        monnify_contract_code: config.contractCode.trim(),
        monnify_base_url: config.baseUrl.trim() || 'https://api.monnify.com',
        is_active: config.isActive,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('school_payment_config')
        .upsert([payload], { onConflict: 'school_id,provider' });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save config' };
    }
  },

  async getVirtualAccount(schoolId: string, studentId: string): Promise<VirtualAccount | null> {
    const { data } = await supabase
      .from('student_virtual_accounts')
      .select('account_number, account_name, bank_name, reservation_reference')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('is_active', true)
      .maybeSingle();
    if (!data) return null;
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
      const { data, error } = await supabase.functions.invoke('monnify-webhook', {
        body: { action: 'sync_account_name', schoolId, studentId },
      });
      if (error) return { success: false, error: error.message };
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
      const { data, error } = await supabase.functions.invoke('monnify-webhook', {
        body: { action: 'reserve_account', schoolId, studentId },
      });
      if (error) {
        // FunctionsFetchError ("Failed to send a request to the Edge Function")
        // means the function isn't deployed/reachable yet.
        const msg = error.message || String(error);
        if (/failed to send a request|fetch/i.test(msg)) {
          return {
            success: false,
            error:
              'The Monnify payment function is not deployed yet. Deploy it with: supabase functions deploy monnify-webhook',
          };
        }
        return { success: false, error: msg };
      }
      if (!data?.success) {
        return { success: false, error: data?.error || 'Failed to reserve account' };
      }
      const account = await this.getVirtualAccount(schoolId, studentId);
      return { success: true, account: account ?? undefined };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to reserve virtual account',
      };
    }
  },

  async isConfigured(schoolId: string): Promise<boolean> {
    const cfg = await this.getConfig(schoolId);
    return !!(cfg?.isActive && cfg.apiKey && cfg.secretKey && cfg.contractCode);
  },
};
