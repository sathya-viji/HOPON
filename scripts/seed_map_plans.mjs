/**
 * Seeds a batch of real plans (prod-safe, same beta-auth + create_plan RPC
 * the app itself uses — no forged JWTs, no raw SQL) so the map view can be
 * visually reviewed with realistic pin/heatmap density.
 *
 * create_plan caps a host at 5 concurrent active/full plans, so this creates
 * one throwaway host account per ~5 plans requested and spreads plans evenly
 * across them, jittered around a handful of real Chennai neighbourhoods
 * (Adyar/Thoraipakkam/Besant Nagar/Kotivakkam/Indira Nagar) that earlier
 * testing confirmed are within the home feed's 25km radius.
 *
 * Writes .seed_map_plans_manifest.json (gitignored via .env* pattern? no —
 * this file is local scratch state, not secrets, but still shouldn't be
 * committed) with the seeded hosts' phone numbers, so
 * scripts/cleanup_seed_map_plans.mjs can log back in and self-delete them
 * (delete_account auto-cancels all of a host's active plans).
 *
 * Run: node scripts/seed_map_plans.mjs [count]   (default 150)
 */
import fs from 'node:fs';

const envLines = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
const envVar = (name) => envLines.find((l) => l.startsWith(`${name}=`))?.slice(name.length + 1).trim();
const BASE = envVar('EXPO_PUBLIC_SUPABASE_URL');
const ANON = envVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const BETA_CODE = '123456';

if (!BASE?.startsWith('https://')) {
  console.error(`Refusing to run: EXPO_PUBLIC_SUPABASE_URL (${BASE}) doesn't look like prod.`);
  process.exit(1);
}

const TOTAL_PLANS = Number(process.argv[2]) || 150;
const MAX_ACTIVE_PER_HOST = 5;
const HOST_COUNT = Math.ceil(TOTAL_PLANS / MAX_ACTIVE_PER_HOST) + 2;

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

async function signup(phoneDigits, name, handle) {
  const phone = `+91${phoneDigits}`;
  const beta = await raw(null, 'POST', '/functions/v1/beta-auth', { phone, code: BETA_CODE });
  if (beta.status !== 200) throw new Error(`beta-auth failed for ${phone}: ${JSON.stringify(beta.json)}`);
  const tok = await raw(null, 'POST', '/auth/v1/token?grant_type=password', { phone, password: BETA_CODE });
  if (tok.status !== 200 || !tok.json?.access_token) throw new Error(`password sign-in failed for ${phone}: ${JSON.stringify(tok.json)}`);
  const access_token = tok.json.access_token;
  const uid = tok.json.user.id;
  const gender = Math.random() < 0.5 ? 'man' : 'woman';
  const cs = await rpcTok(access_token, 'complete_signup', {
    p_name: name, p_handle: `@${handle}`, p_dob: '1995-01-01', p_gender: gender, p_neighbourhood: 'Adyar',
  });
  if (cs.status !== 200 && cs.status !== 201) throw new Error(`complete_signup failed for ${handle}: ${JSON.stringify(cs.json)}`);
  return { phone: phoneDigits, uid, token: access_token, handle };
}

const CATEGORIES = ['sports', 'food', 'entertainment', 'outdoors', 'learning', 'social', 'arts', 'other'];
const ACTIVITY_NAMES = {
  sports: ['Badminton doubles', 'Morning run', 'Yoga in the park', 'Football kickabout', 'Cycling loop'],
  food: ['Brunch meetup', 'Coffee & chat', 'Street food crawl', 'Dinner club', 'Ice cream run'],
  entertainment: ['Movie night', 'Board game session', 'Karaoke evening', 'Trivia night', 'Live music'],
  outdoors: ['Beach walk', 'Trekking group', 'Park picnic', 'Sunrise hike', 'Birdwatching'],
  learning: ['Book club', 'Language exchange', 'Coding meetup', 'Study group', 'Photography walk'],
  social: ['Hangout at the cafe', 'New-in-town meetup', 'Game night', 'Rooftop chill', 'Sunday social'],
  arts: ['Pottery session', 'Sketching meetup', 'Gallery visit', 'Open mic', 'Craft circle'],
  other: ['Plan something fun', 'Casual meetup', 'Spontaneous hangout', 'Group activity', 'Weekend plan'],
};

