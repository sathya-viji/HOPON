import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/atoms/Icon';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, iconSizes } from '@/theme/tokens';
import { useSuspended } from '@/state/suspension';

/**
 * Global read-only banner shown when the signed-in account is suspended. Driven
 * reactively by the `account_suspended` error code (see state/suspension +
 * api/errors) since the client can't read its own account_status. Suspension is
 * write-only on the backend — the user can still browse, so this just explains
 * why posting/joining/messaging is paused. Dismissable for the session.
 */
export function SuspensionBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const suspended = useSuspended();
  const [dismissed, setDismissed] = useState(false);

  if (!suspended || dismissed) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingTop: insets.top }}
    >
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.screenPx,
          backgroundColor: colors.cost.sponsoredBg, borderBottomWidth: 1, borderBottomColor: colors.cost.sponsoredBorder,
        }}
      >
        <Icon name="alert-triangle" size={iconSizes.sm} color={colors.cost.sponsoredFg} />
        <View style={{ flex: 1 }}>
          <T.LabelSm color={colors.cost.sponsoredFg}>Your account is restricted</T.LabelSm>
          <T.MetaXs color={colors.cost.sponsoredFg}>You can browse, but posting, joining and messaging are paused while it’s under review.</T.MetaXs>
        </View>
        <Pressable onPress={() => setDismissed(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Icon name="x" size={iconSizes.sm} color={colors.cost.sponsoredFg} />
        </Pressable>
      </View>
    </View>
  );
}
