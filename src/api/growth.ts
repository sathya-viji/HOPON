/**
 * Growth API — Wave 7 (Phase 7 backend: invites + feature flags).
 *
 * Invites use the same privacy model as contact matching (D10): raw numbers
 * never leave the device — we hash contacts client-side. `create_invites`
 * server-side discards any hash that already belongs to a HopOn user, so an
 * "invite" only lands for contacts who AREN'T on the app yet. When such a
 * contact later signs up, `complete_signup` converts the pending invite and
 * credits the inviter.
 */
import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { supabase } from './client';
import { normalizePhone } from './contacts';

export interface InviteResult {
  status: 'sent' | 'denied' | 'no_contacts' | 'error';
  /** New invites created (contacts not already on HopOn). */
  count: number;
}

/**
 * Hash the user's contacts and create invites for the ones not yet on HopOn.
 * Reuses the contacts permission + `+E.164` normalisation; never throws.
 */
export async function inviteContacts(): Promise<InviteResult> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return { status: 'denied', count: 0 };
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
    const numbers = new Set<string>();
    for (const c of data) for (const p of c.phoneNumbers ?? []) {
      const n = p.number ? normalizePhone(p.number) : null;
      if (n) numbers.add(n);
    }
    if (numbers.size === 0) return { status: 'no_contacts', count: 0 };
    const hashes = await Promise.all(
      [...numbers].slice(0, 5000).map((n) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, n)),
    );
    const { data: count, error } = await supabase.rpc('create_invites', { p_phone_hashes: hashes });
    if (error) return { status: 'error', count: 0 };
    return { status: 'sent', count: (count as number) ?? 0 };
  } catch {
    return { status: 'error', count: 0 };
  }
}

export interface InviteStats {
  pending: number;
  converted: number;
}

/** The signed-in user's invite counts (own rows via RLS). */
export async function getInviteStats(): Promise<InviteStats> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return { pending: 0, converted: 0 };
  const { data, error } = await supabase
    .from('invites')
    .select('status')
    .eq('inviter_id', uid);
  if (error) return { pending: 0, converted: 0 };
  const rows = (data ?? []) as { status: string }[];
  return {
    pending: rows.filter((r) => r.status === 'pending').length,
    converted: rows.filter((r) => r.status === 'converted').length,
  };
}

/**
 * Whether a feature flag is enabled for the signed-in user (server applies the
 * rollout-percentage bucketing). Defaults to false on any error so gated
 * features stay off unless explicitly enabled.
 */
export async function isFeatureEnabled(flag: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_feature_enabled', { p_flag: flag });
  if (error) return false;
  return data === true;
}
