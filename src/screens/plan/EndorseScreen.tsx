import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Divider } from '@/components/layout/Divider';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import { EmptyState } from '@/components/atoms/EmptyState';
import { EndorsementTag } from '@/components/molecules/EndorsementTag';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, CATEGORIES } from '@/theme/tokens';
import { plans, getPlanById, getUserById } from '@/mocks';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'Endorse'>;

const TAGS = ['Punctual', 'Easy to talk to', 'Good energy', 'Would join again', 'Great company', 'Reliable'];
type Status = 'present' | 'noshow' | undefined;

export function EndorseScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const plan = getPlanById(route.params?.planId) ?? plans[1];
  const cat = CATEGORIES.find((c) => c.id === plan.categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
  const attendees = plan.joinerIds.map((id) => getUserById(id)).filter(Boolean);

  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [tags, setTags] = useState<Record<string, Set<string>>>({});

  const allMarked = attendees.length > 0 && attendees.every((a) => marks[a!.id] !== undefined);

  const setStatus = (id: string, s: Status) => setMarks((prev) => ({ ...prev, [id]: s }));
  const toggleTag = (id: string, t: string) =>
    setTags((prev) => {
      const next = { ...prev };
      const set = new Set(next[id] ?? []);
      if (set.has(t)) set.delete(t); else set.add(t);
      next[id] = set;
      return next;
    });

  const header = (
    <ScreenPad>
      <Row gap="md" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.LabelLg>Attendance & endorsements</T.LabelLg>
      </Row>
    </ScreenPad>
  );

  const footer = (
    <ScreenPad style={{ paddingVertical: spacing.md, paddingBottom: spacing.xxxl, borderTopWidth: borderWidths.thin, borderTopColor: colors.border, backgroundColor: colors.bg }}>
      <Button
        variant="primary-coral"
        label={allMarked ? 'Done — submit' : `Mark all ${attendees.length} attendees to continue`}
        onPress={() => { toast.show('Endorsements submitted'); navigation.popToTop(); }}
        disabled={!allMarked}
      />
    </ScreenPad>
  );

  return (
    <Screen header={header} footer={footer} scroll={false}>
      {/* Context strip */}
      <Row gap="sm" style={{ paddingHorizontal: spacing.screenPx, paddingVertical: spacing.sm + 2, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
        <Stack style={{ width: 32, height: 32, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: cat.bg }}>
          <Icon name={cat.icon as never} size={iconSizes.sm} color={cat.iconColor} strokeWidth={2} />
        </Stack>
        <Stack style={{ flex: 1 }}>
          <T.LabelSm>{plan.activity}</T.LabelSm>
          <T.MetaXs numberOfLines={1}>{plan.location.split(',')[0]}</T.MetaXs>
        </Stack>
        <T.LabelXs color={colors.textSub}>{attendees.length} attendee{attendees.length === 1 ? '' : 's'}</T.LabelXs>
      </Row>

      <ScreenPad style={{ paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <T.Meta color={colors.textSub}>Mark who showed up — this updates their attendance score. Endorsement tags are optional.</T.Meta>
      </ScreenPad>

      {attendees.length === 0 ? (
        <EmptyState emoji="👥" title="No attendees to review" sub="Plans with no joiners have no one to endorse." />
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {attendees.map((a) => {
            const aid = a!.id;
            const status = marks[aid];
            const showed = status === 'present';
            const noShow = status === 'noshow';
            const aTags = tags[aid] ?? new Set<string>();

            return (
              <Stack key={aid} gap="sm" style={{ paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
                <Row gap="md" style={{ marginBottom: spacing.xs }}>
                  <Stack style={noShow ? { opacity: 0.5 } : undefined}>
                    <Avatar uri={a!.avatarUri} name={a!.name} size={44} shape="circle" />
                  </Stack>
                  <Stack style={{ flex: 1 }}>
                    <T.LabelMd color={noShow ? colors.textDim : colors.text}>{a!.name}</T.LabelMd>
                    <Row gap={4} style={{ marginTop: 2 }}>
                      {showed ? (
                        <>
                          <Icon name="circle-check" size={iconSizes.xxs + 1} color={colors.green} />
                          <T.MetaXs color={colors.green}>Marked present</T.MetaXs>
                        </>
                      ) : noShow ? (
                        <>
                          <Icon name="x-circle" size={iconSizes.xxs + 1} color={colors.cost.sponsoredFg} />
                          <T.MetaXs color={colors.cost.sponsoredFg}>No-show</T.MetaXs>
                        </>
                      ) : (
                        <T.MetaXs color={colors.textDim}>Not marked yet</T.MetaXs>
                      )}
                    </Row>
                  </Stack>
                </Row>

                <Row gap="sm" style={{ marginBottom: showed ? spacing.sm : 0 }}>
                  <Pressable
                    onPress={() => setStatus(aid, 'present')}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 9, borderRadius: radii.sm, borderWidth: borderWidths.medium, borderColor: showed ? colors.green : colors.border, backgroundColor: showed ? colors.cost.freeBg : colors.surface }}
                  >
                    <Icon name="check" size={iconSizes.xxs + 3} color={showed ? colors.green : colors.textSub} strokeWidth={2.5} />
                    <T.LabelXs color={showed ? colors.green : colors.textSub}>Showed up</T.LabelXs>
                  </Pressable>
                  <Pressable
                    onPress={() => setStatus(aid, 'noshow')}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 9, borderRadius: radii.sm, borderWidth: borderWidths.medium, borderColor: noShow ? colors.cost.sponsoredFg : colors.border, backgroundColor: noShow ? colors.cost.sponsoredBg : colors.surface }}
                  >
                    <Icon name="x" size={iconSizes.xxs + 3} color={noShow ? colors.cost.sponsoredFg : colors.textSub} strokeWidth={2.5} />
                    <T.LabelXs color={noShow ? colors.cost.sponsoredFg : colors.textSub}>No-show</T.LabelXs>
                  </Pressable>
                </Row>

                {showed ? (
                  <Row gap="sm" wrap>
                    {TAGS.map((t) => (
                      <EndorsementTag key={t} label={t} active={aTags.has(t)} onPress={() => toggleTag(aid, t)} />
                    ))}
                  </Row>
                ) : null}
              </Stack>
            );
          })}
          <Spacer size="xxxl" />
        </ScrollView>
      )}
    </Screen>
  );
}
