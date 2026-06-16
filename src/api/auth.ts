/**
 * Auth API — phone OTP sign-in + profile bootstrap.
 *
 * Flow: sendOtp → verifyOtp (session established) → hasProfile?
 *   - no profile  → onboarding collects name/dob/gender/neighbourhood → completeSignup
 *   - has profile → Main
 *
 * Phone is stored in E.164 without the '+' by GoTrue; we always submit WITH '+'.
 * The frontend collects 10 local digits; we prefix +91 (India launch market).
 */
import { supabase } from './client';
import { setSuspended } from '@/state/suspension';

const DIAL_CODE = '+91';

// ⚠️ BETA backdoor: when EXPO_PUBLIC_BETA_AUTH=true the app skips Twilio OTP and
// authenticates any number with a single shared code via the `beta-auth` edge
// function (+ password sign-in). Set to false / unset before public launch.
const BETA_AUTH = process.env.EXPO_PUBLIC_BETA_AUTH === 'true';

/** 10 local digits → E.164 (e.g. '9876543210' → '+919876543210'). */
export function toE164(localDigits: string): string {
  const digits = localDigits.replace(/\D/g, '');
  return `${DIAL_CODE}${digits}`;
}

/** Whether a bare handle (no '@') is free to claim. */
export async function handleAvailable(handle: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('handle_available', { p_handle: handle });
  if (error) throw error;
  return data === true;
}

/** Whether a number already has a completed account (pre-OTP check). */
export async function phoneRegistered(localDigits: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('phone_has_profile', { p_phone: toE164(localDigits) });
  if (error) throw error;
  return data === true;
}

/** Send a one-time SMS code. Creates the auth user if new. */
export async function sendOtp(localDigits: string): Promise<void> {
  if (BETA_AUTH) return; // beta: no SMS — the code screen accepts the fixed beta code
  const { error } = await supabase.auth.signInWithOtp({ phone: toE164(localDigits) });
  if (error) throw error;
}

/** Verify the code; on success a session is persisted and returned. */
export async function verifyOtp(localDigits: string, token: string) {
  const phone = toE164(localDigits);
  if (BETA_AUTH) {
    // Ensure the user exists with password = the shared code, then sign in.
    const { error: fnErr } = await supabase.functions.invoke('beta-auth', { body: { phone, code: token } });
    if (fnErr) throw new Error('That code isn’t right.');
    const { data, error } = await supabase.auth.signInWithPassword({ phone, password: token });
    if (error) throw error;
    return data.session;
  }
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  return data.session;
}

/** Whether the signed-in user has completed onboarding (has a profile row). */
export async function hasProfile(): Promise<boolean> {
  // Derive the user id from the locally-stored session, NOT getUser(): getUser()
  // makes a network call and returns a null user when offline, which reads as
  // "no profile" and would bounce a logged-in user to onboarding on any launch
  // blip. With the session id, a network failure on the read below throws, so
  // the auth gate can treat it as a transient error instead of a logout.
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase
    .from('users_public')
    .select('id')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export interface CompleteSignupInput {
  name: string;
  handle: string;       // must start with '@'
  dob: string;          // 'YYYY-MM-DD'
  gender: 'man' | 'woman' | 'nonbinary' | 'prefer_not';
  neighbourhood: string;
}

/** Create the profile row after onboarding. Returns the public profile. */
export async function completeSignup(input: CompleteSignupInput) {
  const { data, error } = await supabase.rpc('complete_signup', {
    p_name: input.name,
    p_handle: input.handle,
    p_dob: input.dob,
    p_gender: input.gender,
    p_neighbourhood: input.neighbourhood,
  });
  if (error) throw error;
  return data;
}

/** Persist interests after complete_signup (self-edit via column grant). */
export async function setInterests(interests: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');
  const { error } = await supabase.from('users').update({ interests }).eq('id', user.id);
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  setSuspended(false); // clear any reactive suspension banner
  await supabase.auth.signOut();
}

/** Soft-delete the account (F3: 30-day grace), then end the session. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
  await supabase.auth.signOut();
}

/**
 * Export everything the backend holds about the signed-in user (profile + all
 * user-owned rows across phases), as a JSON object. Used by the "Download my
 * data" affordance before account deletion.
 */
export async function exportMyData(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
