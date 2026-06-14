#!/usr/bin/env bash
# ============================================================================
# HopOn — Phase 1 end-to-end regression
# Drives the full identity flow against the LOCAL stack over real HTTP:
#   admin-create user → sign in → complete_signup → contacts-match (neg + pos)
# Asserts D11 (no gender/dob leak), D1 (verification_level=phone), and the
# service-role grant fixes. Exits non-zero on any failure.
#
# Prereq: `supabase start` (and `supabase db reset` for a clean slate).
# Usage:  ./scripts/test-phase1.sh
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "❌ $1"; exit 1; }
ok()   { echo "✓ $1"; }

echo "→ Reading local stack keys…"
STATUS_JSON="$(supabase status -o json)"
API_URL=$(node -e "console.log(JSON.parse(process.argv[1]).API_URL)" "$STATUS_JSON")
ANON=$(node -e "console.log(JSON.parse(process.argv[1]).ANON_KEY)" "$STATUS_JSON")
SERVICE=$(node -e "console.log(JSON.parse(process.argv[1]).SERVICE_ROLE_KEY)" "$STATUS_JSON")
[ -n "$API_URL" ] && [ -n "$ANON" ] && [ -n "$SERVICE" ] || fail "could not read stack keys (is the stack up?)"

EMAIL="phase1-$(date +%s)@hopon.local"
PASS="Test123456!"

echo "→ Ensure contacts-match is served (background)…"
if ! curl -s -o /dev/null "$API_URL/functions/v1/contacts-match" 2>/dev/null; then
  nohup supabase functions serve contacts-match >/tmp/hopon_fn_phase1.log 2>&1 &
  sleep 8
fi

echo "→ Create confirmed auth user via admin API…"
NU=$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true}")
U_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id||'')" "$NU")
[ -n "$U_ID" ] || fail "admin createUser failed: $NU"
ok "auth user created ($U_ID)"

echo "→ Sign in for a real access token…"
SESS=$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
JWT=$(node -e "console.log(JSON.parse(process.argv[1]).access_token||'')" "$SESS")
[ -n "$JWT" ] || fail "sign-in failed: $SESS"
ok "signed in"

echo "→ complete_signup (REST RPC)…"
CS=$(curl -s -X POST "$API_URL/rest/v1/rpc/complete_signup" \
  -H "apikey: $ANON" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"p_name":"Phase One","p_handle":"@phase1u","p_dob":"1994-03-03","p_gender":"woman","p_neighbourhood":"HSR Layout"}')
node -e '
  const r = JSON.parse(process.argv[1]); const o = Array.isArray(r) ? r[0] : r;
  if (!o || o.handle !== "@phase1u") { console.error("complete_signup bad response:", process.argv[1]); process.exit(1); }
  if ("gender" in o || "dob" in o) { console.error("D11 LEAK: gender/dob present in response"); process.exit(1); }
  if (o.verification_level !== "phone") { console.error("D1 FAIL: verification_level =", o.verification_level); process.exit(1); }
' "$CS"
ok "complete_signup ok — D11 (no gender/dob) + D1 (verification=phone) verified"

echo "→ contacts-match: invalid hash → expect 400…"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/functions/v1/contacts-match" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{"hashes":["tooshort"]}')
[ "$R" = "400" ] || fail "expected 400 for invalid hash, got $R"
ok "invalid hash rejected (400)"

echo "→ contacts-match: positive match against seed user u1 (@arjun.blr)…"
# Seed stores phone WITHOUT '+'; convention is sha256('+' || phone).
HASH=$(node -e "console.log(require('crypto').createHash('sha256').update('+919999999992').digest('hex'))")
MATCH=$(curl -s -X POST "$API_URL/functions/v1/contacts-match" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d "{\"hashes\":[\"$HASH\"]}")
node -e '
  const d = JSON.parse(process.argv[1]);
  if (d.synced_count !== 1) { console.error("synced_count != 1:", process.argv[1]); process.exit(1); }
  const hit = (d.matches||[]).find(m => m.handle === "@arjun.blr");
  if (!hit) { console.error("expected @arjun.blr match, got:", process.argv[1]); process.exit(1); }
  if ("gender" in hit || "dob" in hit) { console.error("D11 LEAK in match result"); process.exit(1); }
' "$MATCH"
ok "positive match returned @arjun.blr (service-role grants working, no D11 leak)"

echo ""
echo "✅ Phase 1 regression PASSED"
