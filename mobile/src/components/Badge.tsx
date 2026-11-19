import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';

type Props = {
  label: string;
  color?: string;
  dot?: boolean;
  compact?: boolean;
};

export function Badge({ label, color, dot = true, compact = false }: Props) {
  const { theme } = useTheme();
  const tone = color || theme.muted;

  return (
    <View
      style={[
        styles.badge,
        compact && styles.compact,
        { backgroundColor: `${tone}18`, borderColor: `${tone}45` },
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: tone }]} /> : null}
      <Text style={[styles.label, compact && styles.labelCompact, { color: tone }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compact: { paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily, fontSize: 11, fontWeight: '800', letterSpacing: 0.1 },
  labelCompact: { fontSize: 10 },
});
