import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { OnboardingProgress } from '@/components/molecules/OnboardingProgress';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import type { OnboardingStackParamList } from '@/navigation/types';
import { uploadImage } from '@/api/storage';
import { useOnboardingDraft } from '@/state/OnboardingDraftContext';

type Props = StackScreenProps<OnboardingStackParamList, 'SignupPhoto'>;

// absoluteFill is a structural layout constant — acceptable in screen
const StyleSheet_absoluteFill = StyleSheet.absoluteFill;

export function SignupPhotoScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const { update } = useOnboardingDraft();
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast.show('Photo permission denied'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.9 });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  };

  const handleContinue = async () => {
    if (!photo) { navigation.navigate('Interests'); return; }
    setUploading(true);
    try {
      const path = await uploadImage('avatars', photo);
      update({ avatarPath: path });
    } catch {
      toast.show('Photo upload failed — you can add one from your profile later.');
    } finally {
      setUploading(false);
    }
    navigation.navigate('Interests');
  };

  const header = (
    <>
      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
      </View>
      <OnboardingProgress step={6} />
    </>
  );

  return (
    <Screen header={header}>
      <View style={{ flex: 1, paddingHorizontal: spacing.screenPx, paddingTop: 28, paddingBottom: 40, alignItems: 'center' }}>
        <View style={{ width: '100%', marginBottom: 32 }}>
          <Text style={{ fontFamily: fontFamilies.black, fontSize: 26, letterSpacing: -0.025 * 26, marginBottom: 8, color: colors.text }}>Add a photo.</Text>
          <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.6, color: colors.textSub }}>
            Plans with a photo get more joins. People want to see who's coming.
          </Text>
        </View>

        <Pressable
          onPress={pickPhoto}
          style={{ width: 120, height: 120, borderRadius: 36, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16, backgroundColor: colors.surface, borderColor: colors.borderMid }}
          accessibilityRole="button"
          accessibilityLabel="Add profile photo"
        >
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet_absoluteFill} contentFit="cover" />
          ) : (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Icon name="camera" size={28} color={colors.textDim} />
              <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 11, color: colors.textDim }}>Tap to add</Text>
            </View>
          )}
        </Pressable>

        {photo ? (
          <Pressable onPress={pickPhoto} style={{ marginBottom: 24, padding: 4 }} accessibilityRole="link">
            <Text style={{ fontFamily: fontFamilies.semibold, fontSize: 13, color: colors.coral }}>Change photo</Text>
          </Pressable>
        ) : (
          <View style={{ height: 40 }} />
        )}

        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.sm, marginBottom: 28, backgroundColor: colors.surface }}>
          <Icon name="zap" size={16} color={colors.amber} />
          <Text style={{ flex: 1, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 12 * 1.5, color: colors.textSub }}>
            Profiles with photos get{' '}
            <Text style={{ fontFamily: fontFamilies.bold, color: colors.text }}>3× more join requests.</Text> You can always add one later.
          </Text>
        </View>

        <View style={{ width: '100%', marginTop: 'auto' }}>
          <Button variant="primary-coral" label="Continue" onPress={handleContinue} disabled={!photo || uploading} loading={uploading} />
          <View style={{ height: 10 }} />
          <Button variant="secondary" label="Skip for now" onPress={() => navigation.navigate('Interests')} disabled={uploading} />
        </View>
      </View>
    </Screen>
  );
}
