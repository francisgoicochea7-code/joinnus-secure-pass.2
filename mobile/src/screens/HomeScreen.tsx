import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  History,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Ticket as TicketIcon,
  UserRound,
} from 'lucide-react-native';
import { api } from '../api/client';
import { Summary, Ticket } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { BrandMark } from '../components/BrandMark';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { FeaturedTicket, TicketCard } from '../components/TicketCard';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { StatCard } from '../components/StatCard';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { initials } from '../utils/format';
import { useTabNavigation } from '../navigation/useAppNavigation';

const emptySummary: Summary = { activas: 0, usadas: 0, transferidas: 0, anuladas: 0, total: 0, mias: 0 };

export function HomeScreen() {
  const navigation = useTabNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!user) {
      setSummary(emptySummary);
      setTickets([]);
      setError('');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      const [nextSummary, nextTickets] = await Promise.all([api.summary(), api.tickets()]);
      setSummary(nextSummary || emptySummary);
      setTickets(nextTickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la cartelera.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const featured = useMemo(
    () => tickets.find((ticket) => ticket.esMia && ticket.estado === 'valido') || tickets[0],
    [tickets]
  );
  const mine = useMemo(() => tickets.filter((ticket) => ticket.esMia), [tickets]);

  const openFeatured = () => {
    if (!featured) return;
    navigation.navigate('Ticket', { codigo: featured.codigo });
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.brand} />}>
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <BrandMark size={35} color={theme.brand} />
          <View>
            <Text style={[styles.brandName, { color: theme.text }]}>Secure Pass</Text>
            <Text style={[styles.brandMeta, { color: theme.muted }]}>JOINNUS · EXPERIENCIA MOVIL</Text>
          </View>
        </View>
        <Pressable
          onPress={() => navigation.navigate(user ? 'Perfil' : 'Login')}
          style={[styles.profileButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={user ? 'Abrir perfil' : 'Iniciar sesion'}
        >
          {user ? (
            <Text style={[styles.profileInitials, { color: theme.text }]}>{initials(user.nombre)}</Text>
          ) : (
            <UserRound size={18} color={theme.textSoft} strokeWidth={2} />
          )}
        </Pressable>
      </View>

      <View style={styles.helloRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: theme.muted }]}>{user ? 'BIENVENIDO DE NUEVO' : 'TU PASE DIGITAL'}</Text>
          <Text style={[styles.hello, { color: theme.text }]} numberOfLines={2}>
            {user ? `Hola, ${user.nombre.split(' ')[0]}` : 'Vive el evento sin friccion'}
          </Text>
        </View>
        {user ? (
          <View style={[styles.sessionChip, { backgroundColor: `${theme.ok}16`, borderColor: `${theme.ok}45` }]}>
            <CheckCircle2 size={12} color={theme.ok} strokeWidth={2.4} />
            <Text style={[styles.sessionText, { color: theme.ok }]}>Sesion activa</Text>
          </View>
        ) : (
          <View style={[styles.sessionChip, { backgroundColor: `${theme.warn}16`, borderColor: `${theme.warn}45` }]}>
            <Sparkles size={12} color={theme.warn} strokeWidth={2.2} />
            <Text style={[styles.sessionText, { color: theme.warn }]}>Vista demo</Text>
          </View>
        )}
      </View>

      <LinearGradient
        colors={['#1b1726', '#221a35', '#17131f']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroArt} pointerEvents="none">
          <BrandMark size={190} color="#c6b2ff" />
        </View>
        <Text style={styles.heroKicker}>JOINNUS · SECURE PASS</Text>
        <Text style={styles.heroTitle}>Tu entrada,{'\n'}en movimiento.</Text>
        <Text style={styles.heroText}>
          Compra, verifica y transfiere entradas con un pase dinamico que cambia cada 15 segundos.
        </Text>
        <View style={styles.heroActions}>
          <Button
            label={user ? 'Ver mi pase' : 'Identificarme'}
            icon={user ? TicketIcon : ShieldCheck}
            onPress={() => (user ? navigation.navigate('Entradas') : navigation.navigate('Login'))}
            style={styles.heroPrimary}
          />
          <HeroAction label="Verificar" icon={ScanLine} onPress={() => navigation.navigate('Verificar')} />
        </View>
        <View style={styles.heroFoot}>
          <ShieldCheck size={14} color="#a9f0cf" strokeWidth={2.2} />
          <Text style={styles.heroFootText}>QR firmado y renovado automaticamente</Text>
        </View>
      </LinearGradient>

      {loading && !summary.total ? (
        <LoadingState label="Cargando tu cartelera..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard label="Activas" value={summary.activas} icon={CheckCircle2} tone={theme.ok} />
            <StatCard label={user ? 'En tu cuenta' : 'En demo'} value={user ? Math.max(summary.mias || 0, mine.length) : mine.length} icon={TicketIcon} tone={theme.brand} />
            <StatCard label="Transferidas" value={summary.transferidas} icon={ArrowLeftRight} tone={theme.warn} />
          </View>

          <SectionHeader
            title="Tu proximo pase"
            subtitle={featured ? 'Abre el QR para ingresar al evento' : 'Aun no tienes un pase activo'}
            style={styles.section}
          />
          {featured ? (
            <FeaturedTicket ticket={featured} onPress={openFeatured} />
          ) : (
            <Card style={styles.emptyCard}>
              <EmptyState
                title="Sin entradas por ahora"
                message="Cuando tengas un pase, aparecera aqui con su QR dinamico."
                action={<Button label="Ver cartelera" variant="secondary" onPress={() => load()} small />}
              />
            </Card>
          )}

          <SectionHeader title="Accesos rapidos" subtitle="Todo lo que necesitas en la puerta" style={styles.section} />
          <View style={styles.actionsGrid}>
            <QuickAction
              title="Escanear"
              caption="Leer un QR"
              icon={ScanLine}
              color={theme.accent}
              onPress={() => navigation.navigate('Verificar')}
            />
            <QuickAction
              title="Transferir"
              caption="Enviar un pase"
              icon={ArrowLeftRight}
              color={theme.brand}
              onPress={() => {
                if (!featured) {
                  showToast({ type: 'info', title: 'Elige una entrada', message: 'Abre una entrada y usa el boton Transferir.' });
                  return;
                }
                navigation.navigate('Transfer', { codigo: featured.codigo });
              }}
            />
            <QuickAction
              title="Historial"
              caption="Trazabilidad"
              icon={History}
              color={theme.info}
              onPress={() => navigation.navigate('Historial')}
            />
            <QuickAction
              title="Modo puerta"
              caption="Personal del evento"
              icon={ShieldCheck}
              color={theme.warn}
              onPress={() => navigation.navigate('Staff')}
            />
          </View>

          <SectionHeader
            title="Tus entradas"
            subtitle={mine.length ? `${mine.length} pase(s) en tu cuenta` : 'Inicia sesion para verlas todas'}
            right={
              <Pressable onPress={() => navigation.navigate('Entradas')} style={styles.seeAll} accessibilityRole="button">
                <Text style={[styles.seeAllText, { color: theme.brand }]}>Ver todas</Text>
                <ChevronRight size={14} color={theme.brand} strokeWidth={2.4} />
              </Pressable>
            }
            style={styles.section}
          />
          {mine.length ? (
            mine.slice(0, 3).map((ticket) => (
              <TicketCard key={ticket.codigo} ticket={ticket} onPress={() => navigation.navigate('Ticket', { codigo: ticket.codigo })} />
            ))
          ) : (
            <Card style={styles.loginCard} onPress={() => navigation.navigate('Login')}>
              <View style={styles.loginRow}>
                <View style={[styles.loginIcon, { backgroundColor: `${theme.brand}18` }]}>
                  <TicketIcon size={22} color={theme.brand} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.loginTitle, { color: theme.text }]}>Identificate para ver tus pases</Text>
                  <Text style={[styles.loginText, { color: theme.muted }]}>Usa tu DNI y tu contrasena para ver tus pases.</Text>
                </View>
                <ArrowUpRight size={18} color={theme.brand} strokeWidth={2.2} />
              </View>
            </Card>
          )}
        </>
      )}

      <Text style={[styles.footer, { color: theme.muted }]}>
        Secure Pass · Demo funcional con datos de Joinnus. No compartas codigos de acceso.
      </Text>
    </Screen>
  );
}

