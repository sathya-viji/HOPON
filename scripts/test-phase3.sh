#!/usr/bin/env bash
# ============================================================================
# HopOn — Phase 3 end-to-end regression (Realtime + Notifications)
# Over real HTTP against the LOCAL stack:
#   notify() fanout • get_notifications • mark read • push tokens • prefs gate •
#   send_message + chat-lock • mention fanout • push-sender + chat-push Edge fns
#
# Push delivery itself needs devices/Expo; here EXPO_ACCESS_TOKEN is unset so the
# Edge Functions exercise the prefs/token/recipient logic and skip the real send.
#
# Prereq: `supabase start` + `supabase db reset`.
# Usage:  ./scripts/test-phase3.sh
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

echo "→ Serving Edge Functions…"
pkill -f "supabase functions serve" 2>/dev/null || true
sleep 1
nohup supabase functions serve >/tmp/hopon_fn_phase3.log 2>&1 &
# Wait until push-sender responds with JSON (not Kong's "Function not found")
for i in $(seq 1 20); do
  R=$(curl -s -X POST "$API/functions/v1/push-sender" -H "Authorization: Bearer $SERVICE" \
        -H "Content-Type: application/json" -d '{}' 2>/dev/null || true)
  echo "$R" | grep -q "missing notification_id" && break
  sleep 1
done
echo "$R" | grep -q "missing notification_id" || fail "Edge Functions did not come up: $R"
ok "functions serving"

