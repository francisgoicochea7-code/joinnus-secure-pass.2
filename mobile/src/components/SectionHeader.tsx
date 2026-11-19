import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: object;
};

export function SectionHeader({ title, subtitle, right, style }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 },
  left: { flex: 1 },
  title: { fontFamily, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontFamily, fontSize: 11, marginTop: 2 },
});
