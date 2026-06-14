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
import { supabase } from '@/api/client';
import { usePlanDetail } from '@/api/hooks/usePlanDetail';
import { endPlan, submitEndorsements, getPlanAttendees, type EndorseMark } from '@/api/trust';
import { errorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'Endorse'>;

const TAGS = ['Punctual', 'Easy to talk to', 'Good energy', 'Would join again', 'Great company', 'Reliable'];
interface Person { id: string; name: string; avatarUri?: string; isHost: boolean }

export function EndorseScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const planId = route.params?.planId;
  const { detail, loading } = usePlanDetail(planId);

  const [myUid, setMyUid] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [waiting, setWaiting] = useState(false);          // peer, plan not wrapped up yet
  const [noShow, setNoShow] = useState<Record<string, boolean>>({}); // default present; flag exceptions
  const [tag, setTag] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMyUid(data.session?.user.id ?? null));
  }, []);

  // Trust v2: everyone marks everyone (host + members + self). A plan auto-ends
  // ~1h after start (cron); if it hasn't yet, the host can lazily end it, but a
  // peer must wait until it's wrapped up.
  useEffect(() => {
    if (!detail || !planId) return;
    let cancelled = false;
    setLoadingPeople(true); setWaiting(false);
    (async () => {
      try {
        if (detail.plan.status !== 'ended') {
          if (detail.viewerIsHost) {
            try { await endPlan(planId); } catch { /* already ended / race — ignore */ }
          } else {
            if (!cancelled) { setWaiting(true); }
            return;
          }
        }
        const list = await getPlanAttendees(planId);
        if (!cancelled) setPeople(list);
      } catch {
        if (!cancelled) setPeople([]);
      } finally {
        if (!cancelled) setLoadingPeople(false);
      }
    })();
    return () => { cancelled = true; };
  }, [detail, planId]);

  const toggleNoShow = (id: string) => setNoShow((p) => ({ ...p, [id]: !p[id] }));
  const toggleTag = (id: string, t: string) => setTag((p) => ({ ...p, [id]: p[id] === t ? undefined : t }));
  const selfNoShow = !!(myUid && noShow[myUid]);

  const submit = useCallback(async () => {
    if (busy || !planId) return;
    setBusy(true);
    try {
      const marks: EndorseMark[] = people.map((p) => {
        const present = !noShow[p.id];
        const giveTag = present && p.id !== myUid && !selfNoShow && tag[p.id];
        return { subject_id: p.id, result: present ? 'present' : 'noshow', ...(giveTag ? { tag: tag[p.id] } : {}) };
      });
      await submitEndorsements(planId, marks);
      toast.show('Thanks — attendance submitted');
      navigation.popToTop();
    } catch (e) {
      toast.show(errorMessage(e, 'Couldn’t submit. Try again.'));
      setBusy(false);
    }
  }, [busy, planId, people, noShow, tag, myUid, selfNoShow, toast, navigation]);

  const cat = detail
    ? CATEGORIES.find((c) => c.id === detail.plan.categoryId) ?? CATEGORIES[CATEGORIES.length - 1]
    : null;

  const header = (
    <ScreenPad>
      <Row gap="md" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.LabelLg>Attendance & endorsements</T.LabelLg>
      </Row>
    </ScreenPad>
  );

  if ((loading && !detail) || (detail && loadingPeople && !waiting)) {
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
  if (waiting) {
    return (
      <Screen header={header} scroll={false}>
        <EmptyState emoji="⏳" title="Not quite yet" sub="This plan is still wrapping up. Check back shortly to mark attendance and endorse your crew." />
      </Screen>
    );
  }

  const plan = detail.plan;

  const footer = (
    <ScreenPad style={{ paddingVertical: spacing.md, paddingBottom: spacing.xxxl, borderTopWidth: borderWidths.thin, borderTopColor: colors.border, backgroundColor: colors.bg }}>
      <Button variant="primary-coral" label={busy ? 'Submitting…' : 'Submit attendance'} onPress={submit} disabled={busy || people.length === 0} />
    </ScreenPad>
  );

  return (
    <Screen header={header} footer={footer} scroll={false}>
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
          Everyone's marked here — tap “No-show” for anyone who didn't make it (including yourself). Endorsement tags are optional.
        </T.Meta>
        {selfNoShow ? (
          <T.MetaXs color={colors.cost.sponsoredFg} style={{ marginTop: spacing.xs }}>
            You marked yourself absent — endorsements are only available to attendees.
          </T.MetaXs>
        ) : null}
      </ScreenPad>

      {people.length === 0 ? (
        <EmptyState emoji="👥" title="No one to review" sub="This plan had no participants to mark." />
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {people.map((a) => {
            const isSelf = a.id === myUid;
            const present = !noShow[a.id];
            const showTags = present && !isSelf && !selfNoShow;
            return (
              <Stack key={a.id} gap="sm" style={{ paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.screenPx, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
                <Row gap="md" style={{ marginBottom: spacing.xs }}>
                  <Stack style={!present ? { opacity: 0.5 } : undefined}>
                    <Avatar uri={a.avatarUri} name={a.name} size={44} shape="circle" />
                  </Stack>
                  <Stack style={{ flex: 1 }}>
                    <T.LabelMd color={!present ? colors.textDim : colors.text}>
                      {a.name}{a.isHost ? ' · Host' : ''}{isSelf ? ' · You' : ''}
                    </T.LabelMd>
                    <Row gap={4} style={{ marginTop: 2 }}>
                      {present ? (
                        <>
                          <Icon name="circle-check" size={iconSizes.xxs + 1} color={colors.green} />
                          <T.MetaXs color={colors.green}>Showed up</T.MetaXs>
                        </>
                      ) : (
                        <>
                          <Icon name="x-circle" size={iconSizes.xxs + 1} color={colors.cost.sponsoredFg} />
                          <T.MetaXs color={colors.cost.sponsoredFg}>No-show</T.MetaXs>
                        </>
                      )}
                    </Row>
                  </Stack>
                </Row>

                <Row gap="sm" style={{ marginBottom: showTags ? spacing.sm : 0 }}>
                  <Pressable
                    onPress={() => { if (!present) toggleNoShow(a.id); }}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 9, borderRadius: radii.sm, borderWidth: borderWidths.medium, borderColor: present ? colors.green : colors.border, backgroundColor: present ? colors.cost.freeBg : colors.surface }}
                  >
                    <Icon name="check" size={iconSizes.xxs + 3} color={present ? colors.green : colors.textSub} strokeWidth={2.5} />
                    <T.LabelXs color={present ? colors.green : colors.textSub}>Showed up</T.LabelXs>
                  </Pressable>
                  <Pressable
                    onPress={() => { if (present) toggleNoShow(a.id); }}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 9, borderRadius: radii.sm, borderWidth: borderWidths.medium, borderColor: !present ? colors.cost.sponsoredFg : colors.border, backgroundColor: !present ? colors.cost.sponsoredBg : colors.surface }}
                  >
                    <Icon name="x" size={iconSizes.xxs + 3} color={!present ? colors.cost.sponsoredFg : colors.textSub} strokeWidth={2.5} />
                    <T.LabelXs color={!present ? colors.cost.sponsoredFg : colors.textSub}>No-show</T.LabelXs>
                  </Pressable>
                </Row>

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
          <Spacer size="xxxl" />
        </ScrollView>
      )}
    </Screen>
  );
}