const CLUSTERS = [
  { label: 'Adyar', lat: 13.0067, lng: 80.2206 },
  { label: 'Thoraipakkam', lat: 12.9420, lng: 80.2350 },
  { label: 'Besant Nagar', lat: 13.0002, lng: 80.2669 },
  { label: 'Kotivakkam', lat: 12.9569, lng: 80.2482 },
  { label: 'Indira Nagar', lat: 13.0104, lng: 80.2445 },
];

const jitter = (v, deg) => v + (Math.random() - 0.5) * 2 * deg;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

async function main() {
  console.log(`Seeding ${TOTAL_PLANS} plans across up to ${HOST_COUNT} hosts...`);
  const suffix = Date.now().toString(36).slice(-5);
  const numSuffix = Date.now().toString().slice(-6);

  const hosts = [];
  for (let i = 0; i < HOST_COUNT; i++) {
    const phone = `71${String(i).padStart(3, '0')}${numSuffix}`;
    try {
      const h = await signup(phone, `Seed Host ${i}`, `seed_${suffix}_${i}`);
      hosts.push(h);
    } catch (e) {
      console.error(`\nhost ${i} signup failed:`, e.message);
    }
    process.stdout.write(`\rHosts signed up: ${hosts.length}/${HOST_COUNT}`);
  }
  console.log(`\n${hosts.length} hosts ready.`);
  if (hosts.length === 0) { console.error('No hosts — aborting.'); process.exit(1); }

  const hostActiveCounts = new Map(hosts.map((h) => [h.uid, 0]));
  let created = 0;
  let hostIdx = 0;

  for (let i = 0; i < TOTAL_PLANS; i++) {
    let attempts = 0;
    let host = hosts[hostIdx % hosts.length];
    while (hostActiveCounts.get(host.uid) >= MAX_ACTIVE_PER_HOST && attempts < hosts.length) {
      hostIdx++; attempts++;
      host = hosts[hostIdx % hosts.length];
    }
    if (hostActiveCounts.get(host.uid) >= MAX_ACTIVE_PER_HOST) { console.log('\nAll hosts at cap, stopping early.'); break; }
    hostIdx++;

    const category = pick(CATEGORIES);
    const activity = `${pick(ACTIVITY_NAMES[category])} ${suffix}${i}`;
    const cluster = pick(CLUSTERS);
    const cost = pick(['free', 'free', 'free', 'copay', 'seeking', 'sponsored']);

    const r = await rpcTok(host.token, 'create_plan', {
      p_category_id: category,
      p_activity: activity,
      p_location_label: cluster.label,
      p_lat: jitter(cluster.lat, 0.015),
      p_lng: jitter(cluster.lng, 0.015),
      p_starts_at: new Date(Date.now() + randInt(30, 4000) * 60000).toISOString(),
      p_capacity: randInt(2, 8),
      p_plan_type: 'open',
      p_cost: cost,
      p_gender_pref: pick(['all', 'all', 'all', 'women', 'men']),
      p_cost_note: cost === 'copay' ? '₹200 split' : null,
    });
    if (r.status === 200 || r.status === 201) {
      created++;
      hostActiveCounts.set(host.uid, (hostActiveCounts.get(host.uid) || 0) + 1);
    } else {
      console.error(`\nplan ${i} failed:`, JSON.stringify(r.json));
    }
    if (i % 10 === 0) process.stdout.write(`\rPlans created: ${created}/${TOTAL_PLANS}`);
  }
  console.log(`\n${created} plans created across ${hosts.length} hosts.`);

  const manifestPath = new URL('../.seed_map_plans_manifest.json', import.meta.url);
  fs.writeFileSync(manifestPath, JSON.stringify({ createdAt: new Date().toISOString(), planCount: created, hosts: hosts.map((h) => ({ phone: h.phone, handle: h.handle })) }, null, 2));
  console.log(`Manifest written to ${manifestPath.pathname}`);
  console.log('When you\'re done reviewing, run: node scripts/cleanup_seed_map_plans.mjs');
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
