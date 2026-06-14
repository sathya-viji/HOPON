/**
 * User domain type — the core identity model.
 *
 * attendanceScore is null for new users who haven't attended enough plans
 * to generate a meaningful score. UI should treat null as "no score yet",
 * not as zero.
 *
 * familiarFaceIds lists user IDs who have attended a plan together with this
 * user. This powers the Familiar Faces surface (trust signals on plan detail,
 * profile, and endorsements).
 *
 * profileVisibility and planVisibility are privacy settings that will be
 * enforced server-side; the client reads them to adjust what it displays
 * on other users' profiles.
 */
export interface User {
  id: string;
  name: string;
  handle: string;
  avatarUri?: string;
  neighbourhood: string;
  attendanceScore: number | null;
  isVerified: boolean;
  bio?: string;
  interests: string[];
  socialLinks?: {
    instagram?: string;
    linkedin?: string;
    facebook?: string;
  };
  plansHosted: number;
  plansAttended: number;
  peopleMet: number;
  familiarFaceIds: string[];
  endorsements: { label: string; count: number }[];
  profileVisibility: 'everyone' | 'followers' | 'nobody';
  planVisibility: 'everyone' | 'followers';
}
