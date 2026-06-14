/**
 * Push notification titles per notif_type (execution doc Part 8 copy table).
 * The notification row's `body` is already the rendered body; this supplies the
 * title shown above it. Unmapped types fall back to a neutral title.
 */
export const NOTIF_TITLES: Record<string, string> = {
  plan_posted: 'Plan posted',
  new_joiner: 'Someone hopped on!',
  join_request: 'New request',
  joiner_left: 'Someone left',
  plan_full: 'Your plan is full 🎉',
  plan_starting_soon_host: 'Starting in 1 hour',
  plan_started_host: "It's time!",
  plan_ended_host: 'Plan ended — your turn',
  endorse_reminder: 'Endorse your crew',
  recap_reminder: 'Share a moment?',
  plan_cancelled_confirm: 'Plan cancelled',
  host_marked_absent: 'Attendance flagged',
  new_recap_on_your_plan: 'Recap posted',
  request_approved: "You're in! 🎉",
  request_declined: 'Request declined',
  plan_updated: 'Plan updated',
  plan_cancelled: 'Plan cancelled',
  plan_starting_soon_joiner: 'Starting in 1 hour',
  plan_starting_15: 'Starting in 15 min',
  plan_ended_joiner: 'Hope it was great!',
  marked_noshow: 'Marked as no-show',
  mention: 'You were mentioned',
  endorsement_received: 'New endorsements 🌟',
  attendance_score_improved: 'Score up',
  attendance_score_dropped: 'Score dropped',
  new_familiar_face: 'New familiar face',
  recap_liked: 'New likes on your recap',
  recap_commented: 'New comment',
  recap_comment_replied: 'New comment',
  new_recap_from_following: 'New recap',
  story_expiring_soon: 'Your story expires soon',
  new_follower: 'New follower',
  follow_request: 'Follow request',
  follow_accepted: 'Follow accepted',
  following_posted_plan: 'New plan from someone you follow',
  welcome: 'Welcome to hopon 👋',
  profile_incomplete: 'One last thing',
  first_plan_nudge: 'Ready to hop on?',
  contact_joined: 'A contact joined hopon',
  plan_expired_host: 'Your plan expired',
  plan_expired_joiner: 'Plan may not have happened',
};

export function titleFor(type: string): string {
  return NOTIF_TITLES[type] ?? 'hopon';
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Sends a batch to Expo Push. Returns the tokens Expo reports as
 * DeviceNotRegistered (caller should prune them). In local/CI with no
 * EXPO_ACCESS_TOKEN configured, skips the network call and returns [].
 */
export async function sendExpoPush(messages: ExpoMessage[]): Promise<string[]> {
  if (messages.length === 0) return [];
  const token = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (!token) {
    console.log(`[push] EXPO_ACCESS_TOKEN unset — skipping ${messages.length} message(s) (local/CI)`);
    return [];
  }
  const dead: string[] = [];
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(chunk),
    });
    const json = await res.json().catch(() => ({}));
    const data = (json?.data ?? []) as Array<{ status?: string; details?: { error?: string } }>;
    data.forEach((receipt, idx) => {
      if (receipt?.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx].to);
    });
  }
  return dead;
}
