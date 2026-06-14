#!/usr/bin/env bash
# ============================================================================
# HopOn — Phase 6 end-to-end regression (Safety & Moderation)
# Over real HTTP: block (sever follow + invisibility) → unblock → report →
# emergency escalation Edge Function (auto-hide plan + audit) → suspension gate.
# Prereq: `supabase start` + `supabase db reset`.  Usage: ./scripts/test-phase6.sh
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

echo "→ Serving Edge Functions…"
pkill -f "supabase functions serve" 2>/dev/null || true; sleep 1
nohup supabase functions serve >/tmp/hopon_fn_phase6.log 2>&1 &
for i in $(seq 1 20); do
  R=$(curl -s -X POST "$API/functions/v1/emergency-escalation" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" -d '{}' 2>/dev/null || true)
  echo "$R" | grep -q "missing report_id" && break; sleep 1
done
echo "$R" | grep -q "missing report_id" || fail "Edge Functions did not come up: $R"
ok "functions serving"

make_user() {
  local email="p6-$1-$(date +%s%N)@hopon.local" pass="Test123456!" nu sess jwt
  nu=$(curl -s -X POST "$API/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\",\"email_confirm\":true}")
  sess=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\"}")
  jwt=$(node -e "console.log(JSON.parse(process.argv[1]).access_token||'')" "$sess")
  [ -n "$jwt" ] || { echo "make_user $1 failed" >&2; return 1; }
  curl -s -o /dev/null -X POST "$API/rest/v1/rpc/complete_signup" -H "apikey: $ANON" -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" \
    -d "{\"p_name\":\"$1\",\"p_handle\":\"@p6$1$RANDOM\",\"p_dob\":\"1992-01-01\",\"p_gender\":\"man\",\"p_neighbourhood\":\"HSR\"}"
  echo "$jwt"
}
RPC_BODY=$(mktemp)
rpc() { curl -s -o "$RPC_BODY" -w "%{http_code}" -X POST "$API/rest/v1/rpc/$2" -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$3"; }
fn() { curl -s -w "\n%{http_code}" -X POST "$API/functions/v1/$1" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" -d "$2"; }
uid_of() { node -e "const t=process.argv[1].split('.')[1];console.log(JSON.parse(Buffer.from(t,'base64').toString()).sub)" "$1"; }
ok2() { [ "$1" = "200" ] || [ "$1" = "204" ] || fail "$2 ($1): $(cat "$RPC_BODY")"; }

echo "→ Provision A + B…"
A=$(make_user a man); B=$(make_user b man); AID=$(uid_of "$A"); BID=$(uid_of "$B")
ok "users ready"

echo "→ B follows A, then A blocks B (sever + invisibility)…"
rpc "$B" follow_user "{\"p_user_id\":\"$AID\"}" >/dev/null
rpc "$A" block_user "{\"p_user_id\":\"$BID\"}" >/dev/null
[ "$(PSQL "select count(*) from follows where follower_id='$BID' and following_id='$AID'")" = "0" ] || fail "follow not severed"
# A cannot see B in users_public
CNT=$(curl -s "$API/rest/v1/users_public?id=eq.$BID&select=id" -H "apikey: $ANON" -H "Authorization: Bearer $A" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).length)")
[ "$CNT" = "0" ] || fail "blocked profile still visible ($CNT)"
ok "block severed follow + hid profile"

echo "→ A unblocks B (visibility restored)…"
rpc "$A" unblock_user "{\"p_user_id\":\"$BID\"}" >/dev/null
CNT=$(curl -s "$API/rest/v1/users_public?id=eq.$BID&select=id" -H "apikey: $ANON" -H "Authorization: Bearer $A" | node -e "console.log(JSON.parse(require('fs').readFileSync(0)).length)")
[ "$CNT" = "1" ] || fail "profile not restored after unblock"
ok "unblock restored visibility"

echo "→ submit_report + rate-limit path…"
CODE=$(rpc "$B" submit_report "{\"p_target_type\":\"user\",\"p_target_id\":\"$AID\",\"p_reason\":\"spam\"}"); ok2 "$CODE" submit_report
[ "$(PSQL "select count(*) from reports where target_id='$AID'")" = "1" ] || fail "report not recorded"
ok "report recorded"

echo "→ emergency report → escalated + Edge escalation (auto-hide plan + audit)…"
# B hosts a plan; emergency-report it
CODE=$(rpc "$B" create_plan '{"p_category_id":"food","p_activity":"X","p_location_label":"L","p_lat":12.9,"p_lng":77.6,"p_starts_at":"'"$(node -e 'console.log(new Date(Date.now()+3600e3).toISOString())')"'","p_capacity":4,"p_plan_type":"open","p_cost":"free","p_gender_pref":"all"}')
ok2 "$CODE" create_plan
PID=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log((Array.isArray(r)?r[0]:r).id)" "$RPC_BODY")
rpc "$A" submit_report "{\"p_target_type\":\"plan\",\"p_target_id\":\"$PID\",\"p_reason\":\"emergency\",\"p_notes\":\"unsafe\"}" >/dev/null
REP=$(PSQL "select id from reports where target_id='$PID' and reason='emergency' limit 1")
[ "$(PSQL "select status from reports where id='$REP'")" = "escalated" ] || fail "emergency not escalated"
# invoke the Edge Function (prod: fired by webhook)
OUT=$(fn emergency-escalation "{\"report_id\":\"$REP\",\"target_type\":\"plan\",\"target_id\":\"$PID\"}")
echo "${OUT%$'\n'*}" | grep -q '"status":"escalated"' || fail "escalation fn failed: ${OUT%$'\n'*}"
[ "$(PSQL "select is_hidden from plans where id='$PID'")" = "t" ] || fail "plan not auto-hidden"
[ "$(PSQL "select count(*) from audit_logs where action='emergency_escalated' and target_id='$PID'")" = "1" ] || fail "no escalation audit row"
ok "emergency escalated → plan hidden + audit (SMS skipped, no Twilio locally)"

echo "→ suspension gate: suspend B, B cannot post a recap…"
PSQL "select set_account_status('$BID','suspended','test',null)" >/dev/null
CODE=$(rpc "$B" create_plan '{"p_category_id":"food","p_activity":"Y","p_location_label":"L","p_lat":12.9,"p_lng":77.6,"p_starts_at":"'"$(node -e 'console.log(new Date(Date.now()+3600e3).toISOString())')"'","p_capacity":4,"p_plan_type":"open","p_cost":"free","p_gender_pref":"all"}')
[ "$CODE" = "400" ] || fail "suspended user create_plan should fail, got $CODE"
grep -q "account_suspended" "$RPC_BODY" || fail "expected account_suspended: $(cat "$RPC_BODY")"
ok "suspended user blocked from acting"

echo ""
echo "✅ Phase 6 regression PASSED"
