import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { TextInput } from '@/components/atoms/inputs/TextInput';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, CATEGORIES } from '@/theme/tokens';
import { plans } from '@/mocks';
import { useToast } from '@/hooks/useToast';
import type { RecapsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<RecapsStackParamList, 'RecapPost'>;

// absoluteFill is a structural layout constant — acceptable in screen
const StyleSheet_absoluteFill = StyleSheet.absoluteFill;

export function RecapPostScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [linkedPlan, setLinkedPlan] = useState<string | null>(route.params?.planId ?? null);

  const pick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { toast.show('Photo access denied'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 5], quality: 0.8 });
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
    } catch { toast.show('Could not open photo library'); }
  };

  const header = (
    <ScreenPad>
      <Row gap="md" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.LabelLg>Post a recap</T.LabelLg>
      </Row>
    </ScreenPad>
  );

  return (
    <Screen header={header}>
      <ScreenPad style={{ paddingTop: spacing.md }}>
        <Stack gap="sm">
          {/* Photo picker */}
          <Pressable
            onPress={pick}
            style={{ width: '100%', aspectRatio: 4 / 3, borderWidth: borderWidths.medium, borderStyle: 'dashed', borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderColor: colors.borderMid, backgroundColor: colors.surface }}
          >
            {photo ? (
              <Image source={{ uri: photo }} style={StyleSheet_absoluteFill} contentFit="cover" />
            ) : (
              <Stack style={{ alignItems: 'center' }} gap="sm">
                <Icon name="image-plus" size={32} color={colors.textDim} />
                <T.Semibold color={colors.textDim}>Tap to add photo</T.Semibold>
              </Stack>
            )}
          </Pressable>

          {/* Caption */}
          <Stack gap="sm">
            <T.CapsSm>Caption</T.CapsSm>
            <TextInput placeholder="What happened? How did it feel?" value={caption} onChangeText={setCaption} maxLength={200} multiline />
            <T.MetaXs style={{ textAlign: 'right' }}>{caption.length}/200</T.MetaXs>
          </Stack>

          {/* Link to plan */}
          <Stack gap="sm">
            <T.CapsSm>Link to a plan (optional)</T.CapsSm>
            <Stack gap="sm">
              {plans.slice(0, 4).map((p) => {
                const cat = CATEGORIES.find((c) => c.id === p.categoryId)!;
                const on = linkedPlan === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setLinkedPlan(on ? null : p.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm + 2, borderWidth: borderWidths.thin, borderRadius: radii.sm, backgroundColor: colors.surface, borderColor: on ? colors.black : colors.border }}
                  >
                    <Stack style={{ width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: cat.bg }}>
                      <Icon name={cat.icon as never} size={iconSizes.xxs + 2} color={cat.iconColor} strokeWidth={2} />
                    </Stack>
                    <T.Semibold style={{ flex: 1 }} numberOfLines={1}>{p.activity} · {p.location.split(',')[0]}</T.Semibold>
                    <Icon name={on ? 'check' : 'chevron-right'} size={iconSizes.xs} color={on ? colors.black : colors.textDim} />
                  </Pressable>
                );
              })}
            </Stack>
          </Stack>

          <Stack style={{ marginTop: spacing.md }}>
            <Button variant="primary-coral" label="Share recap" onPress={() => navigation.replace('RecapPosted', { recapId: 'r-new' })} disabled={!photo || caption.trim().length === 0} />
          </Stack>
        </Stack>
      </ScreenPad>
    </Screen>
  );
}
