#!/usr/bin/env bash
# ============================================================================
# HopOn — Phase 7 end-to-end regression (Growth & Launch Hardening)
# Over real HTTP: create_invites • feature_flags read • is_feature_enabled •
# pen-check spot-checks (client cannot read audit_logs/reports/contact_hashes).
# Prereq: `supabase start` + `supabase db reset`.  Usage: ./scripts/test-phase7.sh
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
fail() { echo "❌ $1"; exit 1; }
ok()   { echo "✓ $1"; }
PSQL() { docker exec "$(docker ps --filter name=supabase_db_hopon --format '{{.Names}}')" psql -U postgres -d postgres -tAc "$1"; }

S="$(supabase status -o json)"
API=$(node -e "console.log(JSON.parse(process.argv[1]).API_URL)" "$S")
ANON=$(node -e "console.log(JSON.parse(process.argv[1]).ANON_KEY)" "$S")
SERVICE=$(node -e "console.log(JSON.parse(process.argv[1]).SERVICE_ROLE_KEY)" "$S")
[ -n "$API" ] && [ -n "$ANON" ] && [ -n "$SERVICE" ] || fail "could not read stack keys"

make_user() {
  local email="p7-$1-$(date +%s%N)@hopon.local" pass="Test123456!" nu sess jwt
  nu=$(curl -s -X POST "$API/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\",\"email_confirm\":true}")
  sess=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\"}")
  jwt=$(node -e "console.log(JSON.parse(process.argv[1]).access_token||'')" "$sess")
  [ -n "$jwt" ] || { echo "make_user $1 failed" >&2; return 1; }
  curl -s -o /dev/null -X POST "$API/rest/v1/rpc/complete_signup" -H "apikey: $ANON" -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" \
    -d "{\"p_name\":\"$1\",\"p_handle\":\"@p7$1$RANDOM\",\"p_dob\":\"1992-01-01\",\"p_gender\":\"man\",\"p_neighbourhood\":\"HSR\"}"
  echo "$jwt"
}
RPC_BODY=$(mktemp)
rpc() { curl -s -o "$RPC_BODY" -w "%{http_code}" -X POST "$API/rest/v1/rpc/$2" -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$3"; }

echo "→ Provision user…"
A=$(make_user a man); ok "user ready"

echo "→ create_invites (stranger hash stored)…"
HASH=$(node -e "console.log(require('crypto').createHash('sha256').update('+910000077777').digest('hex'))")
CODE=$(rpc "$A" create_invites "{\"p_phone_hashes\":[\"$HASH\"]}")
[ "$CODE" = "200" ] || fail "create_invites ($CODE): $(cat "$RPC_BODY")"
[ "$(cat "$RPC_BODY")" = "1" ] || fail "expected 1 invite stored, got $(cat "$RPC_BODY")"
ok "invite stored for non-user contact"

echo "→ feature flags read + rollout…"
PSQL "insert into feature_flags(flag_name,enabled,rollout_pct) values ('beta_feed',true,100) on conflict (flag_name) do update set enabled=true,rollout_pct=100" >/dev/null
# client can read flags table
CNT=$(curl -s "$API/rest/v1/feature_flags?flag_name=eq.beta_feed&select=enabled" -H "apikey: $ANON" -H "Authorization: Bearer $A" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).length)")
[ "$CNT" = "1" ] || fail "feature_flags not readable by client"
CODE=$(rpc "$A" is_feature_enabled '{"p_flag":"beta_feed"}')
[ "$CODE" = "200" ] && [ "$(cat "$RPC_BODY")" = "true" ] || fail "is_feature_enabled(beta_feed) not true: $(cat "$RPC_BODY")"
ok "feature flag readable + is_feature_enabled works"

echo "→ pen-check spot-checks (client cannot read protected tables)…"
for t in audit_logs reports contact_hashes pending_jobs feed_events; do
  R=$(curl -s -o /dev/null -w "%{http_code}" "$API/rest/v1/$t?select=*&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $A")
  # PostgREST returns 401/403/404 (no privilege) — never 200 with rows
  [ "$R" != "200" ] || fail "$t was readable by client (HTTP 200)!"
  ok "  $t not client-readable ($R)"
done

echo "→ gender/dob never exposed via users_public…"
COLS=$(curl -s "$API/rest/v1/users_public?limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $A" | node -e "const a=JSON.parse(require('fs').readFileSync(0));console.log(a[0]?Object.keys(a[0]).join(','):'')")
echo "$COLS" | grep -qE "gender|dob" && fail "gender/dob leaked in users_public!" || ok "users_public clean (no gender/dob)"

echo ""
echo "✅ Phase 7 regression PASSED"
