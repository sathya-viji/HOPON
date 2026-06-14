import React, { useState } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, TextInputProps as RNTextInputProps } from 'react-native';
import { useTheme } from '@/theme';
import { radii, fontFamilies, letterSpacing } from '@/theme/tokens';

interface TextInputProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  maxLength?: number;
  autoFocus?: boolean;
  returnKeyType?: RNTextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  keyboardType?: RNTextInputProps['keyboardType'];
  secureTextEntry?: boolean;
  multiline?: boolean;
}

export function TextInput({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  maxLength,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  keyboardType,
  secureTextEntry,
  multiline,
}: TextInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.coral : focused ? colors.black : colors.border;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSub }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor,
          },
        ]}
      >
        <RNTextInput
          style={[
            styles.input,
            { color: colors.text, fontFamily: fontFamilies.semibold },
            multiline ? { minHeight: 80, textAlignVertical: 'top' } : null,
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={maxLength}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
        />
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.coral }]}>{error}</Text>
      ) : null}
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
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    minHeight: 48,
    justifyContent: 'center',
  },
  input: {
    fontSize: 14,
    paddingVertical: 12,
  },
  error: {
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    marginTop: 6,
  },
});
