import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Row } from '@/components/layout/Row';
import { Stack } from '@/components/layout/Stack';
import { ScreenPad } from '@/components/layout/ScreenPad';
import { Spacer } from '@/components/layout/Spacer';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import { Icon } from '@/components/atoms/Icon';
import * as T from '@/components/atoms/T';
import { useTheme } from '@/theme';
import { spacing, borderWidths, radii, iconSizes } from '@/theme/tokens';
import { useToast } from '@/hooks/useToast';
import type { ProfileStackParamList } from '@/navigation/types';

type Props = StackScreenProps<ProfileStackParamList, 'SettingsNeighbourhood'>;

const AREAS = [
  'HSR Layout', 'Koramangala', 'Indiranagar', 'Jayanagar', 'Whitefield',
  'Marathahalli', 'Electronic City', 'JP Nagar', 'Bannerghatta Road', 'Bellandur',
];

const RADII = [
  { val: 1,  label: '1 km',  sub: 'Hyper-local' },
  { val: 3,  label: '3 km',  sub: 'Neighbourhood' },
  { val: 5,  label: '5 km',  sub: 'Extended area' },
  { val: 10, label: '10 km', sub: 'Whole city' },
];

export function SettingsNeighbourhoodScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [selected, setSelected] = useState('HSR Layout');
  const [radius, setRadius] = useState(3);

  return (
    <Screen header={<ScreenHeader title="Change neighbourhood" onBack={() => navigation.goBack()} />}>
      <ScreenPad style={{ paddingTop: spacing.lg }}>
        <Pressable
          onPress={() => toast.show('Located you in HSR Layout')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.cost.freeBg }}
        >
          <Icon name="crosshair" size={iconSizes.lg} color={colors.cost.freeFg} />
          <View style={{ flex: 1 }}>
            <T.LabelLg color={colors.cost.freeFg}>Use my current location</T.LabelLg>
            <T.Meta color={colors.cost.freeFg}>Automatically detect your neighbourhood</T.Meta>
          </View>
          <Icon name="chevron-right" size={iconSizes.sm} color={colors.cost.freeFg} />
        </Pressable>
      </ScreenPad>

      <ScreenPad style={{ paddingTop: spacing.lg, paddingBottom: spacing.lg }}>
        <T.CapsSm style={{ marginBottom: spacing.sm + 2 }}>Show Plans Within</T.CapsSm>
        <Row wrap gap="sm">
          {RADII.map((r) => {
            const on = radius === r.val;
            return (
              <Pressable
                key={r.val}
                onPress={() => setRadius(r.val)}
                style={{
                  width: '48.5%',
                  padding: spacing.md, paddingHorizontal: spacing.lg,
                  borderRadius: radii.sm, borderWidth: borderWidths.medium,
                  backgroundColor: on ? colors.surfaceMid : colors.surface,
                  borderColor: on ? colors.black : colors.border,
                }}
              >
                <T.LabelMd color={on ? colors.text : colors.textSub}>{r.label}</T.LabelMd>
                <T.Meta>{r.sub}</T.Meta>
              </Pressable>
            );
          })}
        </Row>
      </ScreenPad>

      <ScreenPad style={{ paddingTop: spacing.sm }}>
        <T.CapsSm>Or Choose Area</T.CapsSm>
      </ScreenPad>
      <ScrollView showsVerticalScrollIndicator={false}>
        {AREAS.map((area) => {
          const on = selected === area;
          return (
            <Pressable
              key={area}
              onPress={() => setSelected(area)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                paddingVertical: 13, paddingRight: spacing.screenPx,
                paddingLeft: on ? spacing.screenPx - 3 : spacing.screenPx,
                borderBottomWidth: borderWidths.thin, borderBottomColor: colors.surface,
                backgroundColor: on ? colors.surface : 'transparent',
                borderLeftWidth: on ? 3 : 0, borderLeftColor: on ? colors.black : 'transparent',
              }}
            >
              <Icon name="map-pin" size={iconSizes.sm} color={on ? colors.black : colors.textDim} />
              <T.Semibold
                color={colors.text}
                style={{ flex: 1, fontFamily: on ? undefined : 'Inter-Medium' }}
              >
                {area}
              </T.Semibold>
              {on ? <Icon name="check" size={iconSizes.sm} color={colors.black} strokeWidth={2.5} /> : null}
            </Pressable>
          );
        })}
        <Spacer size="xxxl" />
      </ScrollView>
    </Screen>
  );
}
