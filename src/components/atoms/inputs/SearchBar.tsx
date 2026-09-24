import React, { useState, useRef } from 'react';
import { TextInput as RNTextInput, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { radii, fontFamilies, shadow } from '@/theme/tokens';
import { Icon } from '../Icon';

interface SearchBarProps {
  value: string;
  onChangeText: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** 'list' (default) matches the in-list search bars (Home, LocSearch).
   *  'floating' is a fully-rounded pill with roomier padding and a standing
   *  shadow, for bars that float over content like the map. */
  variant?: 'list' | 'floating';
}

export function SearchBar({ value, onChangeText, onFocus, onBlur, placeholder = 'Search', autoFocus, variant = 'list' }: SearchBarProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<RNTextInput>(null);
  const active = focused || !!value;
  const floating = variant === 'floating';

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      style={[
        styles.wrap,
        floating && styles.wrapFloating,
        {
          backgroundColor: active ? colors.bg : colors.surface,
          borderColor: active ? colors.black : colors.border,
        },
        floating ? shadow.lg : (active ? shadow.sm : null),
      ]}
    >
      <Icon name="search" size={16} color={colors.textSub} />
      <RNTextInput
        ref={inputRef}
        style={[styles.input, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        autoFocus={autoFocus}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
          <Icon name="x" size={16} color={colors.textSub} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  wrapFloating: {
    borderRadius: radii.full,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  input: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    padding: 0,
  },
});
