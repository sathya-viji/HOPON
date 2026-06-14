import React, { useState } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { radii, fontFamilies, letterSpacing } from '@/theme/tokens';

interface PhoneInputProps {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  error?: string;
}

export function PhoneInput({ label, value, onChangeText, placeholder = '99999 99999', autoFocus, error }: PhoneInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.coral : focused ? colors.black : colors.border;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.textSub }]}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          { backgroundColor: colors.surface, borderColor },
        ]}
      >
        <Text style={[styles.prefix, { color: colors.textSub }]}>🇮🇳 +91</Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <RNTextInput
          style={[styles.input, { color: colors.text }]}
          keyboardType="phone-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          maxLength={10}
        />
      </View>
      {error ? <Text style={[styles.error, { color: colors.coral }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 10,
    letterSpacing: letterSpacing.tags * 10,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 48,
  },
  prefix: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    marginRight: 10,
  },
  divider: {
    width: 1,
    height: 22,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    paddingVertical: 12,
  },
  error: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    marginTop: 6,
  },
});
