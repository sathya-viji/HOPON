import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Avatar } from '@/components/atoms/Avatar';
import { EmptyState } from '@/components/atoms/EmptyState';
import { EndorsementTag } from '@/components/molecules/EndorsementTag';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, CATEGORIES } from '@/theme/tokens';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { getPlanMembers } from '@/api/plans';
import { endPlan, submitEndorsements, getPlanAttendees, voteHostNoshow, type EndorseMark } from '@/api/trust';
import { errorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'Endorse'>;

const TAGS = ['Punctual', 'Easy to talk to', 'Good energy', 'Would join again', 'Great company', 'Reliable'];
type Status = 'present' | 'noshow' | undefined;
interface Person { id: string; name: string; avatarUri?: string }

export function EndorseScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const planId = route.params?.planId;
  const { detail, loading } = usePlanDetail(planId);

  const isHost = !!detail?.viewerIsHost;
  const planEnded = detail?.plan.status === 'ended';

  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [marks, setMarks] = useState<Record<string, Status>>({}); // host attendance
  const [tag, setTag] = useState<Record<string, string | undefined>>({}); // one tag per person
  const [busy, setBusy] = useState(false);

  // Attendee list: host reads the full member list (host-only RPC); a peer uses
  // the joiners embedded in plan detail (best-effort — see Wave 4 report note).
  useEffect(() => {
    if (!detail || !planId) return;
    let cancelled = false;
    setLoadingPeople(true);
    const loadPeople = async (): Promise<Person[]> => {
      if (detail.viewerIsHost) {
        const members = await getPlanMembers(planId);
        return members
          .filter((m) => m.status === 'joined' || m.status === 'approved' || m.status === 'attended' || m.status === 'noshow')
          .map((m) => ({ id: m.id, name: m.name, avatarUri: m.avatarUri }));
      }
      // Peer: co-attendees come from get_plan_attendees (ended plans only).
      if (detail.plan.status !== 'ended') return [];
      const attendees = await getPlanAttendees(planId);
      return attendees.map((a) => ({ id: a.id, name: a.name, avatarUri: a.avatarUri }));
    };
    loadPeople()
      .then((p) => { if (!cancelled) setPeople(p); })
      .catch(() => { if (!cancelled) setPeople([]); })
      .finally(() => { if (!cancelled) setLoadingPeople(false); });
    return () => { cancelled = true; };
  }, [detail, planId]);

  const setStatus = (id: string, s: Status) => setMarks((prev) => ({ ...prev, [id]: prev[id] === s ? undefined : s }));
  // single-select: one endorsement tag per person (endorsements are unique per giver+receiver)
  const toggleTag = (id: string, t: string) =>
    setTag((prev) => ({ ...prev, [id]: prev[id] === t ? undefined : t }));

  const allMarked = isHost && people.length > 0 && people.every((p) => marks[p.id] !== undefined);
  const anyTag = people.some((p) => tag[p.id]);

  const submit = useCallback(async () => {
    if (busy || !planId) return;
    setBusy(true);
    try {
      if (isHost) {
        // Lazy lifecycle-end: the first host attendance submission ends the plan.
        if (!planEnded) await endPlan(planId);
        const payload: EndorseMark[] = people.map((p) => ({
          subject_id: p.id,
          result: marks[p.id],
          ...(tag[p.id] ? { tag: tag[p.id] } : {}),
        }));
        await submitEndorsements(planId, payload);
      } else {
        const payload: EndorseMark[] = people
          .filter((p) => tag[p.id])
          .map((p) => ({ subject_id: p.id, tag: tag[p.id] }));
        await submitEndorsements(planId, payload);
      }
      toast.show('Endorsements submitted');
      navigation.popToTop();
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t submit. Try again.'));
      setBusy(false);
    }
  }, [busy, planId, isHost, planEnded, people, marks, tag, toast, navigation]);

  const reportHostNoshow = useCallback(async () => {
    if (!planId) return;
    try {
      await voteHostNoshow(planId);
      toast.show('Thanks — noted. The host is marked absent if enough attendees agree.');
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t submit that report.'));
    }
  }, [planId, toast]);

  const cat = detail
    ? CATEGORIES.find((c) => c.id === detail.plan.categoryId) ?? CATEGORIES[CATEGORIES.length - 1]
    : null;

  const header = (
    <ScreenPad>
      <Row gap="md" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.LabelLg>{isHost ? 'Attendance & endorsements' : 'Endorse your crew'}</T.LabelLg>
      </Row>
    </ScreenPad>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if ((loading && !detail) || (detail && loadingPeople)) {
    return (
      <Screen header={header} scroll={false}>
        <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral} />
        </Stack>
      </Screen>
    );
  }
  if (!detail || !cat) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState emoji="🔍" title="This plan isn’t available" sub="It may have been cancelled or is no longer visible to you." />
      </Screen>
    );
  }

  const plan = detail.plan;

  // ── Peer, but the host hasn't wrapped up yet ───────────────────────────────
  if (!isHost && !planEnded) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState
          emoji="⏳"
          title="Not quite yet"
          sub="The host is still wrapping up. You’ll be able to endorse once attendance is confirmed."
        />
      </Screen>
    );
  }

  const footer = (
    <ScreenPad style={{ paddingVertical: spacing.md, paddingBottom: spacing.xxxl, borderTopWidth: borderWidths.thin, borderTopColor: colors.border, backgroundColor: colors.bg }}>
      <Button
        variant="primary-coral"
        label={
          busy
            ? 'Submitting…'
            : isHost
              ? (allMarked ? 'Done — submit' : `Mark all ${people.length} attendees to continue`)
              : 'Submit endorsements'
        }
        onPress={submit}
        disabled={busy || (isHost ? !allMarked : !anyTag)}
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
        <T.LabelXs color={colors.textSub}>{people.length} {people.length === 1 ? 'person' : 'people'}</T.LabelXs>
      </Row>

      <ScreenPad style={{ paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <T.Meta color={colors.textSub}>
          {isHost
            ? 'Mark who showed up — this updates their attendance score. Endorsement tags are optional.'
            : 'Add an endorsement for the people you met. One tag each.'}
        </T.Meta>
      </ScreenPad>

      {people.length === 0 ? (
        <EmptyState emoji="👥" title="No one to endorse" sub="This plan had no other attendees." />
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {people.map((a) => {
            const status = marks[a.id];
            const showed = status === 'present';
            const noShow = status === 'noshow';
            const showTags = !isHost || showed; // peer always tags; host tags only present people

            return (
              <Stack key={a.id} gap="sm" style={{ paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
                <Row gap="md" style={{ marginBottom: spacing.xs }}>
                  <Stack style={noShow ? { opacity: 0.5 } : undefined}>
                    <Avatar uri={a.avatarUri} name={a.name} size={44} shape="circle" />
                  </Stack>
                  <Stack style={{ flex: 1 }}>
                    <T.LabelMd color={noShow ? colors.textDim : colors.text}>{a.name}</T.LabelMd>
                    {isHost ? (
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
                    ) : null}
                  </Stack>
                </Row>

                {isHost ? (
                  <Row gap="sm" style={{ marginBottom: showed ? spacing.sm : 0 }}>
                    <Pressable
                      onPress={() => setStatus(a.id, 'present')}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 9, borderRadius: radii.sm, borderWidth: borderWidths.medium, borderColor: showed ? colors.green : colors.border, backgroundColor: showed ? colors.cost.freeBg : colors.surface }}
                    >
                      <Icon name="check" size={iconSizes.xxs + 3} color={showed ? colors.green : colors.textSub} strokeWidth={2.5} />
                      <T.LabelXs color={showed ? colors.green : colors.textSub}>Showed up</T.LabelXs>
                    </Pressable>
                    <Pressable
                      onPress={() => setStatus(a.id, 'noshow')}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 9, borderRadius: radii.sm, borderWidth: borderWidths.medium, borderColor: noShow ? colors.cost.sponsoredFg : colors.border, backgroundColor: noShow ? colors.cost.sponsoredBg : colors.surface }}
                    >
                      <Icon name="x" size={iconSizes.xxs + 3} color={noShow ? colors.cost.sponsoredFg : colors.textSub} strokeWidth={2.5} />
                      <T.LabelXs color={noShow ? colors.cost.sponsoredFg : colors.textSub}>No-show</T.LabelXs>
                    </Pressable>
                  </Row>
                ) : null}

                {showTags ? (
                  <Row gap="sm" wrap>
                    {TAGS.map((t) => (
                      <EndorsementTag key={t} label={t} active={tag[a.id] === t} onPress={() => toggleTag(a.id, t)} />
                    ))}
                  </Row>
                ) : null}
              </Stack>
            );
          })}
          {!isHost ? (
            <Pressable onPress={reportHostNoshow} style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
              <T.Meta color={colors.textSub}>Host didn’t show up? <T.Meta color={colors.coral}>Report</T.Meta></T.Meta>
            </Pressable>
          ) : null}
          <Spacer size="xxxl" />
        </ScrollView>
      )}
    </Screen>
  );
}
