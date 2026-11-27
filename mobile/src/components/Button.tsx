import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconComponent;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  small = false,
}: Props) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  const palette = {
    primary: {
      background: theme.mode === 'dark' ? theme.paper : theme.text,
      border: theme.mode === 'dark' ? theme.paper : theme.text,
      text: theme.mode === 'dark' ? '#17131f' : '#fffdf9',
    },
    secondary: {
      background: theme.surface,
      border: theme.borderStrong,
      text: theme.text,
    },
    ghost: {
      background: 'transparent',
      border: 'transparent',
      text: theme.textSoft,
    },
    danger: {
      background: `${theme.danger}1A`,
      border: `${theme.danger}55`,
      text: theme.danger,
    },
  }[variant];

  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.small,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: isDisabled ? 0.45 : pressed ? 0.76 : 1,
          transform: pressed && !isDisabled ? [{ scale: 0.985 }] : [{ scale: 1 }],
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : Icon ? (
        <Icon size={small ? 16 : 18} color={palette.text} strokeWidth={2.2} />
      ) : null}
      <Text style={[styles.label, small && styles.labelSmall, { color: palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  small: { minHeight: 42, paddingHorizontal: 14, borderRadius: 13 },
  fullWidth: { width: '100%' },
  label: { fontFamily, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  labelSmall: { fontSize: 13 },
});
