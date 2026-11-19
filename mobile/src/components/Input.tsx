import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
};

export function Input({ label, hint, error, leftIcon, style, onFocus, onBlur, ...props }: Props) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: theme.textSoft }]}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : focused ? theme.brand : theme.border,
          },
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          {...props}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.text }, style]}
        />
      </View>
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontFamily, fontSize: 12, fontWeight: '700', letterSpacing: 0.2, marginBottom: 7, marginLeft: 2 },
  field: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  icon: { marginRight: 9 },
  input: { flex: 1, fontFamily, fontSize: 15, fontWeight: '600', paddingVertical: 12 },
  error: { fontFamily, fontSize: 11, marginTop: 5, marginLeft: 3, fontWeight: '600' },
  hint: { fontFamily, fontSize: 11, marginTop: 5, marginLeft: 3 },
});
