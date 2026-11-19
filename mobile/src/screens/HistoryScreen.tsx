import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowUpRight, Clock3, History as HistoryIcon, LogIn } from 'lucide-react-native';
import { api } from '../api/client';
import { HistoryItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { actionLabel, formatDateTime, statusTone } from '../utils/format';
import { useTabNavigation } from '../navigation/useAppNavigation';

export function HistoryScreen() {
  const navigation = useTabNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!user?.dni) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      setItems(await api.history(user.dni));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.dni]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user) {
    return (
      <Screen>
        <ScreenHeader title="Historial" subtitle="Trazabilidad de tus entradas" />
        <Card style={styles.loginCard}>
          <EmptyState
            title="Tu historial es privado"
            message="Identificate para ver las compras, transferencias e ingresos de tus pases."
            action={<Button label="Iniciar sesion" icon={LogIn} onPress={() => navigation.navigate('Login')} small />}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load(true);
          }}
          tintColor={theme.brand}
        />
      }
    >
      <ScreenHeader title="Historial" subtitle={`Movimientos de ${user.nombre.split(' ')[0]}`} />

      <Card style={styles.summary}>
        <View style={[styles.summaryIcon, { backgroundColor: `${theme.info}16` }]}>
          <HistoryIcon size={22} color={theme.info} strokeWidth={2.1} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.summaryTitle, { color: theme.text }]}>Registro de actividad</Text>
          <Text style={[styles.summaryText, { color: theme.muted }]}>Cada cambio de titular o ingreso queda registrado para auditoria.</Text>
        </View>
        <Text style={[styles.count, { color: theme.text }]}>{items.length}</Text>
      </Card>

      {loading ? (
        <LoadingState label="Cargando movimientos..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : items.length ? (
        <View style={styles.timeline}>
          {items.map((item, index) => (
            <View key={`${item.id}-${index}`} style={styles.timelineItem}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, { backgroundColor: theme.brand }]} />
                {index < items.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: theme.border }]} /> : null}
              </View>
              <Card style={styles.eventCard}>
                <View style={styles.eventTop}>
                  <Badge label={actionLabel(item.accion)} color={theme.brand} compact />
                  <Text style={[styles.date, { color: theme.muted }]}>{formatDateTime(item.fecha)}</Text>
                </View>
                <Text style={[styles.ticketCode, { color: theme.muted }]}>{item.codigo}</Text>
                <Text style={[styles.detail, { color: theme.textSoft }]}>{item.detalle || item.titular || 'Movimiento registrado en la entrada.'}</Text>
                <View style={styles.eventBottom}>
                  <Clock3 size={11} color={theme.muted} strokeWidth={2} />
                  <Text style={[styles.eventBottomText, { color: theme.muted }]}>{item.titular || 'Sistema'}</Text>
                  <ArrowUpRight size={13} color={theme.muted} strokeWidth={2} />
                </View>
              </Card>
            </View>
          ))}
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <EmptyState title="Sin movimientos" message="Cuando compres, transfieras o uses una entrada, aparecera aqui." />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loginCard: { padding: 0 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontFamily, fontSize: 13, fontWeight: '800' },
  summaryText: { fontFamily, fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  count: { fontFamily, fontSize: 24, fontWeight: '800' },
  timeline: { paddingLeft: 2 },
  timelineItem: { flexDirection: 'row', gap: 11 },
  timelineRail: { width: 12, alignItems: 'center', paddingTop: 21 },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  timelineLine: { width: 1, flex: 1, marginTop: 5, marginBottom: -2 },
  eventCard: { flex: 1, marginBottom: 10, padding: 14 },
  eventTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  date: { fontFamily, fontSize: 9.5, fontWeight: '600' },
  ticketCode: { fontFamily, fontSize: 9, fontWeight: '800', letterSpacing: 0.7, marginTop: 8 },
  detail: { fontFamily, fontSize: 11, lineHeight: 16, marginTop: 3 },
  eventBottom: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  eventBottomText: { fontFamily, fontSize: 9, fontWeight: '600', flex: 1 },
  emptyCard: { padding: 0 },
});
