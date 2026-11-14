import { createClient as createServiceClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  adminClient = createServiceClient(url, key);
  return adminClient;
}

export interface BankDetails {
  bank_name: string;
  account_number: string;
  account_name: string;
  instructions?: string;
  is_custom_assigned?: boolean;
}

const SETTINGS_KEY = 'user_bank_assignments';

/**
 * Fetch the master default bank account from invoice_defaults (or fallback).
 */
export async function getDefaultBankDetails(): Promise<BankDetails> {
  const admin = getAdminClient();
  if (admin) {
    try {
      const { data, error } = await admin
        .from('invoice_defaults')
        .select('bank_name, account_name, account_number')
        .eq('id', 1)
        .maybeSingle();

      if (!error && data && data.account_number) {
        return {
          bank_name: data.bank_name || 'Opay',
          account_number: data.account_number || '8121443666',
          account_name: data.account_name || 'Richlord Jude',
          instructions: 'Please include your Order ID or Reference in the transfer narration.',
          is_custom_assigned: false,
        };
      }
    } catch (e) {
      console.warn('Failed to load invoice_defaults bank:', e);
    }
  }

  return {
    bank_name: 'Opay',
    account_number: '8121443666',
    account_name: 'Richlord Jude',
    instructions: 'Please include your Order ID or Reference in the transfer narration.',
    is_custom_assigned: false,
  };
}

/**
 * Get assigned bank details for a specific user, falling back to invoice_defaults.
 */
export async function getUserBankDetails(userId?: string | null): Promise<BankDetails> {
  const fallback = await getDefaultBankDetails();
  if (!userId) return fallback;

  const admin = getAdminClient();
  if (!admin) return fallback;

  try {
    // 1. Check if custom assignment exists in project_settings
    const { data: settingRow } = await admin
      .from('project_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (settingRow?.value && typeof settingRow.value === 'object') {
      const userAssignment = (settingRow.value as Record<string, any>)[userId];
      if (userAssignment && userAssignment.account_number) {
        return {
          bank_name: userAssignment.bank_name || fallback.bank_name,
          account_number: userAssignment.account_number,
          account_name: userAssignment.account_name || fallback.account_name,
          instructions: userAssignment.instructions || fallback.instructions,
          is_custom_assigned: true,
        };
      }
    }

    // 2. Also check profiles table if columns exist
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.assigned_account_number) {
      return {
        bank_name: profile.assigned_bank_name || fallback.bank_name,
        account_number: profile.assigned_account_number,
        account_name: profile.assigned_account_name || fallback.account_name,
        instructions: profile.assigned_bank_notes || fallback.instructions,
        is_custom_assigned: true,
      };
    }
  } catch (err) {
    console.warn(`Error resolving bank details for user ${userId}:`, err);
  }

  return fallback;
}

/**
 * Assign or update a dedicated bank account for a specific user.
 */
export async function setUserBankDetails(
  userId: string,
  details: { bank_name: string; account_number: string; account_name: string; instructions?: string }
): Promise<boolean> {
  const admin = getAdminClient();
  if (!admin) return false;

  try {
    // 1. Update project_settings store
    const { data: current } = await admin
      .from('project_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    const existingMap = (current?.value && typeof current.value === 'object') ? (current.value as Record<string, any>) : {};
    existingMap[userId] = {
      bank_name: details.bank_name.trim(),
      account_number: details.account_number.trim(),
      account_name: details.account_name.trim(),
      instructions: details.instructions?.trim() || '',
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await admin
      .from('project_settings')
      .upsert({
        key: SETTINGS_KEY,
        value: existingMap,
        updated_at: new Date().toISOString(),
      });

    if (upsertErr) console.warn('Error saving to project_settings:', upsertErr);

    // 2. Also try updating profiles if columns exist
    try {
      await admin
        .from('profiles')
        .update({
          assigned_bank_name: details.bank_name.trim(),
          assigned_account_number: details.account_number.trim(),
          assigned_account_name: details.account_name.trim(),
          assigned_bank_notes: details.instructions?.trim() || null,
        })
        .eq('id', userId);
    } catch {
      // Ignore if columns not yet added to profiles table
    }

    return true;
  } catch (err) {
    console.error('Failed to set user bank details:', err);
    return false;
  }
}

/**
 * Get all custom user bank assignments (for Admin finance table).
 */
export async function getAllUserBankAssignments(): Promise<Record<string, BankDetails>> {
  const admin = getAdminClient();
  if (!admin) return {};

  try {
    const { data } = await admin
      .from('project_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (data?.value && typeof data.value === 'object') {
      return data.value as Record<string, BankDetails>;
    }
  } catch (err) {
    console.warn('Error fetching all user bank assignments:', err);
  }
  return {};
}
