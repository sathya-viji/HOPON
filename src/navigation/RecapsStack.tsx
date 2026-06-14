import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { RecapsStackParamList } from './types';
import { STACK_SCREEN_OPTIONS } from './transitions';
import { RecapsScreen } from '@/screens/recaps/RecapsScreen';
import { RecapPostScreen } from '@/screens/recaps/RecapPostScreen';
import { RecapPostedScreen } from '@/screens/recaps/RecapPostedScreen';
import { RecapDetailScreen } from '@/screens/recaps/RecapDetailScreen';
import { StoryViewerScreen } from '@/screens/recaps/StoryViewerScreen';
import { CreateStoryScreen } from '@/screens/recaps/CreateStoryScreen';
import { ProfileOtherScreen } from '@/screens/profile/ProfileOtherScreen';
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

const Stack = createStackNavigator<RecapsStackParamList>();

export function RecapsStack() {
  return (
    <Stack.Navigator screenOptions={STACK_SCREEN_OPTIONS} initialRouteName="Recaps">
      <Stack.Screen name="Recaps" component={RecapsScreen} />
      <Stack.Screen name="RecapPost" component={RecapPostScreen} />
      <Stack.Screen name="RecapPosted" component={RecapPostedScreen} />
      <Stack.Screen name="RecapDetail" component={RecapDetailScreen} />
      <Stack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{ presentation: 'card', cardStyle: { backgroundColor: '#000' }, gestureEnabled: true }}
      />
      <Stack.Screen
        name="CreateStory"
        component={CreateStoryScreen}
        options={{ presentation: 'card', cardStyle: { backgroundColor: '#000' }, gestureEnabled: true }}
      />
      <Stack.Screen name="ProfileOther" component={ProfileOtherScreen} />
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
    </Stack.Navigator>
  );
}
