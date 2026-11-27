import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  LockKeyhole,
  MapPin,
  Maximize2,
  QrCode,
  ScanLine,
  Share2,
  ShieldCheck,
  Ticket as TicketIcon,
  UserRound,
  X,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { api, ApiError } from '../api/client';
import { QrResult, Ticket } from '../api/types';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState, LoadingState } from '../components/States';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { formatDateTime, formatEventDate, formatPrice, seatLabel } from '../utils/format';
import { posterFor } from '../utils/posters';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Ticket'>;

export function TicketScreen({ route, navigation }: Props) {
  const { codigo } = route.params;
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [qr, setQr] = useState<QrResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [qrError, setQrError] = useState('');
  const [qrErrorCode, setQrErrorCode] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [qrExpanded, setQrExpanded] = useState(false);
  const { width } = useWindowDimensions();
  const bigQrSize = Math.max(190, Math.min(width - 104, 330));

  const loadTicket = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    setErrorCode('');
    try {
      const result = await api.ticket(codigo);
      if (!result?.entrada) {
        setTicket(null);
        setError('No encontramos una entrada con ese codigo.');
        return;
      }
      setTicket(result.entrada);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la entrada.');
      setErrorCode(err instanceof ApiError ? err.code || '' : '');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [codigo]);

  const loadQr = useCallback(async () => {
    if (!ticket?.esMia || ticket.estado !== 'valido') {
      setQr(null);
      setSeconds(0);
      return;
    }
    setQrError('');
    setQrErrorCode('');
    try {
      const result = await api.qr(codigo);
      setQr(result);
      setSeconds(Math.max(0, Math.ceil((new Date(result.expiraEn).getTime() - Date.now()) / 1000)));
    } catch (err) {
      setQr(null);
      setQrError(err instanceof Error ? err.message : 'No se pudo generar el QR.');
      setQrErrorCode(err instanceof ApiError ? err.code || '' : '');
    }
  }, [codigo, ticket]);

  useFocusEffect(
    useCallback(() => {
      loadTicket();
    }, [loadTicket])
  );

  // Sólo renueva el QR mientras esta pantalla está visible: evita tráfico y
  // rotaciones innecesarias cuando el usuario cambia de pestaña o bloquea la UI.
  useFocusEffect(
    useCallback(() => {
      void loadQr();
      const id = setInterval(() => { void loadQr(); }, 15000);
      return () => clearInterval(id);
    }, [loadQr])
  );

  useEffect(() => {
    if (!qr?.expiraEn) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(qr.expiraEn).getTime() - Date.now()) / 1000));
      setSeconds(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [qr?.expiraEn]);

  const copyToken = async () => {
    if (!qr?.payload) return;
    await Clipboard.setStringAsync(qr.payload);
    showToast({ type: 'success', title: 'Codigo copiado', message: 'El token se copio al portapapeles.' });
  };

  const shareTicket = async () => {
    if (!ticket) return;
    await Share.share({
      message: `${ticket.evento}\n${formatEventDate(ticket.fecha, ticket.hora)}\n${ticket.lugar}\nEntrada: ${ticket.codigo}`,
      title: `Entrada ${ticket.codigo}`,
    });
  };

  const canTransfer = Boolean(ticket?.puedeTransferir && ticket?.esMia);
  const statusColor = ticket?.estadoDetalle?.color || theme.muted;
  const poster = useMemo(() => posterFor(ticket?.evento || '', ticket?.codigo || ''), [ticket?.evento, ticket?.codigo]);

  if (loading && !ticket) {
    return (
      <Screen>
        <ScreenHeader title="Tu pase" back />
        <LoadingState label="Cargando tu entrada..." />
      </Screen>
    );
  }

  if (error || !ticket) {
    const offline = errorCode === 'network' || errorCode === 'timeout';
    return (
      <Screen>
        <ScreenHeader title="Tu pase" subtitle={codigo} back />
        {offline ? (
          <Card>
            <View style={styles.locked}>
              <View style={[styles.lockedIcon, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                <QrCode size={28} color={theme.muted} strokeWidth={1.7} />
              </View>
              <Text style={[styles.lockedTitle, { color: theme.text }]}>Sin conexion</Text>
              <Text style={[styles.lockedText, { color: theme.muted }]}>
                No pudimos cargar tu pase. Dicta este codigo al personal de puerta:
              </Text>
              <Text style={[styles.offlineCode, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
                {codigo}
              </Text>
              <Button
                label="Reintentar"
                variant="secondary"
                small
                onPress={() => { void loadTicket(); }}
                style={{ marginTop: 14 }}
              />
            </View>
          </Card>
        ) : (
          <ErrorState message={error || 'Entrada no encontrada.'} onRetry={() => loadTicket()} />
        )}
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
            loadTicket(true);
            loadQr();
          }}
          tintColor={theme.brand}
        />
      }
    >
      <ScreenHeader
        title="Tu pase"
        subtitle={ticket.codigo}
        back
        right={<Badge label={ticket.estadoDetalle?.corta || ticket.estadoEtiqueta} color={statusColor} compact />}
      />

      <View style={styles.hero}>
        <Image source={poster} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient colors={['rgba(8,9,13,0.05)', 'rgba(8,9,13,0.88)']} style={StyleSheet.absoluteFill} />
        <View style={styles.heroContent}>
          <View style={styles.heroTop}>
            <View style={styles.codeChip}>
              <TicketIcon size={12} color="#fffdf9" strokeWidth={2.2} />
              <Text style={styles.codeText}>{ticket.codigo}</Text>
            </View>
            <Pressable onPress={shareTicket} style={styles.shareButton} accessibilityRole="button" accessibilityLabel="Compartir">
              <Share2 size={17} color="#fffdf9" strokeWidth={2.2} />
            </Pressable>
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>{ticket.evento}</Text>
          <View style={styles.heroMeta}>
            <CalendarDays size={13} color="rgba(255,253,249,0.7)" strokeWidth={2.1} />
            <Text style={styles.heroMetaText}>{formatEventDate(ticket.fecha, ticket.hora)}</Text>
          </View>
          <View style={styles.heroMeta}>
            <MapPin size={13} color="rgba(255,253,249,0.7)" strokeWidth={2.1} />
            <Text style={styles.heroMetaText} numberOfLines={1}>{ticket.lugar}</Text>
          </View>
        </View>
      </View>

      <Card style={styles.qrCard}>
        <View style={styles.qrHeader}>
          <View>
            <Text style={[styles.qrTitle, { color: theme.text }]}>Pase dinamico</Text>
            <Text style={[styles.qrSubtitle, { color: theme.muted }]}>
              {ticket.esMia ? 'Se renueva cada 15 segundos' : 'El QR solo lo ve su titular'}
            </Text>
          </View>
          {ticket.esMia && ticket.estado === 'valido' ? (
            <View style={[styles.ttl, { backgroundColor: `${theme.accent}16`, borderColor: `${theme.accent}40` }]}>
              <Clock3 size={12} color={theme.accent} strokeWidth={2.3} />
              <Text style={[styles.ttlText, { color: theme.accent }]}>{seconds}s</Text>
            </View>
          ) : null}
        </View>

        {!ticket.esMia ? (
          <View style={styles.locked}>
            <View style={[styles.lockedIcon, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <LockKeyhole size={28} color={theme.muted} strokeWidth={1.7} />
            </View>
            <Text style={[styles.lockedTitle, { color: theme.text }]}>Entrada de otra persona</Text>
            <Text style={[styles.lockedText, { color: theme.muted }]}>
              Por seguridad, el QR completo solo se muestra al titular de la entrada.
            </Text>
          </View>
        ) : ticket.estado !== 'valido' ? (
          <View style={styles.locked}>
            <View style={[styles.lockedIcon, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <QrCode size={28} color={theme.muted} strokeWidth={1.7} />
            </View>
            <Text style={[styles.lockedTitle, { color: theme.text }]}>QR no disponible</Text>
            <Text style={[styles.lockedText, { color: theme.muted }]}>{ticket.estadoDetalle?.descripcion || 'Esta entrada ya no esta activa.'}</Text>
          </View>
        ) : qrError ? (
          <View style={styles.locked}>
            {qrErrorCode === 'network' || qrErrorCode === 'timeout' ? (
              <>
                <View style={[styles.lockedIcon, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                  <QrCode size={28} color={theme.muted} strokeWidth={1.7} />
                </View>
                <Text style={[styles.lockedTitle, { color: theme.text }]}>Sin conexion</Text>
                <Text style={[styles.lockedText, { color: theme.muted }]}>
                  No pudimos renovar tu QR. Dicta este codigo al personal de puerta:
                </Text>
                <Text style={[styles.offlineCode, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
                  {ticket.codigo}
                </Text>
              </>
            ) : (
              <Text style={[styles.lockedText, { color: theme.danger, textAlign: 'center' }]}>{qrError}</Text>
            )}
            <Button label="Reintentar QR" variant="secondary" onPress={loadQr} small style={{ marginTop: 14 }} />
          </View>
        ) : qr?.payload ? (
          <>
            <Pressable
              onPress={() => setQrExpanded(true)}
              style={styles.qrFramePress}
              accessibilityRole="button"
              accessibilityLabel="Ampliar el codigo QR"
            >
              <View style={[styles.qrFrame, { backgroundColor: '#fffdf9' }]}>
                <QRCode value={qr.payload} size={214} color="#17131f" backgroundColor="#fffdf9" quietZone={8} />
              </View>
              <View style={[styles.expandHint, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                <Maximize2 size={12} color={theme.textSoft} strokeWidth={2.3} />
                <Text style={[styles.expandHintText, { color: theme.textSoft }]}>Toca para ampliar</Text>
              </View>
            </Pressable>
            <View style={styles.tokenRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tokenLabel, { color: theme.muted }]}>TOKEN DE ACCESO</Text>
                <Text style={[styles.token, { color: theme.textSoft }]} numberOfLines={1}>{qr.payload}</Text>
              </View>
              <Pressable onPress={copyToken} style={[styles.copyButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel="Copiar token">
                <Copy size={16} color={theme.textSoft} strokeWidth={2.2} />
              </Pressable>
            </View>
            <View style={[styles.securityNote, { backgroundColor: `${theme.ok}0E`, borderColor: `${theme.ok}26` }]}>
              <ShieldCheck size={14} color={theme.ok} strokeWidth={2.2} />
              <Text style={[styles.securityText, { color: theme.ok }]}>El QR cambia automaticamente para evitar capturas reutilizadas.</Text>
            </View>
          </>
        ) : (
          <LoadingState label="Generando tu QR seguro..." />
        )}
      </Card>

      <Card style={styles.statusCard}>
        <View style={[styles.statusIcon, { backgroundColor: `${statusColor}1A` }]}>
          <CheckCircle2 size={20} color={statusColor} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, { color: theme.text }]}>{ticket.estadoEtiqueta}</Text>
          <Text style={[styles.statusText, { color: theme.muted }]}>{ticket.estadoDetalle?.descripcion || 'Consulta los detalles de tu pase.'}</Text>
        </View>
      </Card>

      <Card style={styles.detailsCard}>
        <Text style={[styles.detailsTitle, { color: theme.text }]}>Detalles del pase</Text>
        <InfoRow icon={UserRound} label="Titular" value={ticket.titular} />
        <InfoRow icon={TicketIcon} label="Documento" value={ticket.dniOculto || '********'} />
        <InfoRow icon={MapPin} label="Ubicacion" value={seatLabel(ticket)} />
        <InfoRow icon={CalendarDays} label="Comprada" value={formatDateTime(ticket.creadoEn)} />
        <View style={[styles.priceRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.priceLabel, { color: theme.muted }]}>Precio original</Text>
          <Text style={[styles.priceValue, { color: theme.text }]}>{formatPrice(ticket.precioOriginal ?? ticket.precio)}</Text>
        </View>
        {ticket.titularAnterior ? (
          <Text style={[styles.previous, { color: theme.muted }]}>
            Transferida por {ticket.titularAnterior}
          </Text>
        ) : null}
      </Card>

      <View style={styles.actions}>
        {canTransfer ? (
          <Button
            label="Transferir entrada"
            icon={ArrowLeftRight}
            onPress={() => navigation.navigate('Transfer', { codigo: ticket.codigo })}
          />
        ) : null}
        <Button
          label="Verificar en puerta"
          icon={ScanLine}
          variant="secondary"
          onPress={() => navigation.navigate('Main', { screen: 'Verificar' })}
        />
      </View>
      {qrExpanded && qr?.payload ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setQrExpanded(false)}
        >
          <View style={styles.qrModalBackdrop}>
            <View
              style={[styles.qrModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              accessibilityViewIsModal
            >
              <View style={styles.qrModalHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.qrModalTitle, { color: theme.text }]}>Tu pase</Text>
                  <Text style={[styles.qrModalSub, { color: theme.muted }]} numberOfLines={1}>{ticket.evento}</Text>
                </View>
                <Pressable
                  onPress={() => setQrExpanded(false)}
                  style={[styles.qrModalClose, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar el QR ampliado"
                >
                  <X size={18} color={theme.textSoft} strokeWidth={2.4} />
                </Pressable>
              </View>

              <View style={[styles.qrModalFrame, { backgroundColor: '#fffdf9' }]}>
                <QRCode value={qr.payload} size={bigQrSize} color="#17131f" backgroundColor="#fffdf9" quietZone={10} />
              </View>

              <View style={styles.qrModalMeta}>
                <Text style={[styles.qrModalCode, { color: theme.textSoft }]}>{ticket.codigo}</Text>
                {ticket.esMia && ticket.estado === 'valido' ? (
                  <Text style={[styles.qrModalCountdown, { color: theme.accent }]}>Se renueva en {seconds}s</Text>
                ) : null}
              </View>
              <Text style={[styles.qrModalHint, { color: theme.muted }]}>
                Sube el brillo de la pantalla y acerca el codigo al lector.
              </Text>
            </View>
          </View>
        </Modal>
      ) : null}

      <Pressable onPress={() => navigation.navigate('Main', { screen: 'Inicio' })} style={styles.backHome} accessibilityRole="button">
        <Text style={[styles.backHomeText, { color: theme.muted }]}>Volver al inicio</Text>
      </Pressable>
    </Screen>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: theme.surfaceRaised }]}>
        <Icon size={14} color={theme.muted} strokeWidth={2} />
      </View>
      <Text style={[styles.infoLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.textSoft }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 226, borderRadius: 25, overflow: 'hidden', marginBottom: 14, backgroundColor: '#11101a' },
  heroImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: 17 },
  heroTop: { position: 'absolute', top: 13, left: 13, right: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(8,9,13,0.56)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  codeText: { fontFamily, color: '#fffdf9', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  shareButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(8,9,13,0.56)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily, color: '#fffdf9', fontSize: 27, fontWeight: '800', letterSpacing: -1, lineHeight: 30 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, paddingRight: 12 },
  heroMetaText: { fontFamily, color: 'rgba(255,253,249,0.72)', fontSize: 10.5, fontWeight: '600', flex: 1 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 },
  statusIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontFamily, fontSize: 13, fontWeight: '800' },
  statusText: { fontFamily, fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  qrCard: { marginBottom: 14, alignItems: 'stretch' },
  qrHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  qrTitle: { fontFamily, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  qrSubtitle: { fontFamily, fontSize: 10.5, marginTop: 2 },
  ttl: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  ttlText: { fontFamily, fontSize: 10, fontWeight: '800' },
  qrFramePress: { alignItems: 'center' },
  qrFrame: { alignSelf: 'center', padding: 12, borderRadius: 20 },
  expandHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  expandHintText: { fontFamily, fontSize: 9.5, fontWeight: '700' },
  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  tokenLabel: { fontFamily, fontSize: 8.5, fontWeight: '800', letterSpacing: 1 },
  token: { fontFamily, fontSize: 10, marginTop: 3, fontWeight: '600' },
  copyButton: { width: 35, height: 35, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  securityNote: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 12, padding: 9, marginTop: 14 },
  securityText: { fontFamily, fontSize: 9.5, lineHeight: 14, flex: 1, fontWeight: '600' },
  locked: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  lockedIcon: { width: 66, height: 66, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  lockedTitle: { fontFamily, fontSize: 15, fontWeight: '800' },
  lockedText: { fontFamily, fontSize: 11.5, lineHeight: 17, color: '#8b8798', textAlign: 'center', marginTop: 5, maxWidth: 280 },
  offlineCode: { fontFamily, fontSize: 26, fontWeight: '800', letterSpacing: 2, borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10, marginTop: 12, overflow: 'hidden', textAlign: 'center' },
  detailsCard: { marginBottom: 14 },
  detailsTitle: { fontFamily, fontSize: 15, fontWeight: '800', marginBottom: 13 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  infoIcon: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontFamily, fontSize: 10.5, width: 80, fontWeight: '600' },
  infoValue: { fontFamily, fontSize: 11, flex: 1, textAlign: 'right', fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 13, marginTop: 5 },
  priceLabel: { fontFamily, fontSize: 11, fontWeight: '600' },
  priceValue: { fontFamily, fontSize: 15, fontWeight: '800' },
  previous: { fontFamily, fontSize: 10, marginTop: 8, fontStyle: 'italic' },
  actions: { gap: 9 },
  backHome: { alignSelf: 'center', paddingVertical: 16 },
  backHomeText: { fontFamily, fontSize: 11, fontWeight: '600' },
  qrModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 5, 9, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  qrModalCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
  },
  qrModalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  qrModalTitle: { fontFamily, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  qrModalSub: { fontFamily, fontSize: 11, marginTop: 2 },
  qrModalClose: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qrModalFrame: { alignSelf: 'center', borderRadius: 24, padding: 14 },
  qrModalMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16 },
  qrModalCode: { fontFamily, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  qrModalCountdown: { fontFamily, fontSize: 10.5, fontWeight: '800' },
  qrModalHint: { fontFamily, fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 12 },
});
