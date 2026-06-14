import React, { useRef } from 'react';
import { View, Text, TextInput as RNTextInput, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { radii, fontFamilies } from '@/theme/tokens';

interface OtpInputProps {
  length?: number;
  value: string;
  onChangeText: (v: string) => void;
  autoFocus?: boolean;
}

export function OtpInput({ length = 6, value, onChangeText, autoFocus = true }: OtpInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<RNTextInput>(null);
  const cells = Array.from({ length });
  const activeIndex = Math.min(value.length, length - 1);

  const handlePress = () => inputRef.current?.focus();

  return (
    <Pressable onPress={handlePress} style={styles.row}>
      {cells.map((_, i) => {
        const filled = i < value.length;
        const isActive = i === activeIndex;
        const borderColor = filled || isActive ? colors.black : colors.border;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              {
                backgroundColor: colors.surface,
                borderColor,
              },
            ]}
          >
            <Text style={[styles.cellText, { color: colors.text }]}>{value[i] ?? ''}</Text>
          </View>
        );
      })}
      <RNTextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        style={styles.hiddenInput}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, position: 'relative' },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});
