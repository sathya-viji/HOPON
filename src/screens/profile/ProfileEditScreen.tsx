import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, ScrollView, TextInput as RNTextInput, Modal, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Button } from '@/components/atoms/Button';
import { Icon, IconName } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import { TextInput } from '@/components/atoms/inputs/TextInput';
import { FieldRow } from '@/components/atoms/inputs/FieldRow';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes, avatarSizes, HIT_SLOP, CATEGORIES } from '@/theme/tokens';
import { getMyProfile, updateMyProfile } from '@/api/users';
import { setInterests as persistInterests } from '@/api/auth';
import { uploadImage } from '@/api/storage';
import { errorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { User } from '@/types';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'ProfileEdit'>;

export function ProfileEditScreen({ navigation }: Props) {
  const { colors, mode } = useTheme();
  const isDark = mode === 'dark';
  const social = isDark
    ? { instagram: { bg: '#1C0A10', fg: '#E1306C' }, linkedin: { bg: '#080F1C', fg: '#4D9FE8' }, facebook: { bg: '#08101C', fg: '#4D8FE8' } }
    : { instagram: { bg: '#FCE4F0', fg: '#E1306C' }, linkedin: { bg: '#E8F0FB', fg: '#0A66C2' }, facebook: { bg: '#E7F0FD', fg: '#1877F2' } };

  const toast = useToast();
  const [me, setMe] = useState<User | null>(null);

  const [name, setName]         = useState('');
  const [bio, setBio]           = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [facebook, setFacebook] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [interests, setInterestsState] = useState<string[]>([]);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [discardSheet, setDiscardSheet]   = useState(false);
  const pendingAction = useRef<any>(null);
  const saving = useRef(false);

  // Load the signed-in user's real profile and seed the form.
  // Re-runs on focus so neighbourhood updates after returning from SettingsNeighbourhood.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getMyProfile().then((p) => {
        if (cancelled || !p) return;
        setMe(p);
        setName(p.name);
        setBio(p.bio ?? '');
        setInstagram(p.socialLinks?.instagram ?? '');
        setLinkedin(p.socialLinks?.linkedin ?? '');
        setFacebook(p.socialLinks?.facebook ?? '');
        setInterestsState(p.interests ?? []);
      }).catch(() => { /* leave empty; save guarded on `me` */ });
      return () => { cancelled = true; };
    }, []),
  );

  const isDirty = !!me && (
    name !== me.name ||
    bio !== (me.bio ?? '') || instagram !== (me.socialLinks?.instagram ?? '') ||
    linkedin !== (me.socialLinks?.linkedin ?? '') || facebook !== (me.socialLinks?.facebook ?? '') ||
    avatarUri !== null || interests.join(',') !== (me.interests ?? []).join(',')
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty || saving.current) return;
      e.preventDefault();
      pendingAction.current = e.data.action;
      setDiscardSheet(true);
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { toast.show('Photo access denied'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const toggleInterest = useCallback((id: string) => {
    setInterestsState((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const handleSave = async () => {
    if (!me || saving.current) return;
    saving.current = true;
    try {
      let avatarPath: string | undefined;
      if (avatarUri) avatarPath = await uploadImage('avatars', avatarUri);
      await updateMyProfile({
        name: name.trim(),
        bio: bio.trim() ? bio.trim() : null,
        instagram: instagram.trim() ? instagram.trim() : null,
        linkedin: linkedin.trim() ? linkedin.trim() : null,
        facebook: facebook.trim() ? facebook.trim() : null,
        ...(avatarPath ? { avatarPath } : {}),
      });
      if (interests.join(',') !== (me.interests ?? []).join(',')) {
        await persistInterests(interests);
      }
      toast.show('Profile saved');
      navigation.goBack();
    } catch (e) {
      saving.current = false;
      toast.show(errorMessage(e, 'Couldn’t save profile. Try again.'));
    }
  };

  const displayUri = avatarUri ?? me?.avatarUri;

  const header = (
    <ScreenPad>
      <Row gap="md" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.LabelLg style={{ flex: 1 }}>Edit profile</T.LabelLg>
        <Pressable onPress={handleSave} hitSlop={HIT_SLOP.sm}>
          <T.LabelLg color={colors.coral}>Save</T.LabelLg>
        </Pressable>
      </Row>
    </ScreenPad>
  );

  if (!me) {
    return (
      <Screen header={header} scroll={false}>
        <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral} />
        </Stack>
      </Screen>
    );
  }

  return (
    <>
      <Screen header={header}>
        <ScreenPad style={{ paddingTop: spacing.lg }}>
          {/* Photo */}
          <Pressable
            onPress={pickPhoto}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderRadius: radii.lg, borderWidth: borderWidths.thin, backgroundColor: colors.profileCardBg, borderColor: colors.profileCardBorder }}
          >
            <View style={{ position: 'relative' }}>
              {displayUri ? (
                <View style={{ width: avatarSizes.md + 16, height: avatarSizes.md + 16, borderRadius: 14, overflow: 'hidden' }}>
                  <Image source={{ uri: displayUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                </View>
              ) : (
                <Avatar uri={undefined} name={me?.name} size={56} shape="rounded" />
              )}
              <View style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ctaBg }}>
                <Icon name="camera" size={iconSizes.xxs + 1} color={colors.ctaFg} />
              </View>
            </View>
            <Stack>
              <T.LabelLg>Profile photo</T.LabelLg>
              <T.Meta color={colors.coral}>{avatarUri ? 'Photo selected — tap to change' : 'Change photo'}</T.Meta>
            </Stack>
          </Pressable>

          <Stack gap="md" style={{ marginTop: spacing.lg }}>
            <Stack gap="sm">
              <T.CapsSm>Display Name</T.CapsSm>
              <TextInput placeholder="Display name" value={name} onChangeText={setName} maxLength={32} />
            </Stack>
            <Stack gap="sm">
              <T.CapsSm>Handle</T.CapsSm>
              <Row gap="sm" style={{ alignItems: 'center', paddingVertical: 13, paddingHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: borderWidths.thin, backgroundColor: colors.surfaceMid, borderColor: colors.border }}>
                <T.BodyLg color={colors.textSub} style={{ flex: 1 }}>{me?.handle ?? ''}</T.BodyLg>
                <Icon name="lock" size={iconSizes.xs} color={colors.textDim} />
              </Row>
              <T.MetaXs color={colors.textDim}>Usernames can't be changed.</T.MetaXs>
            </Stack>
            <Stack gap="sm">
              <T.CapsSm>Neighbourhood</T.CapsSm>
              <FieldRow icon="map-pin" label="" value={me?.neighbourhood ?? ''} onPress={() => navigation.navigate('SettingsNeighbourhood')} selected />
            </Stack>
            <Stack gap="sm">
              <T.CapsSm>Bio (Optional)</T.CapsSm>
              <TextInput placeholder="A line about what you're into…" value={bio} onChangeText={setBio} maxLength={120} multiline />
              <T.MetaXs style={{ textAlign: 'right' }}>{bio.length}/120</T.MetaXs>
            </Stack>

            {/* Interests */}
            <Stack gap="sm">
              <T.CapsSm>Interests</T.CapsSm>
              <Pressable
                onPress={() => setInterestsOpen(true)}
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md, borderWidth: borderWidths.thin, borderRadius: radii.sm, backgroundColor: colors.profileCardBg, borderColor: colors.profileCardBorder }}
              >
                {interests.map((id) => {
                  const cat = CATEGORIES.find((c) => c.id === id);
                  if (!cat) return null;
                  const bg = isDark ? cat.darkBg : cat.bg;
                  const fg = isDark ? cat.darkIconColor : cat.iconColor;
                  return (
                    <Row key={id} gap={5} style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm + 2, borderRadius: radii.full, backgroundColor: bg }}>
                      <Icon name={cat.icon as IconName} size={iconSizes.xxs + 1} color={fg} />
                      <T.LabelSm color={fg}>{cat.label}</T.LabelSm>
                    </Row>
                  );
                })}
                <Row gap={5} style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.sm + 2, borderRadius: radii.full, backgroundColor: colors.surfaceMid }}>
                  <Icon name="pencil" size={iconSizes.xxs + 1} color={colors.textSub} />
                  <T.LabelSm color={colors.textSub}>Edit</T.LabelSm>
                </Row>
              </Pressable>
            </Stack>

            {/* Social links */}
            <Stack gap="sm">
              <Row gap="sm">
                <T.CapsSm>Linked Accounts</T.CapsSm>
                <Row gap={3} style={{ paddingVertical: 1, paddingHorizontal: spacing.sm, borderRadius: radii.full, backgroundColor: colors.cost.freeBg }}>
                  <Icon name="shield-check" size={iconSizes.xxs} color={colors.green} />
                  <T.LabelXs color={colors.green}>Trust signal</T.LabelXs>
                </Row>
              </Row>
              <Stack gap="sm">
                {([
                  { key: 'instagram', label: 'Instagram', color: social.instagram.fg, bg: social.instagram.bg, value: instagram, setter: setInstagram },
                  { key: 'linkedin',  label: 'LinkedIn',  color: social.linkedin.fg,  bg: social.linkedin.bg,  value: linkedin,  setter: setLinkedin },
                  { key: 'facebook',  label: 'Facebook',  color: social.facebook.fg,  bg: social.facebook.bg,  value: facebook,  setter: setFacebook },
                ] as const).map((p) => (
                  <Row key={p.key} gap="sm" style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.sm, backgroundColor: p.bg }}>
                    <T.LabelMd color={p.color} style={{ minWidth: 72 }}>{p.label}</T.LabelMd>
                    <T.BodyLg color={p.color} style={{ opacity: 0.5 }}>@</T.BodyLg>
                    <RNTextInput
                      placeholder="your_handle"
                      value={p.value}
                      onChangeText={p.setter as (v: string) => void}
                      maxLength={60}
                      style={{ flex: 1, color: p.color, fontFamily: 'Inter-Regular', fontSize: 14, padding: 0 }}
                      placeholderTextColor={p.color + '66'}
                    />
                  </Row>
                ))}
              </Stack>
              <T.Meta>Linked accounts show on your profile. They help others recognise you and build trust before meeting.</T.Meta>
            </Stack>
          </Stack>

          <View style={{ marginTop: spacing.xl, marginBottom: spacing.xxxl }}>
            <Button variant="primary-coral" label="Save changes" onPress={handleSave} />
          </View>
        </ScreenPad>
      </Screen>

      {/* Unsaved changes sheet */}
      <Modal visible={discardSheet} transparent animationType="slide" onRequestClose={() => setDiscardSheet(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setDiscardSheet(false)} />
        <View style={{ borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, paddingHorizontal: spacing.screenPx, paddingTop: spacing.md, paddingBottom: spacing.xxxl + spacing.sm, backgroundColor: colors.bg }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg, backgroundColor: colors.borderMid }} />
          <T.Subheading style={{ marginBottom: spacing.sm }}>Discard changes?</T.Subheading>
          <T.BodyLg color={colors.textSub} style={{ marginBottom: spacing.xl }}>You have unsaved edits. They'll be lost if you leave now.</T.BodyLg>
          <Row gap="sm">
            <Pressable
              onPress={() => setDiscardSheet(false)}
              style={{ flex: 1, paddingVertical: 13, borderRadius: radii.sm, borderWidth: borderWidths.thin, borderColor: colors.border, alignItems: 'center' }}
            >
              <T.LabelLg>Keep editing</T.LabelLg>
            </Pressable>
            <Pressable
              onPress={() => { setDiscardSheet(false); if (pendingAction.current) navigation.dispatch(pendingAction.current); }}
              style={{ flex: 1, paddingVertical: 13, borderRadius: radii.sm, alignItems: 'center', backgroundColor: colors.cost.sponsoredFg }}
            >
              <T.LabelLg color={colors.white}>Discard</T.LabelLg>
            </Pressable>
          </Row>
        </View>
      </Modal>

      {/* Interests picker modal */}
      <Modal visible={interestsOpen} transparent animationType="slide" onRequestClose={() => setInterestsOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setInterestsOpen(false)} />
        <View style={{ borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, paddingHorizontal: spacing.screenPx, paddingTop: spacing.md, maxHeight: '75%', backgroundColor: colors.bg }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg, backgroundColor: colors.borderMid }} />
          <T.Subheading style={{ marginBottom: spacing.xs }}>Your interests</T.Subheading>
          <T.BodyMd color={colors.textSub} style={{ marginBottom: spacing.lg }}>Tap to toggle. These show on your profile and help match you with plans.</T.BodyMd>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.lg }}>
            {CATEGORIES.map((cat) => {
              const selected = interests.includes(cat.id);
              const bg = selected ? (isDark ? cat.darkBg : cat.bg) : colors.profileCardBg;
              const fg = selected ? (isDark ? cat.darkIconColor : cat.iconColor) : colors.textSub;
              const borderColor = (selected ? (isDark ? cat.darkIconColor : cat.iconColor) + '55' : colors.profileCardBorder);
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => toggleInterest(cat.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg - 2, borderRadius: radii.full, borderWidth: borderWidths.thin, position: 'relative', backgroundColor: bg, borderColor }}
                >
                  <Icon name={cat.icon as IconName} size={iconSizes.xs + 2} color={fg} />
                  <T.Semibold color={fg}>{cat.label}</T.Semibold>
                  {selected ? (
                    <View style={{ width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: fg }}>
                      <Icon name="check" size={iconSizes.xxs} color="#fff" strokeWidth={3} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.xxxl }}>
            <Button variant="primary-coral" label={`Done · ${interests.length} selected`} onPress={() => setInterestsOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
