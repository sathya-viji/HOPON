import React from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'ContactsSync'>;

export function ContactsSyncScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const header = (
    <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
      <Button variant="back" onPress={() => navigation.goBack()} />
    </View>
  );

  // The single contacts-permission prompt + matching happens on the next screen
  // (PeopleToFollow) so we don't double-prompt; this screen just captures intent.
  const syncContacts = () => navigation.navigate('PeopleToFollow', { sync: true });

  return (
    <Screen header={header}>
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPx, paddingVertical: 32, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 96, height: 96, marginBottom: 28, position: 'relative' }}>
          <View style={{ width: 96, height: 96, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderColor: colors.border }}>
            <Icon name="users" size={40} color={colors.textSub} />
          </View>
          <View style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cost.freeBg, borderColor: colors.bg }}>
            <Icon name="badge-check" size={11} color={colors.green} />
          </View>
          <View style={{ position: 'absolute', bottom: -6, left: -6, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderColor: colors.border }}>
            <Icon name="user" size={11} color={colors.textSub} />
          </View>
        </View>

        <Text style={{ fontFamily: fontFamilies.black, fontSize: 24, letterSpacing: -0.025 * 24, marginBottom: 10, textAlign: 'center', color: colors.text }}>Find people you know</Text>
        <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, textAlign: 'center', lineHeight: 14 * 1.7, maxWidth: 260, color: colors.textSub }}>
          We'll check your contacts to find friends already on hopon. Nothing is shared without your permission.
        </Text>

        <View style={{ width: '100%', gap: 10, marginTop: 36 }}>
          <Button variant="primary-coral" label="Sync contacts" leadingIcon="users" onPress={syncContacts} />
          <Pressable onPress={() => navigation.navigate('PeopleToFollow')} style={{ alignSelf: 'center', padding: spacing.sm }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip">
            <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 13, color: colors.textSub }}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
