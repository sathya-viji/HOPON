import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { HomeStackParamList } from './types';
import { STACK_SCREEN_OPTIONS } from './transitions';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { HomeEmptyScreen } from '@/screens/home/HomeEmptyScreen';
import { HomeMapScreen } from '@/screens/home/HomeMapScreen';
import { SearchScreen } from '@/screens/home/SearchScreen';
import { CreateScreen } from '@/screens/home/CreateScreen';
import { PlanScreen } from '@/screens/plan/PlanScreen';
import { PlanHostScreen } from '@/screens/plan/PlanHostScreen';
import { PlanJoinedScreen } from '@/screens/plan/PlanJoinedScreen';
import { PlanRequestedScreen } from '@/screens/plan/PlanRequestedScreen';
import { PlanRequestsScreen } from '@/screens/plan/PlanRequestsScreen';
import { PlanCancelConfirmScreen } from '@/screens/plan/PlanCancelConfirmScreen';
import { PlanLeaveConfirmScreen } from '@/screens/plan/PlanLeaveConfirmScreen';
import { PlanEditScreen } from '@/screens/plan/PlanEditScreen';
import { PlanExpiredScreen } from '@/screens/plan/PlanExpiredScreen';
import { PlanEndedScreen } from '@/screens/plan/PlanEndedScreen';
import { PlanPostedScreen } from '@/screens/plan/PlanPostedScreen';
import { PlanApprovedScreen } from '@/screens/plan/PlanApprovedScreen';
import { PlanDeclinedScreen } from '@/screens/plan/PlanDeclinedScreen';
import { EndorseScreen } from '@/screens/plan/EndorseScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { ChatScreen } from '@/screens/chat/ChatScreen';
import { LocSearchScreen } from '@/screens/home/LocSearchScreen';
import { ProfileOtherScreen } from '@/screens/profile/ProfileOtherScreen';
import { FollowListScreen } from '@/screens/profile/FollowListScreen';
import { FamiliarFacesScreen } from '@/screens/profile/FamiliarFacesScreen';
import { ReportUserScreen } from '@/screens/settings/ReportUserScreen';
import { ReportPlanScreen } from '@/screens/settings/ReportPlanScreen';
import { GuidelinesScreen } from '@/screens/settings/GuidelinesScreen';
import { RecapDetailScreen } from '@/screens/recaps/RecapDetailScreen';

const Stack = createStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={STACK_SCREEN_OPTIONS} initialRouteName="Home">
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="HomeEmpty" component={HomeEmptyScreen} />
      <Stack.Screen name="HomeMap" component={HomeMapScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Create" component={CreateScreen} />
      <Stack.Screen name="Plan" component={PlanScreen} />
      <Stack.Screen name="PlanHost" component={PlanHostScreen} />
      <Stack.Screen name="PlanRequests" component={PlanRequestsScreen} />
      <Stack.Screen name="PlanEdit" component={PlanEditScreen} />
      <Stack.Screen name="PlanCancelConfirm" component={PlanCancelConfirmScreen} />
      <Stack.Screen name="PlanLeaveConfirm" component={PlanLeaveConfirmScreen} />
      <Stack.Screen name="PlanExpired" component={PlanExpiredScreen} />
      <Stack.Screen name="PlanEnded" component={PlanEndedScreen} />
      <Stack.Screen name="PlanPosted" component={PlanPostedScreen} />
      <Stack.Screen name="PlanJoined" component={PlanJoinedScreen} />
      <Stack.Screen name="PlanRequested" component={PlanRequestedScreen} />
      <Stack.Screen name="PlanApproved" component={PlanApprovedScreen} />
      <Stack.Screen name="PlanDeclined" component={PlanDeclinedScreen} />
      <Stack.Screen name="Endorse" component={EndorseScreen} />
      <Stack.Screen name="LocSearch" component={LocSearchScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ProfileOther" component={ProfileOtherScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="FamiliarFaces" component={FamiliarFacesScreen} />
      <Stack.Screen name="ReportUser" component={ReportUserScreen} />
      <Stack.Screen name="ReportPlan" component={ReportPlanScreen} />
      <Stack.Screen name="Guidelines" component={GuidelinesScreen} />
      <Stack.Screen name="RecapDetail" component={RecapDetailScreen} />
    </Stack.Navigator>
  );
}
