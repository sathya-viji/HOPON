/** Milliseconds in a Julian year (365.25 days), used for age calculation. */
export const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Time utilities — all functions accept ISO 8601 timestamp strings and return
 * values suitable for direct UI display or comparison.
 *
 * diffMins returns negative values for past timestamps — callers should treat
 * negative as expired/in-progress, not as an error condition.
 *
 * countdownLabel formats the same minutes value as a short display string
 * ("5m", "2h", "3d") for countdown chips and badges.
 */
export function diffMins(isoTimestamp: string): number {
  return Math.floor((new Date(isoTimestamp).getTime() - Date.now()) / 60_000);
}

export function timeAgo(isoTimestamp: string): string {
  const mins = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDate(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const isSameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameCalendarDay(d, now)) return `Today, ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameCalendarDay(d, tomorrow)) return `Tomorrow, ${time}`;

  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + `, ${time}`;
}

export function planDateLabel(isoTimestamp: string): string | null {
  const d = new Date(isoTimestamp);
  const now = new Date();

  const isSameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameCalendarDay(d, now)) return 'Today';

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameCalendarDay(d, tomorrow)) return 'Tomorrow';

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isTomorrow(isoTimestamp: string): boolean {
  const d = new Date(isoTimestamp);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  );
}

export function isToday(isoTimestamp: string): boolean {
  const d = new Date(isoTimestamp);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function countdownLabel(mins: number): string {
  if (mins <= 0) return 'NOW';
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (60 * 24))}d`;
}
