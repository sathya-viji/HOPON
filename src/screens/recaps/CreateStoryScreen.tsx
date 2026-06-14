import React, { useState } from 'react';
import { View, TextInput, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Modal, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { Icon, IconName } from '@/components/atoms/Icon';
import { Stack } from '@/components/layout/Stack';
import { Row } from '@/components/layout/Row';
import * as T from '@/components/atoms/T';
import { fontFamilies, spacing, radii, iconSizes, CATEGORIES } from '@/theme/tokens';
import { plans, CURRENT_USER_ID } from '@/mocks';
import { useToast } from '@/hooks/useToast';
import type { RecapsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<RecapsStackParamList, 'CreateStory'>;

// absoluteFill is a structural layout constant — acceptable in screen
const StyleSheet_absoluteFill = StyleSheet.absoluteFill;

export function CreateStoryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [linkedPlanId, setLinkedPlanId] = useState<string | null>(null);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);

  const myPlans = plans.filter((p) => p.hostId === CURRENT_USER_ID || p.joinerIds.includes(CURRENT_USER_ID));
  const linkedPlan = myPlans.find((p) => p.id === linkedPlanId) ?? null;
  const linkedCat = linkedPlan ? CATEGORIES.find((c) => c.id === linkedPlan.categoryId) : null;

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { toast.show('Photo access denied'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [9, 16], quality: 0.85 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const handlePost = () => {
    if (!imageUri) { toast.show('Pick a photo first'); return; }
    toast.show('Story posted! Visible for 24 hours 🎉');
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#000' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar hidden translucent backgroundColor="transparent" />

      {/* Full-screen photo / placeholder */}
      <Pressable onPress={!imageUri ? pickPhoto : undefined} style={StyleSheet_absoluteFill}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={StyleSheet_absoluteFill} contentFit="cover" />
        ) : (
          <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: '#111' }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Icon name="camera" size={36} color="rgba(255,255,255,0.75)" />
            </View>
            <T.LabelLg style={{ color: '#fff' }}>Tap to choose a photo</T.LabelLg>
            <T.Meta style={{ color: 'rgba(255,255,255,0.45)' }}>Stories disappear after 24 hours</T.Meta>
          </Stack>
        )}
      </Pressable>

      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 80, zIndex: 2 }} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, zIndex: 2 }} pointerEvents="none" />

      {/* Top bar */}
      <Row justify="space-between" style={{ position: 'absolute', top: insets.top + 10, left: 0, right: 0, paddingHorizontal: spacing.md, zIndex: 10 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Icon name="x" size={20} color="#fff" strokeWidth={2.5} />
        </Pressable>
        {imageUri ? (
          <Pressable onPress={pickPhoto} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radii.full, paddingVertical: 7, paddingHorizontal: spacing.md - 2, backgroundColor: 'rgba(0,0,0,0.35)' }}>
            <Icon name="camera" size={iconSizes.xs} color="#fff" />
            <T.Semibold style={{ fontSize: 12, color: '#fff' }}>Change</T.Semibold>
          </Pressable>
        ) : null}
      </Row>

      {/* Linked plan sticker */}
      {linkedPlan && linkedCat ? (
        <View style={{ position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 10 }}>
          <Row gap="sm" style={{ borderRadius: radii.full, paddingVertical: 7, paddingHorizontal: spacing.sm + 2, backgroundColor: linkedCat.bg, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
            <Icon name={linkedCat.icon as IconName} size={iconSizes.xxs + 3} color={linkedCat.iconColor} strokeWidth={2} />
            <T.LabelSm color={linkedCat.iconColor} style={{ maxWidth: 180 }} numberOfLines={1}>{linkedPlan.activity}</T.LabelSm>
            <Pressable onPress={() => setLinkedPlanId(null)} hitSlop={spacing.sm}>
              <Icon name="x" size={iconSizes.xxs + 2} color={linkedCat.iconColor} strokeWidth={2.5} />
            </Pressable>
          </Row>
        </View>
      ) : null}

      {/* Bottom overlay */}
      <Stack gap="sm" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.screenPx, paddingBottom: Math.max(insets.bottom, 16) + 8, zIndex: 10 }}>
        <View style={{ borderRadius: radii.md, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <TextInput
            placeholder="Add a caption…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            value={caption}
            onChangeText={setCaption}
            maxLength={120}
            multiline
            style={{ fontFamily: fontFamilies.regular, fontSize: 15, color: '#fff', maxHeight: 72 }}
          />
        </View>
        <Row gap="sm">
          <Pressable onPress={() => setPlanSheetOpen(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radii.full, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm + 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <Icon name="map-pin" size={iconSizes.xs} color={linkedPlan ? '#fff' : 'rgba(255,255,255,0.6)'} />
            <T.Semibold style={{ flex: 1, fontSize: 13, color: linkedPlan ? '#fff' : 'rgba(255,255,255,0.6)' }} numberOfLines={1}>{linkedPlan ? linkedPlan.activity.split(' ').slice(0, 3).join(' ') : 'Link a plan'}</T.Semibold>
          </Pressable>
          <Pressable onPress={handlePost} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.full, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, opacity: !imageUri ? 0.4 : 1, backgroundColor: '#FF5C5C' }}>
            <T.LabelMd style={{ color: '#fff' }}>Your story</T.LabelMd>
            <Icon name="chevron-right" size={iconSizes.sm} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </Row>
      </Stack>

      {/* Plan picker sheet */}
      <Modal visible={planSheetOpen} transparent animationType="slide" onRequestClose={() => setPlanSheetOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setPlanSheetOpen(false)} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: spacing.screenPx, paddingTop: spacing.md - 2, maxHeight: '60%', paddingBottom: Math.max(insets.bottom, 16) + spacing.md }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: spacing.md }} />
          <View style={{ marginBottom: spacing.md }}>
            <T.LabelLg style={{ color: '#0A0A0A' }}>Link to a plan</T.LabelLg>
          </View>
          {myPlans.length === 0 ? (
            <T.Meta style={{ textAlign: 'center', paddingVertical: spacing.xxl, color: '#999' }}>No recent plans found</T.Meta>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {myPlans.map((p) => {
                const cat = CATEGORIES.find((c) => c.id === p.categoryId);
                const selected = linkedPlanId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => { setLinkedPlanId(selected ? null : p.id); setPlanSheetOpen(false); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md - 2, paddingVertical: spacing.md - 2, borderRadius: radii.sm, paddingHorizontal: spacing.xs, backgroundColor: selected ? '#FFF0F0' : 'transparent' }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: cat?.bg ?? '#eee' }}>
                      <Icon name={(cat?.icon ?? 'sparkles') as IconName} size={iconSizes.xs} color={cat?.iconColor ?? '#666'} strokeWidth={2} />
                    </View>
                    <Stack style={{ flex: 1, minWidth: 0 }}>
                      <T.LabelMd style={{ color: '#0A0A0A' }} numberOfLines={1}>{p.activity}</T.LabelMd>
                      <T.MetaXs style={{ color: '#888' }} numberOfLines={1}>{p.location.split(',')[0]}</T.MetaXs>
                    </Stack>
                    {selected ? <Icon name="check" size={iconSizes.sm} color="#FF5C5C" strokeWidth={2.5} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
