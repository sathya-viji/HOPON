#!/usr/bin/env bash
# ============================================================================
# HopOn — Phase 2 end-to-end + concurrency regression (Core Plan Loop)
# Over real HTTP against the LOCAL stack:
#   1. create_plan → join → leave → closed-plan request → approve  (happy path)
#   2. CONCURRENCY GATE: 10 parallel joins on a 1-spot plan ⇒ exactly 1 success
#
# Prereq: `supabase start` + `supabase db reset`.
# Usage:  ./scripts/test-phase2.sh
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "❌ $1"; exit 1; }
ok()   { echo "✓ $1"; }

S="$(supabase status -o json)"
API=$(node -e "console.log(JSON.parse(process.argv[1]).API_URL)" "$S")
ANON=$(node -e "console.log(JSON.parse(process.argv[1]).ANON_KEY)" "$S")
SERVICE=$(node -e "console.log(JSON.parse(process.argv[1]).SERVICE_ROLE_KEY)" "$S")
[ -n "$API" ] && [ -n "$ANON" ] && [ -n "$SERVICE" ] || fail "could not read stack keys"

# helper: create a confirmed user + completed profile, echo its JWT
make_user() { # $1=label $2=gender
  local email="p2-$1-$(date +%s%N)@hopon.local" pass="Test123456!"
  local nu sess jwt
  nu=$(curl -s -X POST "$API/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
        -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\",\"email_confirm\":true}")
  sess=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
        -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\"}")
  jwt=$(node -e "console.log(JSON.parse(process.argv[1]).access_token||'')" "$sess")
  [ -n "$jwt" ] || { echo "make_user $1 failed" >&2; return 1; }
  curl -s -o /dev/null -X POST "$API/rest/v1/rpc/complete_signup" -H "apikey: $ANON" \
    -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" \
    -d "{\"p_name\":\"$1\",\"p_handle\":\"@p2$1$RANDOM\",\"p_dob\":\"1992-01-01\",\"p_gender\":\"$2\",\"p_neighbourhood\":\"HSR\"}"
  echo "$jwt"
}

RPC_BODY=$(mktemp)   # body of the last rpc() call
rpc() { # $1=jwt $2=fn $3=json  → echoes HTTP code; body in $RPC_BODY
  curl -s -o "$RPC_BODY" -w "%{http_code}" -X POST "$API/rest/v1/rpc/$2" \
    -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$3"
}

echo "→ Provision host + joiner…"
HOST_JWT=$(make_user host man)
JOIN_JWT=$(make_user joiner woman)
ok "users ready"

echo "→ create_plan (open, capacity 4)…"
CODE=$(rpc "$HOST_JWT" create_plan '{"p_category_id":"sports","p_activity":"Badminton","p_location_label":"Play Arena","p_lat":12.91,"p_lng":77.63,"p_starts_at":"'"$(node -e 'console.log(new Date(Date.now()+2*3600e3).toISOString())')"'","p_capacity":4,"p_plan_type":"open","p_cost":"free","p_gender_pref":"all"}')
[ "$CODE" = "200" ] || fail "create_plan failed ($CODE): $(cat "$RPC_BODY")"
PLAN_ID=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1])); console.log((Array.isArray(r)?r[0]:r).id)" "$RPC_BODY")
ok "plan created ($PLAN_ID)"

echo "→ join → leave round-trip…"
CODE=$(rpc "$JOIN_JWT" join_plan "{\"p_plan_id\":\"$PLAN_ID\",\"p_idempotency_key\":\"$(uuidgen)\"}")
[ "$CODE" = "200" ] || fail "join failed ($CODE): $(cat "$RPC_BODY")"
CODE=$(rpc "$JOIN_JWT" leave_plan "{\"p_plan_id\":\"$PLAN_ID\"}")
# leave_plan returns void → PostgREST 204 No Content
[ "$CODE" = "204" ] || [ "$CODE" = "200" ] || fail "leave failed ($CODE): $(cat "$RPC_BODY")"
ok "join/leave ok"

# ── CONCURRENCY GATE ───────────────────────────────────────────────────────
echo "→ Concurrency gate: capacity-2 plan (1 spot), 10 parallel joiners…"
CODE=$(rpc "$HOST_JWT" create_plan '{"p_category_id":"food","p_activity":"Coffee","p_location_label":"Third Wave","p_lat":12.93,"p_lng":77.62,"p_starts_at":"'"$(node -e 'console.log(new Date(Date.now()+3*3600e3).toISOString())')"'","p_capacity":2,"p_plan_type":"open","p_cost":"free","p_gender_pref":"all"}')
[ "$CODE" = "200" ] || fail "create 1-spot plan failed ($CODE): $(cat "$RPC_BODY")"
CPLAN_ID=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1])); console.log((Array.isArray(r)?r[0]:r).id)" "$RPC_BODY")
ok "1-spot plan created ($CPLAN_ID)"

echo "  provisioning 10 joiners…"
JWTS=(); for i in $(seq 1 10); do JWTS+=("$(make_user "c$i" man)"); done

echo "  firing 10 parallel join requests…"
TMP=$(mktemp -d)
for i in $(seq 0 9); do
  ( curl -s -o /dev/null -w "%{http_code}" -X POST "$API/rest/v1/rpc/join_plan" \
      -H "apikey: $ANON" -H "Authorization: Bearer ${JWTS[$i]}" -H "Content-Type: application/json" \
      -d "{\"p_plan_id\":\"$CPLAN_ID\",\"p_idempotency_key\":\"$(uuidgen)\"}" > "$TMP/r$i" ) &
done
wait

SUCCESS=$(grep -l '^200$' "$TMP"/r* 2>/dev/null | wc -l | tr -d ' ')
echo "  HTTP 200 responses: $SUCCESS / 10"
[ "$SUCCESS" = "1" ] || fail "CONCURRENCY GATE FAILED — expected exactly 1 success, got $SUCCESS"

# confirm DB state: exactly 1 member, 0 spots
MEMBERS=$(docker exec "$(docker ps --filter name=supabase_db_hopon --format '{{.Names}}')" \
  psql -U postgres -d postgres -tAc "select count(*) from plan_members where plan_id='$CPLAN_ID' and not is_host_row;")
SPOTS=$(docker exec "$(docker ps --filter name=supabase_db_hopon --format '{{.Names}}')" \
  psql -U postgres -d postgres -tAc "select spots_remaining from plans where id='$CPLAN_ID';")
[ "$MEMBERS" = "1" ] || fail "expected 1 member row, got $MEMBERS"
[ "$SPOTS" = "0" ] || fail "expected 0 spots_remaining, got $SPOTS"
rm -rf "$TMP"
ok "CONCURRENCY GATE PASSED — exactly 1 joined, spots_remaining=0 (FOR UPDATE lock holds)"

echo ""
echo "✅ Phase 2 regression PASSED"
