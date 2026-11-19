import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type Props = {
  label: string;
  value: string | number;
  icon: IconComponent;
  tone?: string;
};

export function StatCard({ label, value, icon: Icon, tone }: Props) {
  const { theme } = useTheme();
  const color = tone || theme.brand;
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.icon, { backgroundColor: `${color}17` }]}>
        <Icon size={16} color={color} strokeWidth={2.2} />
      </View>
      <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 12, minHeight: 104 },
  icon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  value: { fontFamily, fontSize: 22, fontWeight: '800', letterSpacing: -0.8 },
  label: { fontFamily, fontSize: 10.5, fontWeight: '600', marginTop: 1 },
});
