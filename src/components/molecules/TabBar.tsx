import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { fontFamilies } from '@/theme/tokens';

interface TabBarProps {
  tabs: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}

export function TabBar({ tabs, active, onSelect }: TabBarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={[
              styles.tab,
              isActive ? { borderBottomColor: colors.black } : { borderBottomColor: 'transparent' },
            ]}
            android_ripple={{ color: colors.surfaceMid }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? colors.text : colors.textSub,
                  fontFamily: isActive ? fontFamilies.bold : fontFamilies.semibold,
                },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2.5,
  },
  label: { fontSize: 14 },
});
