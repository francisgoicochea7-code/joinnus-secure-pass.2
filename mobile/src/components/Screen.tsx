import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  keyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Array<'top' | 'right' | 'bottom' | 'left'>;
  refreshControl?: React.ReactElement;
};

export function Screen({ children, scroll = true, keyboard = false, contentStyle, edges = ['top', 'left', 'right'], refreshControl }: ScreenProps) {
  const { theme } = useTheme();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, contentStyle]}>{children}</View>
  );

  return (
    <LinearGradient colors={theme.gradient} style={styles.fill}>
      <View pointerEvents="none" style={styles.glowOne}>
        <View style={[styles.orb, { backgroundColor: theme.brand, opacity: theme.mode === 'dark' ? 0.08 : 0.1 }]} />
      </View>
      <View pointerEvents="none" style={styles.glowTwo}>
        <View style={[styles.orb, styles.orbSmall, { backgroundColor: theme.accent, opacity: theme.mode === 'dark' ? 0.07 : 0.1 }]} />
      </View>
      <SafeAreaView style={styles.fill} edges={edges}>
        {keyboard ? (
          <KeyboardAvoidingView
            style={styles.fill}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={8}
          >
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  glowOne: { position: 'absolute', top: -120, right: -100 },
  glowTwo: { position: 'absolute', bottom: 40, left: -120 },
  orb: { width: 300, height: 300, borderRadius: 150 },
  orbSmall: { width: 240, height: 240, borderRadius: 120 },
});
