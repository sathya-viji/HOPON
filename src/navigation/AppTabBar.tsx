import React, { useEffect, useState } from 'react';
import { useNavigationState } from '@react-navigation/native';
import type { NavigationState, PartialState } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { NavBar } from '@/components/organisms/NavBar';
import type { NavTab } from '@/components/organisms/NavBar';
import { useSession } from '@/state/SessionContext';
import { getMyProfile } from '@/api/users';

// React Navigation doesn't type nested-tab navigation on BottomTabBarProps.navigation;
// this alias documents the cross-tab navigate shape we actually call.
type CrossTabNav = { navigate: (tab: string, params?: Record<string, unknown>) => void };

const HIDDEN_SCREENS = new Set(['Create', 'StoryViewer', 'CreateStory', 'RecapPost']);
// Full-bleed screens where content should extend behind the bar instead of
// being pushed up by it — the bar floats on top as an absolute overlay.
const OVERLAY_SCREENS = new Set(['HomeMap']);

function getDeepestRouteName(state: NavigationState | PartialState<NavigationState>): string {
  if (!state) return '';
  const route = state.routes[state.index ?? 0];
  if (route.state) return getDeepestRouteName(route.state);
  return route.name;
}

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const activeScreenName = useNavigationState(getDeepestRouteName);
  const { unreadCount } = useSession();
  const [me, setMe] = useState<{ avatarUri?: string; name: string } | null>(null);

  useEffect(() => {
    getMyProfile().then((p) => setMe(p ? { avatarUri: p.avatarUri, name: p.name } : null)).catch(() => {});
  }, []);

  if (HIDDEN_SCREENS.has(activeScreenName)) return null;

  const tabName = state.routes[state.index]?.name ?? 'HomeTab';
  const activeTab: NavTab =
    activeScreenName === 'Notifications'
      ? 'notifications'
      : activeScreenName === 'HomeMap'
      ? 'map'
      : tabName === 'RecapsTab' ? 'recaps' : tabName === 'ProfileTab' ? 'profile' : 'home';

  return (
    <NavBar
      active={activeTab}
      overlay={OVERLAY_SCREENS.has(activeScreenName)}
      myAvatarUri={me?.avatarUri}
      myName={me?.name}
      badges={{ notifications: unreadCount }}
      onHomePress={() =>
        // Home, Map and Notifications are all screens inside the same HomeTab
        // stack — always target Home explicitly (like the other two below do
        // for their own screens), otherwise switching tabs into HomeTab from
        // elsewhere lands wherever that stack was last left instead of Home.
        (navigation as unknown as CrossTabNav).navigate('HomeTab', { screen: 'Home' })
      }
      onNotificationsPress={() =>
        (navigation as unknown as CrossTabNav).navigate('HomeTab', { screen: 'Notifications' })
      }
      onMapPress={() =>
        (navigation as unknown as CrossTabNav).navigate('HomeTab', { screen: 'HomeMap' })
      }
      onRecapsPress={() => navigation.navigate('RecapsTab' as never)}
      onProfilePress={() => navigation.navigate('ProfileTab' as never)}
    />
  );
}
