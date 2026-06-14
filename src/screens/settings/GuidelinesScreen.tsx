import React from 'react';
import { View } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Divider } from '@/components/layout/Divider';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'Guidelines'>;

const RULES = [
  { emoji: '✅', title: 'Show up',                  body: 'If you join a plan, show up. Your attendance score is real. Repeated no-shows lower your score and hurt trust in the community.' },
  { emoji: '🤝', title: 'Treat people with respect', body: "hopon brings strangers together. Be kind, be curious, be the person you'd want to meet. No harassment, no aggression, no unsolicited advances." },
  { emoji: '📍', title: 'Meet in public',             body: "Always meet in public spaces for first-time plans. Safety first — yours and everyone else's. If a plan feels wrong, trust that instinct." },
  { emoji: '🚫', title: 'No deception',               body: "Don't create fake plans, fake profiles, or mislead people about who you are or what a plan involves. Authenticity is the whole point." },
  { emoji: '🔒', title: 'Closed plans are closed',   body: "If a plan requires host approval, respect that boundary. Don't show up uninvited. Don't share join links without the host's permission." },
  { emoji: '📸', title: 'Consent before you share',  body: 'Get consent before posting photos of other people in your recaps. Moments on hopon are public by default — be thoughtful.' },
  { emoji: '🚩', title: 'Report bad actors',          body: 'If someone makes you uncomfortable or violates these guidelines, report them. Tap the flag icon on any profile or plan. We review all reports.' },
  { emoji: '❤️', title: 'Build the neighbourhood',  body: 'hopon works because people show up for each other. Be a good neighbour. The community is only as good as each person in it.' },
];

export function GuidelinesScreen({ navigation }: Props) {
  const { colors } = useTheme();

  return (
    <Screen header={<ScreenHeader title="Community guidelines" onBack={() => navigation.goBack()} />}>
      <ScreenPad style={{ paddingTop: spacing.xl, paddingBottom: spacing.xxl }}>
        <T.BodyLg color={colors.textSub} style={{ marginBottom: spacing.xxl }}>
          hopon is built on showing up. These guidelines exist to keep the community honest, safe, and worth being part of.
        </T.BodyLg>
        {RULES.map((r, i) => (
          <View key={r.title}>
            <Row gap="lg" align="flex-start" style={{ paddingVertical: spacing.lg }}>
              <T.Heading>{r.emoji}</T.Heading>
              <Stack gap="sm" style={{ flex: 1 }}>
                <T.LabelLg color={colors.text}>{r.title}</T.LabelLg>
                <T.BodyMd color={colors.textSub}>{r.body}</T.BodyMd>
              </Stack>
            </Row>
            {i < RULES.length - 1 ? <Divider /> : null}
          </View>
        ))}
        <T.Meta style={{ textAlign: 'center', marginTop: spacing.xl }}>Violations may result in account suspension.</T.Meta>
      </ScreenPad>
    </Screen>
  );
}