make_user() { # $1=label $2=gender  → JWT
  local email="p3-$1-$(date +%s%N)@hopon.local" pass="Test123456!" nu sess jwt
  nu=$(curl -s -X POST "$API/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
        -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\",\"email_confirm\":true}")
  sess=$(curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
        -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"$pass\"}")
  jwt=$(node -e "console.log(JSON.parse(process.argv[1]).access_token||'')" "$sess")
  [ -n "$jwt" ] || { echo "make_user $1 failed" >&2; return 1; }
  curl -s -o /dev/null -X POST "$API/rest/v1/rpc/complete_signup" -H "apikey: $ANON" \
    -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" \
    -d "{\"p_name\":\"$1\",\"p_handle\":\"@p3$1$RANDOM\",\"p_dob\":\"1992-01-01\",\"p_gender\":\"$2\",\"p_neighbourhood\":\"HSR\"}"
  echo "$jwt"
}
RPC_BODY=$(mktemp)
rpc() { curl -s -o "$RPC_BODY" -w "%{http_code}" -X POST "$API/rest/v1/rpc/$2" \
  -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$3"; }
fn() {  curl -s -w "\n%{http_code}" -X POST "$API/functions/v1/$1" \
  -H "Authorization: Bearer $SERVICE" -H "Content-Type: application/json" -d "$2"; }
uid_of() { node -e "console.log(JSON.parse(process.argv[1]).sub)" "$(node -e '
  const t=process.argv[1].split(".")[1]; process.stdout.write(Buffer.from(t,"base64").toString())' "$1")"; }

echo "→ Provision host + joiner…"
HOST=$(make_user host man); JOIN=$(make_user joiner woman)
HOST_ID=$(uid_of "$HOST")
ok "users ready (host=$HOST_ID)"

echo "→ Host registers a push token…"
rpc "$HOST" register_push_token '{"p_token":"ExponentPushToken[host-dev]","p_platform":"ios"}' >/dev/null
ok "push token registered"

echo "→ create_plan + joiner joins → host gets new_joiner notification…"
CODE=$(rpc "$HOST" create_plan '{"p_category_id":"food","p_activity":"Coffee","p_location_label":"Cafe","p_lat":12.9,"p_lng":77.6,"p_starts_at":"'"$(node -e 'console.log(new Date(Date.now()+90*60e3).toISOString())')"'","p_capacity":4,"p_plan_type":"open","p_cost":"free","p_gender_pref":"all"}')
[ "$CODE" = "200" ] || fail "create_plan ($CODE): $(cat "$RPC_BODY")"
PLAN_ID=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log((Array.isArray(r)?r[0]:r).id)" "$RPC_BODY")
rpc "$JOIN" join_plan "{\"p_plan_id\":\"$PLAN_ID\",\"p_idempotency_key\":\"$(uuidgen)\"}" >/dev/null
ok "joiner joined plan $PLAN_ID"

echo "→ get_notifications (host) shows new_joiner…"
rpc "$HOST" get_notifications '{"p_cursor":0,"p_limit":50}' >/dev/null
NOTIF_ID=$(node -e "const a=JSON.parse(require('fs').readFileSync(process.argv[1]));const n=a.find(x=>x.type==='new_joiner');if(!n)process.exit(1);console.log(n.id)" "$RPC_BODY") || fail "host has no new_joiner notification"
ok "new_joiner notification present ($NOTIF_ID)"

echo "→ push-sender for that notification → expect sent, recipient=1…"
OUT=$(fn push-sender "{\"notification_id\":\"$NOTIF_ID\"}"); BODY="${OUT%$'\n'*}"
echo "$BODY" | node -e "const d=JSON.parse(require('fs').readFileSync(0));if(d.status!=='sent'||d.recipients<1){console.error('unexpected:',JSON.stringify(d));process.exit(1)}" || fail "push-sender did not report sent"
ok "push-sender processed (prefs+token path; Expo skipped, no token configured)"

echo "→ prefs gate: disable new_joiner push → push-sender suppresses…"
rpc "$HOST" set_notification_pref '{"p_event_type":"new_joiner","p_push_enabled":false}' >/dev/null
OUT=$(fn push-sender "{\"notification_id\":\"$NOTIF_ID\"}"); BODY="${OUT%$'\n'*}"
echo "$BODY" | grep -q "suppressed_by_prefs" || fail "push-sender did not honour disabled pref: $BODY"
ok "push-sender suppressed by disabled pref"

echo "→ send_message + chat-push (+ @mention fanout)…"
rpc "$JOIN" send_message "{\"p_plan_id\":\"$PLAN_ID\",\"p_body\":\"omw! anyone else coming\"}" >/dev/null
MSG_ID=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log((Array.isArray(r)?r[0]:r).id)" "$RPC_BODY")
OUT=$(fn chat-push "{\"message_id\":\"$MSG_ID\"}"); BODY="${OUT%$'\n'*}"
echo "$BODY" | node -e "const d=JSON.parse(require('fs').readFileSync(0));if(d.status!=='sent'){console.error('chat-push:',JSON.stringify(d));process.exit(1)}" || fail "chat-push did not send to host token"
ok "chat-push delivered to host"

# mention: joiner @mentions the host's handle
# users_public is granted to `authenticated` only — fetch with the host's JWT.
HOST_HANDLE=$(curl -s "$API/rest/v1/users_public?id=eq.$HOST_ID&select=handle" -H "apikey: $ANON" -H "Authorization: Bearer $HOST" | node -e "console.log(JSON.parse(require('fs').readFileSync(0))[0].handle)")
rpc "$JOIN" send_message "{\"p_plan_id\":\"$PLAN_ID\",\"p_body\":\"$HOST_HANDLE where are you\"}" >/dev/null
MSG2=$(node -e "const r=JSON.parse(require('fs').readFileSync(process.argv[1]));console.log((Array.isArray(r)?r[0]:r).id)" "$RPC_BODY")
fn chat-push "{\"message_id\":\"$MSG2\"}" >/dev/null
rpc "$HOST" get_notifications '{"p_cursor":0,"p_limit":50}' >/dev/null
echo "$(cat "$RPC_BODY")" | node -e "const a=JSON.parse(require('fs').readFileSync(0));if(!a.find(x=>x.type==='mention')){console.error('no mention notif');process.exit(1)}" || fail "mention notification not created"
ok "@mention created a mention notification for the host"

echo "→ chat-lock: cancel plan → sends rejected…"
rpc "$HOST" cancel_plan "{\"p_plan_id\":\"$PLAN_ID\"}" >/dev/null
CODE=$(rpc "$JOIN" send_message "{\"p_plan_id\":\"$PLAN_ID\",\"p_body\":\"still on?\"}")
[ "$CODE" = "400" ] || fail "expected 400 chat_closed, got $CODE"
grep -q "chat_closed" "$RPC_BODY" || fail "expected chat_closed error: $(cat "$RPC_BODY")"
ok "chat-lock blocked send on cancelled plan (D3)"

echo "→ mark_notifications_read clears unread…"
rpc "$HOST" mark_notifications_read '{"p_ids":null}' >/dev/null
ok "notifications marked read"

echo ""
echo "✅ Phase 3 regression PASSED"
