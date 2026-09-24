/**
 * Cleans up the test hosts created by scripts/seed_map_plans.mjs.
 * Re-authenticates each host via beta-auth (fresh token — the seed script's
 * tokens may have expired) and calls the app's own delete_account RPC, which
 * auto-cancels all of that host's active/full plans as part of the same
 * soft-delete transaction. No raw SQL, no service-role key.
 *
 * Run: node scripts/cleanup_seed_map_plans.mjs
 */
import fs from 'node:fs';

const envLines = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
const envVar = (name) => envLines.find((l) => l.startsWith(`${name}=`))?.slice(name.length + 1).trim();
const BASE = envVar('EXPO_PUBLIC_SUPABASE_URL');
const ANON = envVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const BETA_CODE = '123456';

const manifestUrl = new URL('../.seed_map_plans_manifest.json', import.meta.url);
if (!fs.existsSync(manifestUrl)) {
  console.error('No .seed_map_plans_manifest.json found — nothing to clean up.');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'));

async function raw(token, method, path, body) {
  const headers = { apikey: ANON };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}
const rpcTok = (token, fn, body = {}) => raw(token, 'POST', `/rest/v1/rpc/${fn}`, body);

async function main() {
  console.log(`Cleaning up ${manifest.hosts.length} seed hosts (${manifest.planCount} plans, seeded ${manifest.createdAt})...`);
  let done = 0;
  for (const h of manifest.hosts) {
    const phone = `+91${h.phone}`;
    try {
      const tok = await raw(null, 'POST', '/auth/v1/token?grant_type=password', { phone, password: BETA_CODE });
      if (tok.status !== 200 || !tok.json?.access_token) throw new Error(`sign-in failed: ${JSON.stringify(tok.json)}`);
      const r = await rpcTok(tok.json.access_token, 'delete_account', {});
      if (r.status !== 200 && r.status !== 204) throw new Error(`delete_account failed: ${JSON.stringify(r.json)}`);
      done++;
    } catch (e) {
      console.error(`\n${h.handle} (${h.phone}) cleanup failed:`, e.message);
    }
    process.stdout.write(`\rDeleted: ${done}/${manifest.hosts.length}`);
  }
  console.log(`\n${done}/${manifest.hosts.length} hosts deleted (their plans auto-cancelled).`);
  fs.unlinkSync(manifestUrl);
  console.log('Manifest removed.');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
