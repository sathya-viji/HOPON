import React, { useState, useMemo, useEffect } from 'react';
import { View, FlatList } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Button } from '@/components/atoms/Button';
import { SearchBar } from '@/components/atoms/inputs/SearchBar';
import { EmptyState } from '@/components/atoms/EmptyState';
import { PlanRow } from '@/components/molecules/PlanRow';
import { PersonRow } from '@/components/molecules/PersonRow';
import { FilterPills } from '@/components/organisms/FilterPills';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, CATEGORIES } from '@/theme/tokens';
import { getHomeFeed, searchPlans } from '@/api/plans';
import { searchUsers } from '@/api/users';
import type { Plan, User } from '@/types';
import type { HomeStackParamList } from '@/navigation/types';

type Props = StackScreenProps<HomeStackParamList, 'Search'>;
type TimeFilter = 'all' | 'now' | 'soon' | 'today';

export function SearchScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [activity, setActivity] = useState<string>('All');
  const [time, setTime] = useState<TimeFilter>('all');
  const [results, setResults] = useState<Plan[]>([]);
  const [people, setPeople] = useState<User[]>([]);

  // Debounced: full-text search_plans + search_users when typing; browse the feed
  // when empty. Category is applied server-side to plans; people search is
  // name/@handle only (server requires ≥2 chars). The two fetches are
  // independent so one failing doesn't blank the other.
  useEffect(() => {
    let cancelled = false;
    const cat = activity !== 'All' ? activity : undefined;
    const q = query.trim();
    const t = setTimeout(async () => {
      try {
        const data = q
          ? await searchPlans(q, cat ? { categoryId: cat } : undefined)
          : await getHomeFeed(cat ? { filters: { categoryId: cat } } : {});
        if (!cancelled) setResults(data);
      } catch {
        if (!cancelled) setResults([]);
      }
      try {
        const ppl = q ? await searchUsers(q) : [];
        if (!cancelled) setPeople(ppl);
      } catch {
        if (!cancelled) setPeople([]);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, activity]);

  const filtered = useMemo(() => {
    let list = results;
    if (time === 'now') list = list.filter((p) => p.minutesUntilStart >= 0 && p.minutesUntilStart <= 15);
    else if (time === 'soon') list = list.filter((p) => p.minutesUntilStart >= 0 && p.minutesUntilStart <= 60);
    else if (time === 'today') list = list.filter((p) => p.minutesUntilStart >= 0 && p.minutesUntilStart <= 720);
    return list;
  }, [results, time]);

  const header = (
    <Stack>
      <Row gap="md" style={{ paddingHorizontal: spacing.screenPx, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <Button variant="back" onPress={() => navigation.goBack()} />
        <T.LabelLg style={{ flex: 1 }}>Search</T.LabelLg>
        <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.sm}>
          <T.Semibold color={colors.coral}>Done</T.Semibold>
        </Pressable>
      </Row>
      <Stack gap="sm" style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
        <View style={{ paddingHorizontal: spacing.screenPx }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Activities, places, people…" autoFocus />
        </View>
        <FilterPills
          pills={[
            { id: 'All', label: 'All', active: activity === 'All' },
            ...CATEGORIES.map((c) => ({ id: c.id, label: c.label.split(' ')[0], icon: c.icon as never, active: activity === c.id, isNow: false })),
          ]}
          onSelect={(id) => setActivity(id)}
        />
        <FilterPills
          pills={[
            { id: 'all', label: 'Any time', active: time === 'all' },
            { id: 'now', label: 'Now (≤15 min)', active: time === 'now' },
            { id: 'soon', label: 'Soon (≤1 hr)', active: time === 'soon' },
            { id: 'today', label: 'Later today', active: time === 'today' },
          ]}
          onSelect={(id) => setTime(id as TimeFilter)}
        />
      </Stack>
    </Stack>
  );

  // People (query-driven, filter-independent) render above plans inside the list.
  const listHeader = (
    <>
      {people.length > 0 ? (
        <Stack style={{ paddingTop: spacing.xs }}>
          <ScreenPad><T.CapsSm style={{ marginVertical: spacing.xs }}>PEOPLE</T.CapsSm></ScreenPad>
          {people.map((u) => (
            <PersonRow key={u.id} user={u} onPress={(id) => navigation.navigate('ProfileOther', { userId: id })} />
          ))}
        </Stack>
      ) : null}
      {filtered.length > 0 ? (
        <ScreenPad style={{ paddingTop: people.length > 0 ? spacing.md : spacing.xs }}>
          <T.CapsSm style={{ marginVertical: spacing.xs }}>{filtered.length} PLAN{filtered.length === 1 ? '' : 'S'}</T.CapsSm>
        </ScreenPad>
      ) : null}
    </>
  );

  return (
    <Screen header={header} scroll={false}>
      {filtered.length === 0 && people.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title={query ? 'No results' : 'No plans found'}
          sub={query ? `Nothing matches "${query}"` : 'Try changing your filters.'}
          cta="Post a plan"
          onCtaPress={() => navigation.navigate('Create')}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => (
            <PlanRow plan={item} variant="nearby" onPress={(id) => navigation.navigate('Plan', { planId: id })} onJoin={(id) => navigation.navigate('Plan', { planId: id })} />
          )}
          ListEmptyComponent={
            query ? (
              <ScreenPad style={{ paddingVertical: spacing.lg }}>
                <T.BodyMd color={colors.textSub}>No plans match “{query}”.</T.BodyMd>
              </ScreenPad>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      )}
    </Screen>
  );
}
