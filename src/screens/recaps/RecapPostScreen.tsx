import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
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
import { EmptyState } from '@/components/atoms/EmptyState';
import { TextInput } from '@/components/atoms/inputs/TextInput';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, CATEGORIES } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import { getMyPlans, type MyPlanItem } from '@/api/plans';
import { postRecap } from '@/api/recaps';
import { uploadImages } from '@/api/storage';
import { errorMessage } from '@/api/errors';
import type { RecapsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<RecapsStackParamList, 'RecapPost'>;

const StyleSheet_absoluteFill = StyleSheet.absoluteFill;
const MAX_PHOTOS = 5;

export function RecapPostScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [photos, setPhotos] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [linkedPlan, setLinkedPlan] = useState<string | null>(route.params?.planId ?? null);
  const [plans, setPlans] = useState<MyPlanItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [posting, setPosting] = useState(false);

  // Recaps are tied to a plan you attended — load eligible (already-started) plans.
  // NOTE: getMyPlans currently fails (no server read-path for "my plans"; see
  // its doc comment) — we surface a clear "couldn't load" state rather than a
  // misleading "no plans yet".
  useEffect(() => {
    let cancelled = false;
    getMyPlans()
      .then((all) => { if (!cancelled) { setPlans(all.filter((p) => p.started)); setLoadError(false); } })
      .catch(() => { if (!cancelled) { setPlans([]); setLoadError(true); } });
    return () => { cancelled = true; };
  }, []);

  const pick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { toast.show('Photo access denied'); return; }
      const remaining = MAX_PHOTOS - photos.length;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });
      if (!result.canceled) {
        const uris = result.assets.map((a) => a.uri);
        setPhotos((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
      }
    } catch { toast.show('Could not open photo library'); }
  };

  const removePhoto = (uri: string) => setPhotos((prev) => prev.filter((u) => u !== uri));

  const share = async () => {
    if (posting || photos.length === 0 || !linkedPlan) return;
    setPosting(true);
    try {
      const paths = await uploadImages('recaps', photos);
      const id = await postRecap(linkedPlan, paths, caption);
      navigation.replace('RecapPosted', { recapId: id });
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t post recap. Try again.'));
      setPosting(false);
    }
  };

  const header = (
    <ScreenPad>
      <Row gap="md" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.LabelLg>Post a recap</T.LabelLg>
      </Row>
    </ScreenPad>
  );

  const canShare = photos.length > 0 && !!linkedPlan && !posting;

  return (
    <Screen header={header}>
      <ScreenPad style={{ paddingTop: spacing.md }}>
        <Stack gap="sm">
          {/* Photos (1–5) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {photos.map((uri) => (
              <View key={uri} style={{ width: 120, height: 150, borderRadius: radii.lg, overflow: 'hidden' }}>
                <Image source={{ uri }} style={StyleSheet_absoluteFill} contentFit="cover" />
                <Pressable
                  onPress={() => removePhoto(uri)}
                  hitSlop={8}
                  style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                  <Icon name="x" size={14} color={colors.white} strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <Pressable
                onPress={pick}
                style={{ width: 120, height: 150, borderWidth: borderWidths.medium, borderStyle: 'dashed', borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', borderColor: colors.borderMid, backgroundColor: colors.surface }}
              >
                <Icon name="image-plus" size={28} color={colors.textDim} />
                <T.MetaXs color={colors.textDim} style={{ marginTop: spacing.xs }}>{photos.length === 0 ? 'Add photos' : 'Add more'}</T.MetaXs>
              </Pressable>
            ) : null}
          </ScrollView>
          <T.MetaXs color={colors.textDim}>{photos.length}/{MAX_PHOTOS} photos</T.MetaXs>

          {/* Caption */}
          <Stack gap="sm" style={{ marginTop: spacing.sm }}>
            <T.CapsSm>Caption (optional)</T.CapsSm>
            <TextInput placeholder="What happened? How did it feel?" value={caption} onChangeText={setCaption} maxLength={200} multiline />
            <T.MetaXs style={{ textAlign: 'right' }}>{caption.length}/200</T.MetaXs>
          </Stack>

          {/* Link to plan (required) */}
          <Stack gap="sm">
            <T.CapsSm>Which plan was this?</T.CapsSm>
            {plans === null ? (
              <Row style={{ paddingVertical: spacing.lg, justifyContent: 'center' }}>
                <ActivityIndicator color={colors.coral} />
              </Row>
            ) : loadError ? (
              <EmptyState emoji="⚠️" title="Couldn’t load your plans" sub="We can’t reach your plan history right now. Please try again shortly." />
            ) : plans.length === 0 ? (
              <EmptyState emoji="📋" title="No plans yet" sub="You can post a recap once you've attended a plan." />
            ) : (
              <Stack gap="sm">
                {plans.map((p) => {
                  const cat = CATEGORIES.find((c) => c.id === p.categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
                  const on = linkedPlan === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setLinkedPlan(p.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm + 2, borderWidth: borderWidths.medium, borderRadius: radii.sm, backgroundColor: colors.surface, borderColor: on ? colors.black : colors.border }}
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
            )}
          </Stack>

          <Stack style={{ marginTop: spacing.md }}>
            <Button variant="primary-coral" label={posting ? 'Posting…' : 'Share recap'} onPress={share} disabled={!canShare} />
            {!linkedPlan && photos.length > 0 ? (
              <T.MetaXs color={colors.textDim} style={{ textAlign: 'center', marginTop: spacing.xs }}>Pick the plan this recap is from to continue.</T.MetaXs>
            ) : null}
          </Stack>
        </Stack>
      </ScreenPad>
    </Screen>
  );
}
