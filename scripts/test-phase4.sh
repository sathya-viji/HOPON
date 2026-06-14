#!/usr/bin/env bash
# ============================================================================
# HopOn — Phase 4 end-to-end regression (Trust Layer)
# Over real HTTP against the LOCAL stack:
#   end_plan (S3) • submit_endorsements (host + peer) • attendance marks •
#   familiar faces • endorsement summary • host no-show quorum vote
#
# Prereq: `supabase start` + `supabase db reset`.
# Usage:  ./scripts/test-phase4.sh
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

make_user() { # $1 label $2 gender → JWT
  local email="p4-$1-$(date +%s%N)@hopon.local" pass="Test123456!" nu sess jwt
  nu=$(curl -s -X POST "$API/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
        -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\",\"email_confirm\":true}")
  sess=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
        -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\"}")
  jwt=$(node -e "console.log(JSON.parse(process.argv[1]).access_token||'')" "$sess")
  [ -n "$jwt" ] || { echo "make_user $1 failed" >&2; return 1; }
  curl -s -o /dev/null -X POST "$API/rest/v1/rpc/complete_signup" -H "apikey: $ANON" \
    -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" \
    -d "{\"p_name\":\"$1\",\"p_handle\":\"@p4$1$RANDOM\",\"p_dob\":\"1992-01-01\",\"p_gender\":\"$2\",\"p_neighbourhood\":\"HSR\"}"
  echo "$jwt"
}
RPC_BODY=$(mktemp)
rpc() { curl -s -o "$RPC_BODY" -w "%{http_code}" -X POST "$API/rest/v1/rpc/$2" \
  -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$3"; }
uid_of() { node -e "const t=process.argv[1].split('.')[1];console.log(JSON.parse(Buffer.from(t,'base64').toString()).sub)" "$1"; }
ok2()  { [ "$1" = "200" ] || [ "$1" = "204" ] || fail "$2 ($1): $(cat "$RPC_BODY")"; }

echo "→ Provision host + 2 attendees…"
H=$(make_user host man); A=$(make_user ava woman); B=$(make_user ben man)
HID=$(uid_of "$H"); AID=$(uid_of "$A"); BID=$(uid_of "$B")
ok "users ready"

echo "→ create_plan + A,B join…"
CODE=$(rpc "$H" create_plan '{"p_category_id":"sports","p_activity":"Badminton","p_location_label":"Arena","p_lat":12.9,"p_lng":77.6,"p_starts_at":"'"$(node -e 'console.log(new Date(Date.now()+90*60e3).toISOString())')"'","p_capacity":6,"p_plan_type":"open","p_cost":"free","p_gender_pref":"all"}')
ok2 "$CODE" create_plan
PID=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log((Array.isArray(r)?r[0]:r).id)" "$RPC_BODY")
rpc "$A" join_plan "{\"p_plan_id\":\"$PID\",\"p_idempotency_key\":\"$(uuidgen)\"}" >/dev/null
rpc "$B" join_plan "{\"p_plan_id\":\"$PID\",\"p_idempotency_key\":\"$(uuidgen)\"}" >/dev/null
ok "plan $PID created, A+B joined"

echo "→ end_plan (S3)…"
CODE=$(rpc "$H" end_plan "{\"p_plan_id\":\"$PID\"}"); ok2 "$CODE" end_plan
ok "plan ended (host synthetic row + present mark)"

echo "→ submit_endorsements (host marks A,B present with tags)…"
CODE=$(rpc "$H" submit_endorsements "{\"p_plan_id\":\"$PID\",\"p_marks\":[{\"subject_id\":\"$AID\",\"result\":\"present\",\"tag\":\"Punctual\"},{\"subject_id\":\"$BID\",\"result\":\"present\",\"tag\":\"Good energy\"}]}")
ok2 "$CODE" submit_endorsements
ok "attendance + endorsements submitted"

echo "→ get_endorsement_summary(B) shows a tag…"
rpc "$H" get_endorsement_summary "{\"p_user_id\":\"$BID\"}" >/dev/null
node -e "const a=JSON.parse(require('fs').readFileSync(process.argv[1]));if(!Array.isArray(a)||a.length<1){console.error('summary:',JSON.stringify(a));process.exit(1)}" "$RPC_BODY" || fail "endorsement summary empty"
ok "endorsement summary returns tags"

echo "→ peer endorsement: A endorses B…"
CODE=$(rpc "$A" submit_endorsements "{\"p_plan_id\":\"$PID\",\"p_marks\":[{\"subject_id\":\"$BID\",\"tag\":\"Would join again\"}]}")
ok2 "$CODE" peer_endorse
ok "present peer A endorsed B (D6)"

echo "→ familiar faces formed (host + A + B = 3 pairs)…"
FF=$(docker exec "$(docker ps --filter name=supabase_db_hopon --format '{{.Names}}')" \
  psql -U postgres -d postgres -tAc "select count(*) from familiar_faces ff where ff.user_a_id in ('$HID','$AID','$BID') and ff.user_b_id in ('$HID','$AID','$BID');")
[ "$FF" = "3" ] || fail "expected 3 familiar-face pairs, got $FF"
ok "3 familiar-face pairs (host included, D5/DA)"

echo "→ host no-show quorum: A votes (2 present ⇒ 50% = 1 vote resolves)…"
CODE=$(rpc "$A" vote_host_noshow "{\"p_plan_id\":\"$PID\"}"); ok2 "$CODE" vote_host_noshow
HOSTMARK=$(docker exec "$(docker ps --filter name=supabase_db_hopon --format '{{.Names}}')" \
  psql -U postgres -d postgres -tAc "select result from attendance_marks where plan_id='$PID' and subject_id='$HID';")
[ "$HOSTMARK" = "noshow" ] || fail "host should be marked noshow after quorum, got '$HOSTMARK'"
ok "D7: quorum resolved — host marked no-show"

echo "→ host cannot vote on own no-show…"
CODE=$(rpc "$H" vote_host_noshow "{\"p_plan_id\":\"$PID\"}")
[ "$CODE" = "400" ] || fail "expected 400 host_cannot_vote, got $CODE"
grep -q "host_cannot_vote" "$RPC_BODY" || fail "expected host_cannot_vote: $(cat "$RPC_BODY")"
ok "host_cannot_vote enforced"

echo ""
echo "✅ Phase 4 regression PASSED"
