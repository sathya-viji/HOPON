/**
 * Contacts → "people you may know" — Wave 6 (Phase 1 backend).
 *
 * Privacy model (D10, frozen): raw phone numbers NEVER leave the device. We read
 * contacts locally, normalise each to E.164 with a leading '+', SHA-256-hash it
 * client-side, and send only the hashes to the `contacts-match` Edge Function.
 * The function stores the hashes (full re-sync) and returns the `users_public`
 * rows whose `'+'||phone` hash matches — i.e. contacts already on HopOn.
 *
 * The hash must equal `sha256('+' || users.phone)` (phones are stored without
 * '+'), so the normalised input is the '+'-prefixed E.164 string.
 */
import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { supabase } from './client';
import { mapPublicUser, type PublicUserRowFull } from './mappers';
import type { User } from '@/types';

export type ContactSyncStatus = 'matched' | 'denied' | 'no_contacts' | 'error';
export interface ContactSyncResult {
  status: ContactSyncStatus;
  users: User[];
}

const MAX_HASHES = 5000;
/** Default country code for bare local numbers (India). */
const DEFAULT_CC = '91';

/** Best-effort normalise a raw contact number to '+E.164', or null if unusable. */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const hasPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (hasPlus) return `+${digits}`;
  let d = digits;
  if (d.startsWith('0')) d = d.slice(1); // drop national trunk prefix
  if (d.length === 10) return `+${DEFAULT_CC}${d}`; // bare local → default CC
  if (d.length > 10) return `+${d}`; // already carries a country code
  return null; // too short to be a real mobile number
}

/**
 * Read contacts, hash them, and return the HopOn users among them. Requests the
 * contacts permission; returns a typed status so the UI can show the right
 * empty/denied state. Never throws — failures resolve to `{status:'error'}`.
 */
export async function matchContacts(): Promise<ContactSyncResult> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return { status: 'denied', users: [] };

    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
    const numbers = new Set<string>();
    for (const c of data) {
      for (const p of c.phoneNumbers ?? []) {
        const n = p.number ? normalizePhone(p.number) : null;
        if (n) numbers.add(n);
      }
    }
    if (numbers.size === 0) return { status: 'no_contacts', users: [] };

    const hashes = await Promise.all(
      [...numbers].slice(0, MAX_HASHES).map((n) =>
        Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, n),
      ),
    );

    const { data: res, error } = await supabase.functions.invoke('contacts-match', { body: { hashes } });
    if (error) return { status: 'error', users: [] };
    const matches = ((res as { matches?: PublicUserRowFull[] } | null)?.matches ?? []);
    return { status: 'matched', users: matches.map(mapPublicUser) };
  } catch {
    return { status: 'error', users: [] };
  }
}
