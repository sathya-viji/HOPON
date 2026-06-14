import React from 'react';
import { Text, Pressable, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Row } from '@/components/layout/Row';
import { SectionBlock } from '@/components/layout/SectionBlock';
import { Stack } from '@/components/layout/Stack';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { textStyles } from '@/theme/textStyles';
import { radii, spacing } from '@/theme/tokens';

interface SocialLinksData {
  instagram?: string;
  linkedin?: string;
  facebook?: string;
}

interface SocialLinksProps {
  links: SocialLinksData;
}

const SOCIAL_COLORS = {
  light: {
    instagram: { bg: '#FCE4F0', fg: '#E1306C' },
    linkedin:  { bg: '#E8F0FB', fg: '#0A66C2' },
    facebook:  { bg: '#E7F0FD', fg: '#1877F2' },
  },
  dark: {
    instagram: { bg: '#1C0A10', fg: '#E1306C' },
    linkedin:  { bg: '#080F1C', fg: '#4D9FE8' },
    facebook:  { bg: '#08101C', fg: '#4D8FE8' },
  },
} as const;

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', url: (handle: string) => `https://instagram.com/${handle}` },
  { key: 'linkedin', label: 'LinkedIn', url: (handle: string) => `https://www.linkedin.com/in/${handle}` },
  { key: 'facebook', label: 'Facebook', url: (handle: string) => `https://facebook.com/${handle}` },
] as const;

export function SocialLinks({ links }: SocialLinksProps) {
  const { mode } = useTheme();
  const palette = SOCIAL_COLORS[mode];

  if (!links.instagram && !links.linkedin && !links.facebook) return null;

  const openLink = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SectionBlock>
      <T.CapsSm style={{ marginBottom: spacing.sm + 2 }}>Linked Accounts</T.CapsSm>
      <Stack gap="sm">
        {PLATFORMS.map(({ key, label, url }) => {
          const handle = links[key];
          if (!handle) return null;
          return (
            <Pressable
              key={key}
              onPress={() => openLink(url(handle))}
              accessibilityRole="link"
              accessibilityLabel={`Open ${label} profile @${handle}`}
            >
              <Row gap="sm" style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.sm, backgroundColor: palette[key].bg }}>
                <Text style={[textStyles.labelMd, { color: palette[key].fg, minWidth: 72 }]}>{label}</Text>
                <Text style={[textStyles.bodyMd, { color: palette[key].fg }]}>@{handle}</Text>
              </Row>
            </Pressable>
          );
        })}
      </Stack>
    </SectionBlock>
  );
}
