/**
 * Shared environment access for Edge Functions.
 * Throws at cold start if a required secret is missing — fail fast, not mid-request.
 */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

export const SUPABASE_URL = requireEnv('SUPABASE_URL');
export const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
