import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';

type Props = {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({ title, subtitle, back = false, right, style }: Props) {
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.back,
              { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <ChevronLeft size={21} color={theme.text} strokeWidth={2.2} />
          </Pressable>
        ) : null}
        <View style={styles.titleBox}>
          {title ? <Text style={[styles.title, { color: theme.text }]}>{title}</Text> : null}
          {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    minHeight: 44,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  titleBox: { flex: 1 },
  title: { fontFamily, fontSize: 23, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontFamily, fontSize: 12, marginTop: 3, fontWeight: '500' },
  back: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  right: { marginLeft: 12 },
});
