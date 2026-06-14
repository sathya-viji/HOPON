import React from 'react';
import { useNavigationState } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { NavBar } from '@/components/organisms/NavBar';
import type { NavTab } from '@/components/organisms/NavBar';
import { useSession } from '@/state/SessionContext';

const HIDDEN_SCREENS = new Set(['Create', 'StoryViewer', 'CreateStory', 'RecapPost']);

function getDeepestRouteName(state: any): string {
  if (!state) return '';
  const route = state.routes[state.index ?? 0];
  if (route.state) return getDeepestRouteName(route.state);
  return route.name;
}

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const activeScreenName = useNavigationState(getDeepestRouteName);
  const { unreadCount } = useSession();

  if (HIDDEN_SCREENS.has(activeScreenName)) return null;

  const tabName = state.routes[state.index]?.name ?? 'HomeTab';
  const activeTab: NavTab =
    activeScreenName === 'Notifications'
      ? 'notifications'
      : tabName === 'RecapsTab' ? 'recaps' : tabName === 'ProfileTab' ? 'profile' : 'home';

  return (
    <NavBar
      active={activeTab}
      badges={{ notifications: unreadCount }}
      onHomePress={() => {
        if (tabName === 'HomeTab') {
          // already on HomeTab — pop all the way back to the root Home screen
          (navigation as any).navigate('HomeTab', { screen: 'Home' });
        } else {
          navigation.navigate('HomeTab' as never);
        }
      }}
      onNotificationsPress={() =>
        (navigation as any).navigate('HomeTab', { screen: 'Notifications' })
      }
      onRecapsPress={() => navigation.navigate('RecapsTab' as never)}
      onProfilePress={() => navigation.navigate('ProfileTab' as never)}
      onCreatePress={() =>
        (navigation as any).navigate('HomeTab', { screen: 'Create' })
      }
    />
  );
}