function HeroAction({
  label,
  icon: Icon,
  onPress,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.heroSecondary, pressed && { opacity: 0.7 }]}
    >
      <Icon size={17} color="#fffdf9" strokeWidth={2.2} />
      <Text style={styles.heroSecondaryText}>{label}</Text>
    </Pressable>
  );
}

function QuickAction({
  title,
  caption,
  icon: Icon,
  color,
  onPress,
}: {
  title: string;
  caption: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.quick,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { opacity: 0.78, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: `${color}16`, borderColor: `${color}35` }]}>
        <Icon size={19} color={color} strokeWidth={2.1} />
      </View>
      <Text style={[styles.quickTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.quickCaption, { color: theme.muted }]}>{caption}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandName: { fontFamily, fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  brandMeta: { fontFamily, fontSize: 8, fontWeight: '700', letterSpacing: 1.1, marginTop: 2 },
  profileButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profileInitials: { fontFamily, fontSize: 13, fontWeight: '800' },
  helloRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 16 },
  eyebrow: { fontFamily, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4 },
  hello: { fontFamily, fontSize: 23, lineHeight: 27, fontWeight: '800', letterSpacing: -0.8, marginTop: 3 },
  sessionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, marginBottom: 3 },
  sessionText: { fontFamily, fontSize: 9.5, fontWeight: '800' },
  hero: { borderRadius: 28, padding: 21, minHeight: 300, overflow: 'hidden', marginBottom: 18 },
  heroArt: { position: 'absolute', right: -38, top: -25, opacity: 0.3 },
  heroKicker: { fontFamily, color: '#a9f0cf', fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { fontFamily, color: '#fffdf9', fontSize: 35, lineHeight: 36, fontWeight: '800', letterSpacing: -1.5, marginTop: 12, maxWidth: 260 },
  heroText: { fontFamily, color: 'rgba(255,253,249,0.68)', fontSize: 12.5, lineHeight: 19, marginTop: 10, maxWidth: 280 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 19 },
  heroPrimary: { minHeight: 46, borderRadius: 14, paddingHorizontal: 15 },
  heroSecondary: { minHeight: 46, borderRadius: 14, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroSecondaryText: { fontFamily, color: '#fffdf9', fontSize: 12, fontWeight: '800' },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  heroFootText: { fontFamily, color: 'rgba(169,240,207,0.76)', fontSize: 10, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 9 },
  section: { marginTop: 22 },
  emptyCard: { padding: 0, marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quick: { width: '48.2%', borderWidth: 1, borderRadius: 19, padding: 14, minHeight: 116, justifyContent: 'space-between' },
  quickIcon: { width: 35, height: 35, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  quickTitle: { fontFamily, fontSize: 13.5, fontWeight: '800', letterSpacing: -0.2 },
  quickCaption: { fontFamily, fontSize: 10, marginTop: 2, fontWeight: '500' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  seeAllText: { fontFamily, fontSize: 10.5, fontWeight: '800' },
  loginCard: { marginBottom: 10 },
  loginRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loginIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  loginTitle: { fontFamily, fontSize: 13, fontWeight: '800' },
  loginText: { fontFamily, fontSize: 10.5, marginTop: 3, lineHeight: 15 },
  footer: { fontFamily, fontSize: 9.5, lineHeight: 15, textAlign: 'center', marginTop: 28, paddingHorizontal: 20 },
});
