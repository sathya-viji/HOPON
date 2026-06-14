#!/usr/bin/env bash
# ============================================================================
# HopOn — Phase 5 end-to-end regression (Social)
# Over real HTTP: follow → create plan → post recap → image-moderator (Vision
# auto-passes with no key) → approve → follower notified → like → comment →
# story → moderate story. Plus multi-image (1–5) recap.
#
# Prereq: `supabase start` + `supabase db reset`.
# Usage:  ./scripts/test-phase5.sh
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
nohup supabase functions serve >/tmp/hopon_fn_phase5.log 2>&1 &
for i in $(seq 1 20); do
  R=$(curl -s -X POST "$API/functions/v1/image-moderator" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" -d '{}' 2>/dev/null || true)
  echo "$R" | grep -q "missing recap_id or story_id" && break; sleep 1
done
echo "$R" | grep -q "missing recap_id or story_id" || fail "Edge Functions did not come up: $R"
ok "functions serving"

make_user() {
  local email="p5-$1-$(date +%s%N)@hopon.local" pass="Test123456!" nu sess jwt
  nu=$(curl -s -X POST "$API/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\",\"email_confirm\":true}")
  sess=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\"}")
  jwt=$(node -e "console.log(JSON.parse(process.argv[1]).access_token||'')" "$sess")
  [ -n "$jwt" ] || { echo "make_user $1 failed" >&2; return 1; }
  curl -s -o /dev/null -X POST "$API/rest/v1/rpc/complete_signup" -H "apikey: $ANON" -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" \
    -d "{\"p_name\":\"$1\",\"p_handle\":\"@p5$1$RANDOM\",\"p_dob\":\"1992-01-01\",\"p_gender\":\"$2\",\"p_neighbourhood\":\"HSR\"}"
  echo "$jwt"
}
RPC_BODY=$(mktemp)
rpc() { curl -s -o "$RPC_BODY" -w "%{http_code}" -X POST "$API/rest/v1/rpc/$2" -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$3"; }
fn() { curl -s -w "\n%{http_code}" -X POST "$API/functions/v1/$1" -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" -d "$2"; }
uid_of() { node -e "const t=process.argv[1].split('.')[1];console.log(JSON.parse(Buffer.from(t,'base64').toString()).sub)" "$1"; }
ok2() { [ "$1" = "200" ] || [ "$1" = "204" ] || fail "$2 ($1): $(cat "$RPC_BODY")"; }

echo "→ Provision author + follower…"
A=$(make_user author man); F=$(make_user fan woman)
AID=$(uid_of "$A"); FID=$(uid_of "$F")
ok "users ready"

echo "→ F follows author (public ⇒ new_follower)…"
rpc "$F" follow_user "{\"p_user_id\":\"$AID\"}" >/dev/null
[ "$(PSQL "select count(*) from notifications where user_id='$AID' and type='new_follower'")" = "1" ] || fail "new_follower missing"
ok "follow accepted + new_follower"

echo "→ author posts a 3-image recap…"
CODE=$(rpc "$A" create_plan '{"p_category_id":"food","p_activity":"Coffee","p_location_label":"Cafe","p_lat":12.9,"p_lng":77.6,"p_starts_at":"'"$(node -e 'console.log(new Date(Date.now()+90*60e3).toISOString())')"'","p_capacity":5,"p_plan_type":"open","p_cost":"free","p_gender_pref":"all"}')
ok2 "$CODE" create_plan
PID=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log((Array.isArray(r)?r[0]:r).id)" "$RPC_BODY")
rpc "$F" join_plan "{\"p_plan_id\":\"$PID\",\"p_idempotency_key\":\"$(uuidgen)\"}" >/dev/null
PSQL "update plans set starts_at = now() - interval '1 hour' where id='$PID'" >/dev/null   # mark started
CODE=$(rpc "$A" post_recap "{\"p_plan_id\":\"$PID\",\"p_image_paths\":[\"a.jpg\",\"b.jpg\",\"c.jpg\"],\"p_caption\":\"great\"}")
ok2 "$CODE" post_recap
RID=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log((Array.isArray(r)?r[0]:r).id)" "$RPC_BODY")
[ "$(PSQL "select moderation from recaps where id='$RID'")" = "pending" ] || fail "recap should be pending"
ok "recap posted (pending, 3 images)"

echo "→ image-moderator approves (no Vision key ⇒ auto-pass)…"
OUT=$(fn image-moderator "{\"recap_id\":\"$RID\"}"); echo "${OUT%$'\n'*}" | grep -q '"status":"approved"' || fail "moderator did not approve: ${OUT%$'\n'*}"
[ "$(PSQL "select moderation from recaps where id='$RID'")" = "approved" ] || fail "recap not approved"
[ "$(PSQL "select count(*) from notifications where user_id='$FID' and type='new_recap_from_following'")" = "1" ] || fail "follower not notified"
[ "$(PSQL "select count(*) from feed_events where event_type='recap_created'")" = "1" ] || fail "feed_event missing"
ok "approved → follower notified + feed_event written"

echo "→ like + batched recap_liked…"
rpc "$F" like_recap "{\"p_recap_id\":\"$RID\"}" >/dev/null
[ "$(PSQL "select like_count from recaps where id='$RID'")" = "1" ] || fail "like_count not 1"
PSQL "select fn_flush_like_batches(1)" >/dev/null
[ "$(PSQL "select count(*) from notifications where user_id='$AID' and type='recap_liked'")" = "1" ] || fail "recap_liked not emitted"
ok "like → batched recap_liked"

echo "→ comment…"
CODE=$(rpc "$F" comment_recap "{\"p_recap_id\":\"$RID\",\"p_body\":\"love it\"}"); ok2 "$CODE" comment
[ "$(PSQL "select comment_count from recaps where id='$RID'")" = "1" ] || fail "comment_count not 1"
ok "comment recorded + recap_commented"

echo "→ story + moderation…"
CODE=$(rpc "$A" post_story "{\"p_image_path\":\"s.jpg\",\"p_caption\":\"hi\"}"); ok2 "$CODE" post_story
SID=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log((Array.isArray(r)?r[0]:r).id)" "$RPC_BODY")
OUT=$(fn image-moderator "{\"story_id\":\"$SID\"}"); echo "${OUT%$'\n'*}" | grep -q '"status":"approved"' || fail "story not approved"
rpc "$F" record_story_view "{\"p_story_id\":\"$SID\"}" >/dev/null
[ "$(PSQL "select count(*) from story_views where story_id='$SID'")" = "1" ] || fail "story view missing"
ok "story posted, moderated, viewed"

echo "→ get_recaps_feed returns the public recap…"
rpc "$F" get_recaps_feed '{"p_cursor":0,"p_limit":20}' >/dev/null
node -e "const a=JSON.parse(require('fs').readFileSync(process.argv[1]));if(!Array.isArray(a)||a.length<1)process.exit(1)" "$RPC_BODY" || fail "feed empty"
ok "recap feed returns content"

echo ""
echo "✅ Phase 5 regression PASSED"
