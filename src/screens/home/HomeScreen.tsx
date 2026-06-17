import React, { useState, useMemo, useEffect } from 'react';
import { isToday, isTomorrow } from '@/utils/time';
import { View, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Tap } from '@/components/atoms/Tap';
import { FadeUp } from '@/components/atoms/FadeUp';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { FilterPills } from '@/components/organisms/FilterPills';
import { LocationPickerSheet } from '@/components/organisms/LocationPickerSheet';
import { Spacer } from '@/components/layout/Spacer';
import { PulseBar } from '@/components/molecules/PulseBar';
import { TabBar } from '@/components/molecules/TabBar';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import { PlanRow } from '@/components/molecules/PlanRow';
import { PersonRow } from '@/components/molecules/PersonRow';
import { SearchBar } from '@/components/atoms/inputs/SearchBar';
import { Icon } from '@/components/atoms/Icon';
import { Logo } from '@/components/atoms/Logo';
import { IconBox } from '@/components/atoms/IconBox';
import { EmptyState } from '@/components/atoms/EmptyState';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, iconSizes, radii } from '@/theme/tokens';
import { useHomeFeed } from '@/api/hooks/useHomeFeed';
import { useHomeLocation } from '@/api/hooks/useHomeLocation';
import { searchUsers } from '@/api/users';
import { errorMessage } from '@/api/errors';
import { planDetailRoute } from '@/utils/plan';
import type { HomeStackParamList } from '@/navigation/types';
import { Plan, User } from '@/types';

type Props = StackScreenProps<HomeStackParamList, 'Home'>;
type HomeTab = 'nearby' | 'joined' | 'created';
type SortOrder = 'soonest' | 'latest' | 'distance';

const PREVIEW_EMPTY: HomeTab | null = null;

