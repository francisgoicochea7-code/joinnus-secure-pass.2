import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowUpRight, LogIn, SlidersHorizontal, Ticket as TicketIcon } from 'lucide-react-native';
import { api } from '../api/client';
import { Ticket } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { TicketCard } from '../components/TicketCard';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { useTabNavigation } from '../navigation/useAppNavigation';

type Filter = 'todas' | 'validas' | 'usadas' | 'transferidas';

const filters: Array<{ key: Filter; label: string }> = [
  { key: 'todas', label: 'Todas' },
  { key: 'validas', label: 'Validas' },
  { key: 'usadas', label: 'Usadas' },
  { key: 'transferidas', label: 'Transferidas' },
];

export function TicketsScreen() {
  const navigation = useTabNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<Filter>('todas');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setTickets(await api.tickets());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las entradas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, user?.dni])
  );

  const visible = useMemo(() => {
    const source = user ? tickets.filter((ticket) => ticket.esMia) : tickets;
    if (filter === 'validas') return source.filter((ticket) => ticket.estado === 'valido');
    if (filter === 'usadas') return source.filter((ticket) => ticket.estado === 'usado');
    if (filter === 'transferidas') return source.filter((ticket) => ticket.estado === 'transferido');
    return source;
  }, [filter, tickets, user]);

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
      <ScreenHeader
        title="Mis entradas"
        subtitle={user ? `${visible.length} pase(s) en tu cuenta` : 'Vista de demostracion'}
        right={
          <View style={[styles.counter, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TicketIcon size={16} color={theme.brand} strokeWidth={2.2} />
            <Text style={[styles.counterText, { color: theme.text }]}>{visible.length}</Text>
          </View>
        }
      />

      {!user ? (
        <Card style={styles.loginBanner} onPress={() => navigation.navigate('Login')}>
          <View style={styles.loginRow}>
            <View style={[styles.loginIcon, { backgroundColor: `${theme.brand}18` }]}>
              <LogIn size={20} color={theme.brand} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.loginTitle, { color: theme.text }]}>Entra para ver tus pases</Text>
              <Text style={[styles.loginText, { color: theme.muted }]}>Los pases que ves ahora son de demostracion.</Text>
            </View>
            <ArrowUpRight size={17} color={theme.brand} strokeWidth={2.2} />
          </View>
        </Card>
      ) : null}

      <View style={styles.filterRow}>
        <SlidersHorizontal size={14} color={theme.muted} strokeWidth={2.1} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {filters.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.text : theme.surface,
                    borderColor: active ? theme.text : theme.border,
                  },
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, { color: active ? theme.bg : theme.textSoft }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingState label="Buscando tus entradas..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : visible.length ? (
        visible.map((ticket) => (
          <TicketCard key={ticket.codigo} ticket={ticket} onPress={() => navigation.navigate('Ticket', { codigo: ticket.codigo })} />
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <EmptyState
            title="No hay pases en este filtro"
            message={user ? 'Prueba con otro estado o vuelve a cargar la lista.' : 'Inicia sesion para ver las entradas de tu cuenta.'}
            action={
              user ? (
                <Button label="Ver todas" variant="secondary" onPress={() => setFilter('todas')} small />
              ) : (
                <Button label="Identificarme" onPress={() => navigation.navigate('Login')} small />
              )
            }
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  counter: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  counterText: { fontFamily, fontSize: 12, fontWeight: '800' },
  loginBanner: { marginBottom: 18, backgroundColor: 'rgba(198,178,255,0.08)' },
  loginRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  loginIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  loginTitle: { fontFamily, fontSize: 13, fontWeight: '800' },
  loginText: { fontFamily, fontSize: 10.5, marginTop: 3, lineHeight: 15 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
  chips: { gap: 7, paddingRight: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontFamily, fontSize: 10.5, fontWeight: '800' },
  emptyCard: { padding: 0 },
});
