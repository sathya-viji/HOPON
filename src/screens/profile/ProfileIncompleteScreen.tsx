import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { AvatarStack } from '@/components/molecules/AvatarStack';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import type { ProfileStackParamList } from '@/navigation/types';

// Decorative "people you could meet" illustration for the empty/incomplete
// profile prompt — not real user data, so inlined here (no mock dependency).
const DECOR_AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80',
];

type Props = StackScreenProps<ProfileStackParamList, 'ProfileIncomplete'>;

export function ProfileIncompleteScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();

  const pick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { toast.show('Photo access denied'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1] });
      if (!result.canceled && result.assets[0]) { toast.show('Photo updated'); navigation.popToTop(); }
    } catch { toast.show('Could not open photo library'); }
  };

  const header = (
    <ScreenPad>
      <Row gap="md" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.LabelLg>Complete your profile</T.LabelLg>
      </Row>
    </ScreenPad>
  );

  return (
    <Screen header={header} scroll={false}>
      <ScreenPad style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl }}>
        <Pressable
          onPress={pick}
          style={{ width: 96, height: 96, borderRadius: 28, borderWidth: borderWidths.medium, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, borderColor: colors.borderMid, backgroundColor: colors.surface }}
        >
          <Icon name="camera" size={32} color={colors.textDim} />
          <View style={{ position: 'absolute', bottom: -6, right: -6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.coral }}>
            <Icon name="plus" size={iconSizes.xxs + 2} color={colors.white} strokeWidth={2.5} />
          </View>
        </Pressable>
        <T.Subheading style={{ textAlign: 'center', marginBottom: spacing.sm }}>Add a photo</T.Subheading>
        <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.sm }}>
          Profiles with photos get <T.Bold>3× more join requests.</T.Bold> People want to see who's coming.
        </T.BodyLg>
        <Row gap="sm" style={{ marginBottom: spacing.xxxl }}>
          <AvatarStack uris={DECOR_AVATARS} max={3} size={28} borderColor={colors.bg} />
          <T.Meta>+142 others have a photo</T.Meta>
        </Row>
        <Stack gap="sm" style={{ width: '100%' }}>
          <Button variant="primary-coral" label="Add a photo" onPress={pick} />
          <Button variant="secondary" label="Maybe later" onPress={() => navigation.popToTop()} />
        </Stack>
      </ScreenPad>
    </Screen>
  );
}