export function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<HomeTab>('nearby');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortOrder>('soonest');
  const [people, setPeople] = useState<User[]>([]);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const { location, setManual, useGPS } = useHomeLocation();
  const { plans: feed, loading, refreshing, error, refetch } = useHomeFeed(
    location ? { lat: location.lat, lng: location.lng, radiusKm: 25 } : {},
  );

  const handleJoin = (id: string) => navigation.navigate('Plan', { planId: id });

  // People search runs server-side (search_users) only on the Nearby tab while
  // typing (≥2 chars); plans are still filtered client-side from the feed below.
  useEffect(() => {
    let cancelled = false;
    const q = search.trim();
    if (tab !== 'nearby' || q.length < 2) { setPeople([]); return; }
    const t = setTimeout(async () => {
      try { const r = await searchUsers(q); if (!cancelled) setPeople(r); }
      catch { if (!cancelled) setPeople([]); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, tab]);

  const myPlans = useMemo(() => feed.filter((p) => p.isMine), [feed]);
  const joinedPlans = useMemo(() => feed.filter((p) => p.viewerJoined), [feed]);

  const filteredNearby = useMemo(() => {
    let list = feed.filter((p) => p.status === 'active' || p.status === 'full');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.activity.toLowerCase().includes(q) || p.location.toLowerCase().includes(q));
    }
    if (filter === 'now') list = list.filter((p) => p.minutesUntilStart >= 0 && p.minutesUntilStart <= 240);
    if (filter === 'later_today') list = list.filter((p) => p.minutesUntilStart > 240 && isToday(p.startsAt));
    if (filter === 'tomorrow') list = list.filter((p) => isTomorrow(p.startsAt));
    if (filter === 'week') list = list.filter((p) => p.minutesUntilStart > 240 && !isToday(p.startsAt) && !isTomorrow(p.startsAt));
    return list;
  }, [feed, search, filter]);


  const header = (
    <Stack style={{ backgroundColor: colors.bg }}>
      <Row gap="sm" style={{ paddingHorizontal: spacing.screenPx, paddingTop: spacing.sm + 2, paddingBottom: spacing.sm, borderBottomWidth: borderWidths.thin, borderBottomColor: colors.border }}>
        <Logo height={20} />
        <Spacer flex />
        <Tap
          onPress={() => navigation.navigate('HomeMap')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm + 2, height: 32, borderWidth: borderWidths.medium, borderRadius: radii.full, backgroundColor: colors.surface, borderColor: colors.border }}
          accessibilityLabel="Map view"
        >
          <Icon name="map" size={iconSizes.xs} color={colors.textSub} />
          <T.LabelXs color={colors.textSub}>Map</T.LabelXs>
        </Tap>
        <Tap
          onPress={() => setLocationPickerOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm + 2, height: 32, borderWidth: borderWidths.medium, borderRadius: radii.full, backgroundColor: colors.surface, borderColor: colors.border, flexShrink: 1 }}
          accessibilityLabel="Change location"
        >
          <Icon name="map-pin" size={iconSizes.xxs + 3} color={colors.coral} />
          <T.LabelXs numberOfLines={1} style={{ maxWidth: 120 }}>{location?.label || 'Set location'}</T.LabelXs>
          <Icon name="chevron-right" size={iconSizes.xxs + 2} color={colors.textDim} />
        </Tap>
      </Row>

      {tab === 'nearby' ? <PulseBar planCount={filteredNearby.length} /> : null}

      <TabBar
        tabs={[
          { id: 'nearby', label: 'Nearby' },
          { id: 'joined', label: joinedPlans.length > 0 ? `Joined · ${joinedPlans.length}` : 'Joined' },
          { id: 'created', label: myPlans.length > 0 ? `Created · ${myPlans.length}` : 'Created' },
        ]}
        active={tab}
        onSelect={(id) => setTab(id as HomeTab)}
      />

      {tab === 'nearby' ? (
        <Stack gap="sm" style={{ paddingTop: spacing.sm + 2, paddingBottom: spacing.sm }}>
          <View style={{ paddingHorizontal: spacing.screenPx }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search plans, activities, places…" />
          </View>
          <FilterPills
            pills={[
              { id: 'nearby', label: 'Nearby', icon: 'map-pin', active: filter === 'nearby' },
              { id: '__sep1', label: '|', active: false, disabled: true },
              { id: 'now', label: 'Now', active: filter === 'now', isNow: true },
              { id: 'later_today', label: 'Later Today', active: filter === 'later_today' },
              { id: 'tomorrow', label: 'Tomorrow', active: filter === 'tomorrow' },
              { id: 'week', label: 'Later This Week', active: filter === 'week' },
              { id: '__sep2', label: '|', active: false, disabled: true },
              { id: 'sort_soonest', label: '↑ Soonest', active: sort === 'soonest' },
              { id: 'sort_latest', label: '↓ Latest', active: sort === 'latest' },
              { id: 'sort_distance', label: '⊙ Distance', active: sort === 'distance' },
              { id: '__sep3', label: '|', active: false, disabled: true },
              { id: 'clear', label: 'Clear', active: false },
            ]}
            onSelect={(id) => {
              if (id === 'sort_soonest') setSort('soonest');
              else if (id === 'sort_latest') setSort('latest');
              else if (id === 'sort_distance') setSort('distance');
              else if (id === 'clear') { setFilter('all'); setSort('soonest'); }
              else setFilter(id);
            }}
          />
        </Stack>
      ) : null}
    </Stack>
  );

  const sectionedList = (plans: Plan[], variant: (p: Plan) => 'nearby' | 'joined' | 'created') => {
    const sorted = [...plans].sort((a, b) => {
      if (sort === 'soonest') return a.minutesUntilStart - b.minutesUntilStart;
      if (sort === 'latest') return b.minutesUntilStart - a.minutesUntilStart;
      return 0; // distance: preserve natural order (backend will sort by geo)
    });
    const now = sorted.filter((p) => p.minutesUntilStart >= 0 && p.minutesUntilStart <= 240);
    const later = sorted.filter((p) => p.minutesUntilStart > 240 && isToday(p.startsAt));
    const week = sorted.filter((p) => p.minutesUntilStart > 240 && !isToday(p.startsAt));
    const renderRow = (p: Plan, i: number) => (
      <FadeUp key={p.id} delay={i * 35} duration={320}>
        <PlanRow
          plan={p}
          variant={variant(p)}
          onPress={() => navigation.navigate(planDetailRoute(p), { planId: p.id })}
          onJoin={handleJoin}
        />
      </FadeUp>
    );
    return (
      <>
        {now.length > 0 ? (
          <><SectionHeader label="● NOW" count={now.length} />{now.map(renderRow)}</>
        ) : null}
        {later.length > 0 ? (
          <><SectionHeader label="LATER TODAY" count={later.length} />{later.map(renderRow)}</>
        ) : null}
        {week.length > 0 ? (
          <><SectionHeader label="THIS WEEK" count={week.length} />{week.map(renderRow)}</>
        ) : null}
      </>
    );
  };

  const activeList = PREVIEW_EMPTY === tab ? [] : tab === 'nearby' ? filteredNearby : tab === 'joined' ? joinedPlans : myPlans;

  const showPeople = tab === 'nearby' && search.trim().length >= 2 && people.length > 0;
  const peopleSection = showPeople ? (
    <>
      <SectionHeader label="PEOPLE" count={people.length} />
      {people.map((u) => (
        <PersonRow key={u.id} user={u} onPress={(id) => navigation.navigate('ProfileOther', { userId: id })} />
      ))}
    </>
  ) : null;

  const emptyContent = tab === 'nearby' && !search && filter === 'all' ? (
    <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xxxl + spacing.lg }}>
      <IconBox size={64} radius={20} bordered style={{ marginBottom: spacing.lg + 4 }}>
        <Icon name="map-pin" size={28} color={colors.textDim} />
      </IconBox>
      <T.Subheading style={{ textAlign: 'center', marginBottom: spacing.sm }}>No plans in {location?.label || 'your area'}</T.Subheading>
      <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.xxxl }}>
        Be the first to post one. Plans go live instantly — someone nearby might hop on.
      </T.BodyLg>
      <Tap
        onPress={() => navigation.navigate('Create')}
        style={{ paddingVertical: 14, paddingHorizontal: spacing.xxxl, borderRadius: radii.full, marginBottom: spacing.md, backgroundColor: colors.coral }}
      >
        <T.LabelLg color={colors.white}>+ Post a plan</T.LabelLg>
      </Tap>
      <Tap onPress={() => setLocationPickerOpen(true)} hitSlop={spacing.sm}>
        <T.Meta color={colors.textSub}>or <T.Semibold color={colors.coral}>change location →</T.Semibold></T.Meta>
      </Tap>
    </Stack>
  ) : tab === 'nearby' ? (
    <EmptyState emoji="🔍" title="No plans found" sub={search ? `No plans match "${search}"` : 'Try a different filter or expand your area.'} cta="Post a plan" onCtaPress={() => navigation.navigate('Create')} />
  ) : tab === 'joined' ? (
    <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xxxl + spacing.lg }}>
      <IconBox size={64} radius={20} bordered style={{ marginBottom: spacing.lg + 4 }}>
        <Icon name="user-check" size={28} color={colors.textDim} />
      </IconBox>
      <T.Subheading style={{ textAlign: 'center', marginBottom: spacing.sm }}>You haven't joined anything yet</T.Subheading>
      <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.xxxl }}>
        Hop on a plan nearby and it shows up here.
      </T.BodyLg>
      <Tap onPress={() => setTab('nearby')} style={{ paddingVertical: 14, paddingHorizontal: spacing.xxxl, borderRadius: radii.full, backgroundColor: colors.coral }}>
        <T.LabelLg color={colors.white}>See what's near you</T.LabelLg>
      </Tap>
    </Stack>
  ) : (
    <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xxxl + spacing.lg }}>
      <IconBox size={64} radius={20} bordered style={{ marginBottom: spacing.lg + 4 }}>
        <Icon name="calendar-plus" size={28} color={colors.textDim} />
      </IconBox>
      <T.Subheading style={{ textAlign: 'center', marginBottom: spacing.sm }}>You haven't posted a plan yet</T.Subheading>
      <T.BodyLg color={colors.textSub} style={{ textAlign: 'center', maxWidth: 260, marginBottom: spacing.xxxl }}>
        Post your first plan and people nearby can hop on instantly.
      </T.BodyLg>
      <Tap onPress={() => navigation.navigate('Create')} style={{ paddingVertical: 14, paddingHorizontal: spacing.xxxl, borderRadius: radii.full, backgroundColor: colors.coral }}>
        <T.LabelLg color={colors.white}>+ Post a plan</T.LabelLg>
      </Tap>
    </Stack>
  );

  const loadingContent = (
    <Stack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.coral} />
    </Stack>
  );

  const errorContent = (
    <EmptyState
      emoji="⚠️"
      title="Couldn't load plans"
      sub={errorMessage(error)}
      cta="Try again"
      onCtaPress={refetch}
    />
  );

  let body: React.ReactNode;
  if (loading) {
    body = loadingContent;
  } else if (error && feed.length === 0) {
    body = errorContent;
  } else if (activeList.length === 0) {
    body = showPeople ? (
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.coral} />}
      >
        {peopleSection}
        <Stack style={{ paddingHorizontal: spacing.screenPx, paddingVertical: spacing.lg }}>
          <T.BodyMd color={colors.textSub}>No plans match “{search.trim()}”.</T.BodyMd>
        </Stack>
      </ScrollView>
    ) : emptyContent;
  } else {
    body = (
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.coral} />}
      >
        {peopleSection}
        {tab === 'nearby'
          ? sectionedList(filteredNearby, (p) => (p.viewerJoined ? 'joined' : 'nearby'))
          : tab === 'joined'
          ? sectionedList(joinedPlans, () => 'joined')
          : sectionedList(myPlans, () => 'created')}
      </ScrollView>
    );
  }

  return (
    <Screen header={header} scroll={false}>
      {body}
      <LocationPickerSheet
        visible={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelectManual={setManual}
        onSelectGPS={useGPS}
      />
    </Screen>
  );
}
