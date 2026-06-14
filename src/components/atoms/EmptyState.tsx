import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { fontFamilies, spacing } from '@/theme/tokens';
import { Button } from './Button';

interface EmptyStateProps {
  emoji: string;
  title: string;
  sub?: string;
  cta?: string;
  onCtaPress?: () => void;
}

export function EmptyState({ emoji, title, sub, cta, onCtaPress }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {sub ? <Text style={[styles.sub, { color: colors.textSub }]}>{sub}</Text> : null}
      {cta ? (
        <View style={styles.cta}>
          <Button variant="secondary" label={cta} onPress={onCtaPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 40, marginBottom: spacing.md },
  title: {
    fontFamily: fontFamilies.extrabold,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sub: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  cta: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
