import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/atoms/Button';
import { Icon, IconName } from '@/components/atoms/Icon';
import { useTheme } from '@/theme';
import { spacing, fontFamilies, radii, CATEGORIES } from '@/theme/tokens';
import { useOnboardingDraft } from '@/state/OnboardingDraftContext';
import type { OnboardingStackParamList } from '@/navigation/types';

type Props = StackScreenProps<OnboardingStackParamList, 'Interests'>;

export function InterestsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { update } = useOnboardingDraft();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const count = selected.size;
  const canContinue = count >= 2;

  const header = (
    <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPx }}>
      <Button variant="back" onPress={() => navigation.goBack()} />
    </View>
  );

  const footer = (
    <View style={{ padding: spacing.md, paddingHorizontal: spacing.screenPx, paddingBottom: 32, borderTopWidth: 1, backgroundColor: colors.bg, borderTopColor: colors.border }}>
      <Button variant="primary-coral" label={`Continue with ${count} interest${count === 1 ? '' : 's'}`} onPress={() => { update({ interests: [...selected] }); navigation.navigate('ContactsSync'); }} disabled={!canContinue} />
      {!canContinue ? (
        <Text style={{ fontFamily: fontFamilies.regular, fontSize: 12, textAlign: 'center', marginTop: 8, color: colors.textDim }}>Choose at least 2 to continue</Text>
      ) : null}
    </View>
  );

  return (
    <Screen header={header} footer={footer} scroll={false}>
      <View style={{ paddingHorizontal: spacing.screenPx, paddingTop: 24, paddingBottom: 16 }}>
        <Text style={{ fontFamily: fontFamilies.black, fontSize: 24, letterSpacing: -0.025 * 24, marginBottom: 6, color: colors.text }}>What are you into?</Text>
        <Text style={{ fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 14 * 1.5, color: colors.textSub }}>Pick at least 2. We'll show you the most relevant plans.</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.screenPx, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {CATEGORIES.map((cat) => {
            const on = selected.has(cat.id);
            return (
              <Pressable
                key={cat.id}
                onPress={() => toggle(cat.id)}
                style={{ width: '48.5%', height: 120, paddingVertical: 16, paddingHorizontal: 10, borderWidth: 1.5, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.surfaceMid : colors.surface, borderColor: on ? colors.text : colors.border }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={cat.label}
              >
                <View style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10, backgroundColor: cat.bg }}>
                  <Icon name={cat.icon as IconName} size={24} color={cat.iconColor} strokeWidth={2} />
                </View>
                <Text style={{ fontFamily: fontFamilies.bold, fontSize: 13, textAlign: 'center', color: colors.text, lineHeight: 17 }} numberOfLines={2}>{cat.label}</Text>
                {on ? (
                  <View style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ctaBg }}>
                    <Icon name="check" size={11} color={colors.ctaFg} strokeWidth={2.5} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
