import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { HomeStack } from './HomeStack';
import { RecapsStack } from './RecapsStack';
import { ProfileStack } from './ProfileStack';
import { AppTabBar } from './AppTabBar';

const Tabs = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tabs.Screen name="HomeTab" component={HomeStack} />
      <Tabs.Screen name="RecapsTab" component={RecapsStack} />
      <Tabs.Screen name="ProfileTab" component={ProfileStack} />
    </Tabs.Navigator>
  );
}
