import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Inbox, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { Button } from './Button';

export function LoadingState({ label = 'Cargando informacion...' }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.brand} size="large" />
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.box, { borderColor: `${theme.danger}55`, backgroundColor: `${theme.danger}0D` }]}>
      <Text style={[styles.title, { color: theme.danger }]}>No se pudo cargar</Text>
      <Text style={[styles.message, { color: theme.textSoft }]}>{message}</Text>
      {onRetry ? <Button label="Reintentar" variant="secondary" icon={RefreshCw} onPress={onRetry} small style={styles.retry} /> : null}
    </View>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Inbox size={26} color={theme.muted} strokeWidth={1.7} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: theme.muted }]}>{message}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 46, alignItems: 'center', gap: 12 },
  label: { fontFamily, fontSize: 12, fontWeight: '600' },
  box: { borderWidth: 1, borderRadius: 18, padding: 16, marginVertical: 10 },
  title: { fontFamily, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  message: { fontFamily, fontSize: 12, lineHeight: 18 },
  retry: { alignSelf: 'flex-start', marginTop: 12 },
  empty: { paddingVertical: 38, alignItems: 'center', paddingHorizontal: 20 },
  emptyIcon: { width: 62, height: 62, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontFamily, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyMessage: { fontFamily, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 280 },
  action: { marginTop: 16 },
});
