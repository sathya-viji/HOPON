import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { ProfileStackParamList } from './types';
import { STACK_SCREEN_OPTIONS } from './transitions';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { ProfileOtherScreen } from '@/screens/profile/ProfileOtherScreen';
import { ProfileNewScreen } from '@/screens/profile/ProfileNewScreen';
import { ProfileIncompleteScreen } from '@/screens/profile/ProfileIncompleteScreen';
import { ProfileEditScreen } from '@/screens/profile/ProfileEditScreen';
import { FollowListScreen } from '@/screens/profile/FollowListScreen';
import { FamiliarFacesScreen } from '@/screens/profile/FamiliarFacesScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { SettingsNeighbourhoodScreen } from '@/screens/settings/SettingsNeighbourhoodScreen';
import { SettingsNotificationsScreen } from '@/screens/settings/SettingsNotificationsScreen';
import { SettingsPrivacyScreen } from '@/screens/settings/SettingsPrivacyScreen';
import { SettingsBlockedScreen } from '@/screens/settings/SettingsBlockedScreen';
import { SettingsDeleteScreen } from '@/screens/settings/SettingsDeleteScreen';
import { TermsScreen } from '@/screens/settings/TermsScreen';
import { PrivacyPolicyScreen } from '@/screens/settings/PrivacyPolicyScreen';
import { GuidelinesScreen } from '@/screens/settings/GuidelinesScreen';
import { ReportUserScreen } from '@/screens/settings/ReportUserScreen';
import { ReportPlanScreen } from '@/screens/settings/ReportPlanScreen';
import { ReportProblemScreen } from '@/screens/settings/ReportProblemScreen';
import { PlanScreen } from '@/screens/plan/PlanScreen';
import { PlanHostScreen } from '@/screens/plan/PlanHostScreen';
import { PlanRequestsScreen } from '@/screens/plan/PlanRequestsScreen';
import { PlanEditScreen } from '@/screens/plan/PlanEditScreen';
import { PlanCancelConfirmScreen } from '@/screens/plan/PlanCancelConfirmScreen';
import { PlanLeaveConfirmScreen } from '@/screens/plan/PlanLeaveConfirmScreen';
import { PlanExpiredScreen } from '@/screens/plan/PlanExpiredScreen';
import { PlanEndedScreen } from '@/screens/plan/PlanEndedScreen';
import { PlanJoinedScreen } from '@/screens/plan/PlanJoinedScreen';
import { PlanRequestedScreen } from '@/screens/plan/PlanRequestedScreen';
import { EndorseScreen } from '@/screens/plan/EndorseScreen';
import { LocSearchScreen } from '@/screens/home/LocSearchScreen';
import { ChatScreen } from '@/screens/chat/ChatScreen';
import { RecapDetailScreen } from '@/screens/recaps/RecapDetailScreen';

const Stack = createStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={STACK_SCREEN_OPTIONS} initialRouteName="Profile">
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ProfileOther" component={ProfileOtherScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="ProfileIncomplete" component={ProfileIncompleteScreen} />
      <Stack.Screen name="ProfileNew" component={ProfileNewScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="FamiliarFaces" component={FamiliarFacesScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SettingsNeighbourhood" component={SettingsNeighbourhoodScreen} />
      <Stack.Screen name="SettingsNotifications" component={SettingsNotificationsScreen} />
      <Stack.Screen name="SettingsPrivacy" component={SettingsPrivacyScreen} />
      <Stack.Screen name="SettingsBlocked" component={SettingsBlockedScreen} />
      <Stack.Screen name="SettingsDelete" component={SettingsDeleteScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Guidelines" component={GuidelinesScreen} />
      <Stack.Screen name="ReportUser" component={ReportUserScreen} />
      <Stack.Screen name="ReportPlan" component={ReportPlanScreen} />
      <Stack.Screen name="ReportProblem" component={ReportProblemScreen} />
      <Stack.Screen name="Plan" component={PlanScreen} />
      <Stack.Screen name="PlanHost" component={PlanHostScreen} />
      <Stack.Screen name="PlanRequests" component={PlanRequestsScreen} />
      <Stack.Screen name="PlanEdit" component={PlanEditScreen} />
      <Stack.Screen name="PlanCancelConfirm" component={PlanCancelConfirmScreen} />
      <Stack.Screen name="PlanLeaveConfirm" component={PlanLeaveConfirmScreen} />
      <Stack.Screen name="PlanExpired" component={PlanExpiredScreen} />
      <Stack.Screen name="PlanEnded" component={PlanEndedScreen} />
      <Stack.Screen name="PlanJoined" component={PlanJoinedScreen} />
      <Stack.Screen name="PlanRequested" component={PlanRequestedScreen} />
      <Stack.Screen name="Endorse" component={EndorseScreen} />
      <Stack.Screen name="LocSearch" component={LocSearchScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="RecapDetail" component={RecapDetailScreen} />
    </Stack.Navigator>
  );
}
