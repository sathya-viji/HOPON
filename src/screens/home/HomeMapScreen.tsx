import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { SearchBar } from '@/components/atoms/inputs/SearchBar';
import { Icon } from '@/components/atoms/Icon';
import { Countdown } from '@/components/atoms/Countdown';
import { CostTag } from '@/components/atoms/CostTag';
import { Button } from '@/components/atoms/Button';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, radii, borderWidths, iconSizes, shadow, CATEGORIES } from '@/theme/tokens';
import { useHomeFeed } from '@/api/hooks/useHomeFeed';
import { deriveUrgency } from '@/utils/plan';
import type { HomeStackParamList } from '@/navigation/types';
import { Plan } from '@/types';

type Props = StackScreenProps<HomeStackParamList, 'HomeMap'>;

// absoluteFill is a structural layout constant, not a style value — acceptable in screen
const StyleSheet_absoluteFill = StyleSheet.absoluteFill;

export function HomeMapScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { plans: feed } = useHomeFeed();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Plan | null>(null);

  const visiblePlans = feed.filter(
    (p) =>
      (p.status === 'active' || p.status === 'full') &&
      (!search || p.activity.toLowerCase().includes(search.toLowerCase()) || p.location.toLowerCase().includes(search.toLowerCase())),
  );

  const minLat = 12.91; const maxLat = 12.98;
  const minLng = 77.59; const maxLng = 77.65;

  const project = (lat: number, lng: number) => ({
    x: ((lng - minLng) / (maxLng - minLng)) * 100,
    y: 100 - ((lat - minLat) / (maxLat - minLat)) * 100,
  });

  const selectedCat = selected ? CATEGORIES.find((c) => c.id === selected.categoryId) : undefined;

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: colors.surface }}>
        {/* Faux map grid */}
        <View style={StyleSheet_absoluteFill}>
          {Array.from({ length: 15 }).map((_, i) => (
            <View key={`h-${i}`} style={{ position: 'absolute', left: 0, right: 0, height: 1, top: `${(i + 1) * (100 / 16)}%` as any, backgroundColor: colors.border, opacity: 0.5 }} />
          ))}
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={`v-${i}`} style={{ position: 'absolute', top: 0, bottom: 0, width: 1, left: `${(i + 1) * (100 / 10)}%` as any, backgroundColor: colors.border, opacity: 0.5 }} />
          ))}
        </View>

        {/* User dot */}
        <View style={{ position: 'absolute', left: '52%', top: '60%', width: 14, height: 14, borderRadius: 7, backgroundColor: '#4285F4', borderWidth: 3, borderColor: '#fff' }} />

        {/* Plan pins — skip plans outside the projected map window so they
            don't render clipped at the edges or under the search bar */}
        {visiblePlans.map((p) => {
          const pos = project(p.lat, p.lng);
          if (pos.x < 4 || pos.x > 96 || pos.y < 12 || pos.y > 92) return null;
          const urgency = deriveUrgency(Math.max(0, p.minutesUntilStart));
          const isNow = urgency === 'now';
          const cat = CATEGORIES.find((c) => c.id === p.categoryId);
          return (
            <Pressable
              key={p.id}
              onPress={() => setSelected(p)}
              style={[{ position: 'absolute', left: `${pos.x}%` as any, top: `${pos.y}%` as any, width: 36, height: 36, borderRadius: 12, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', marginLeft: -18, marginTop: -18, backgroundColor: isNow ? colors.coral : colors.ctaBg, borderColor: colors.ctaFg }, isNow ? shadow.coral : shadow.md]}
              accessibilityRole="button"
              accessibilityLabel={`${p.activity} pin`}
            >
              <Icon name={(cat?.icon ?? 'sparkles') as never} size={iconSizes.sm} color={colors.ctaFg} strokeWidth={2.5} />
            </Pressable>
          );
        })}

        {/* Floating header: back + search */}
        <View style={{ position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={[shadow.md, { borderRadius: radii.full, backgroundColor: colors.bg }]}>
            <Button variant="back" onPress={() => navigation.goBack()} />
          </View>
          <View style={[shadow.md, { flex: 1, borderRadius: radii.sm }]}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search plans on map…" />
          </View>
        </View>

        {/* Selected plan card */}
        {selected ? (
          <View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, paddingBottom: spacing.xxl, backgroundColor: colors.bg }, shadow.lg]}>
            <View style={{ width: 36, height: 4, borderRadius: radii.full, alignSelf: 'center', marginTop: spacing.md, backgroundColor: colors.borderMid }} />
            <Row gap="md" style={{ padding: spacing.lg, paddingHorizontal: spacing.screenPx }}>
              <Stack style={{ width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: selectedCat?.bg ?? colors.surface }}>
                <Icon name={(selectedCat?.icon ?? 'sparkles') as never} size={22} color={selectedCat?.iconColor ?? colors.textSub} strokeWidth={2} />
              </Stack>
              <Stack style={{ flex: 1 }}>
                <T.LabelLg numberOfLines={1}>{selected.activity}</T.LabelLg>
                <T.MetaXs numberOfLines={1}>{selected.location}</T.MetaXs>
                <Row gap="sm" wrap style={{ marginTop: spacing.xs }}>
                  <Countdown startsAt={selected.startsAt} />
                  <CostTag type={selected.cost} note={selected.costNote} />
                </Row>
              </Stack>
              <Pressable onPress={() => setSelected(null)} hitSlop={spacing.sm}>
                <Icon name="x" size={iconSizes.md} color={colors.textDim} />
              </Pressable>
            </Row>
            <ScreenPad style={{ paddingTop: spacing.xs }}>
              <Button variant="primary-coral" label="HOP ON" onPress={() => navigation.navigate('Plan', { planId: selected.id })} />
            </ScreenPad>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
