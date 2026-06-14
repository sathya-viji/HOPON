/**
 * Navigation param types — the complete typed surface area of the app's navigation.
 *
 * Every screen and its required/optional params are declared here. This is the
 * single source of truth for what screens exist and what data they require.
 * Always update this file before adding a screen to any navigator.
 *
 * Cross-stack screens (ProfileOther, FollowList, FamiliarFaces, ReportUser,
 * ReportPlan, Guidelines) are registered in multiple stacks intentionally —
 * see docs/NAVIGATION.md for the reasoning.
 *
 * Screens with `undefined` params take no arguments.
 * Screens with `{ param?: type } | undefined` accept optional params and must
 * handle route.params being undefined.
 */
import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type OnboardingStackParamList = {
  Splash: undefined;
  Login: undefined;
  SignupPhone: undefined;
  SignupOtp: { phone: string };
  SignupName: undefined;
  SignupDob: undefined;
  SignupGender: undefined;
  SignupPhoto: undefined;
  Interests: undefined;
  ContactsSync: undefined;
  PeopleToFollow: undefined;
  Neighbourhood: undefined;
  Terms: undefined;
  PrivacyPolicy: undefined;
  SettingsPrivacy: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  RecapsTab: NavigatorScreenParams<RecapsStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

/**
 * Plan detail flow — registered in every tab stack so that opening a plan
 * from Home, Recaps, or Profile keeps navigation (and the back button)
 * inside the originating tab.
 */
export type PlanFlowParamList = {
  Plan: { planId: string };
  PlanHost: { planId: string };
  PlanRequests: { planId: string };
  PlanEdit: { planId: string; location?: string; lat?: number; lng?: number };
  PlanCancelConfirm: { planId: string };
  PlanLeaveConfirm: { planId: string };
  PlanExpired: { planId: string };
  PlanEnded: { planId: string };
  PlanJoined: { planId: string };
  PlanRequested: { planId: string };
  Endorse: { planId: string };
  LocSearch: { returnTo: string };
  Chat: { planId: string };
};

export type HomeStackParamList = PlanFlowParamList & {
  Home: undefined;
  HomeEmpty: undefined;
  HomeMap: undefined;
  Search: undefined;
  PlanPosted: { planId: string; locationLabel?: string };
  PlanApproved: { planId: string };
  PlanDeclined: { planId: string };
  Notifications: undefined;
  Create: { location?: string; lat?: number; lng?: number } | undefined;
  ProfileOther: { userId: string };
  FollowList: { userId: string; tab: 'followers' | 'following' };
  FamiliarFaces: { userId: string };
  ReportUser: { userId: string };
  ReportPlan: { planId: string };
  Guidelines: undefined;
  RecapDetail: { recapId: string };
};

export type RecapsStackParamList = PlanFlowParamList & {
  Recaps: undefined;
  RecapPost: { planId?: string };
  RecapPosted: { recapId: string };
  RecapDetail: { recapId: string };
  StoryViewer: { storyId: string };
  CreateStory: undefined;
  ProfileOther: { userId: string };
};

export type ProfileStackParamList = PlanFlowParamList & {
  Profile: undefined;
  ProfileOther: { userId: string };
  RecapDetail: { recapId: string };
  ProfileEdit: undefined;
  ProfileIncomplete: undefined;
  ProfileNew: undefined;
  FollowList: { userId: string; tab: 'followers' | 'following' };
  FamiliarFaces: { userId: string };
  Settings: undefined;
  SettingsNeighbourhood: undefined;
  SettingsNotifications: undefined;
  SettingsPrivacy: undefined;
  SettingsBlocked: undefined;
  SettingsDelete: undefined;
  Terms: undefined;
  PrivacyPolicy: undefined;
  Guidelines: undefined;
  ReportUser: { userId: string };
  ReportPlan: { planId: string };
  ReportProblem: undefined;
};
