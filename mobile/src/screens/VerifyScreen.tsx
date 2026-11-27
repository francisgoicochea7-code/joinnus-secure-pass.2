import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, CheckCircle2, MapPin, ScanLine, Search, ShieldCheck, Ticket as TicketIcon, XCircle } from 'lucide-react-native';
import { api } from '../api/client';
import { Ticket } from '../api/types';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { QrScannerModal } from '../components/QrScannerModal';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { extractCodeFromQr, formatEventDate, seatLabel } from '../utils/format';
import { posterFor } from '../utils/posters';

export function VerifyScreen() {
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Ticket | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanner, setScanner] = useState(false);

  const verify = async (raw = code) => {
    const clean = extractCodeFromQr(raw);
    if (!clean) {
      setError('Escribe el codigo de la entrada o escanea su QR.');
      return;
    }
    setCode(clean);
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const response = await api.verify(clean);
      if (!response?.entrada) {
        setResult(null);
        setError('Ese codigo no corresponde a una entrada emitida.');
      } else {
        setResult(response.entrada);
      }
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'No se pudo verificar la entrada.');
    } finally {
      setLoading(false);
    }
  };

  const onScanned = (data: string) => {
    setScanner(false);
    verify(data);
  };

  const statusColor = result?.estadoDetalle?.color || theme.muted;
  const valid = result?.estado === 'valido';

  return (
    <Screen keyboard>
      <ScreenHeader title="Verificar" subtitle="Comprueba la autenticidad de un pase" />

      <Card style={styles.searchCard}>
        <View style={styles.searchIntro}>
          <View style={[styles.searchIcon, { backgroundColor: `${theme.accent}16`, borderColor: `${theme.accent}35` }]}>
            <ShieldCheck size={22} color={theme.accent} strokeWidth={2.1} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.searchTitle, { color: theme.text }]}>Consulta segura</Text>
            <Text style={[styles.searchText, { color: theme.muted }]}>La verificacion publica no marca la entrada como usada.</Text>
          </View>
        </View>
        <Input
          label="Codigo de entrada"
          placeholder="Ej. ENTRY001"
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setError('');
            setSearched(false);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          leftIcon={<TicketIcon size={17} color={theme.muted} strokeWidth={2.1} />}
          returnKeyType="done"
          onSubmitEditing={() => verify()}
        />
        <View style={styles.searchActions}>
          <Button label="Verificar" icon={Search} onPress={() => verify()} loading={loading} style={{ flex: 1 }} />
          <Button label="Escanear" icon={ScanLine} variant="secondary" onPress={() => setScanner(true)} style={{ flex: 1 }} />
        </View>
        <Button
          label="Probar con ENTRY001"
          variant="ghost"
          onPress={() => {
            setCode('ENTRY001');
            verify('ENTRY001');
          }}
          small
          style={styles.demoButton}
        />
      </Card>

      {error ? (
        <Card style={[styles.resultError, { borderColor: `${theme.danger}45`, backgroundColor: `${theme.danger}0D` }]}>
          <View style={styles.resultStatusRow}>
            <View style={[styles.resultStatusIcon, { backgroundColor: `${theme.danger}18` }]}>
              <XCircle size={24} color={theme.danger} strokeWidth={2.1} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.resultTitle, { color: theme.danger }]}>No verificada</Text>
              <Text style={[styles.resultText, { color: theme.textSoft }]}>{error}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {result ? (
        <Card style={styles.resultCard}>
          <View style={styles.resultStatusRow}>
            <View style={[styles.resultStatusIcon, { backgroundColor: `${statusColor}18` }]}>
              {valid ? <CheckCircle2 size={24} color={statusColor} strokeWidth={2.2} /> : <XCircle size={24} color={statusColor} strokeWidth={2.2} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.resultTitleRow}>
                <Text style={[styles.resultTitle, { color: theme.text }]}>{valid ? 'Entrada valida' : 'Entrada no valida'}</Text>
                <Badge label={result.estadoDetalle?.corta || result.estadoEtiqueta} color={statusColor} compact />
              </View>
              <Text style={[styles.resultText, { color: theme.muted }]}>{result.estadoDetalle?.descripcion}</Text>
            </View>
          </View>

          <View style={styles.eventRow}>
            <Image source={posterFor(result.evento, result.codigo)} style={styles.poster} resizeMode="cover" />
            <LinearGradient colors={['rgba(8,9,13,0.02)', 'rgba(8,9,13,0.78)']} style={styles.posterShade} />
            <View style={styles.eventContent}>
              <Text style={styles.eventCode}>{result.codigo}</Text>
              <Text style={styles.eventTitle} numberOfLines={2}>{result.evento}</Text>
              <View style={styles.eventMeta}>
                <CalendarDays size={11} color="rgba(255,253,249,0.7)" strokeWidth={2} />
                <Text style={styles.eventMetaText}>{formatEventDate(result.fecha, result.hora)}</Text>
              </View>
              <View style={styles.eventMeta}>
                <MapPin size={11} color="rgba(255,253,249,0.7)" strokeWidth={2} />
                <Text style={styles.eventMetaText} numberOfLines={1}>{result.lugar}</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailGrid}>
            <Detail label="Titular" value={result.titular} />
            <Detail label="Documento" value={result.dniOculto || '********'} />
            <Detail label="Ubicacion" value={seatLabel(result)} />
            <Detail label="Estado" value={result.estadoEtiqueta} />
          </View>
        </Card>
      ) : null}

      {!searched ? (
        <View style={styles.tip}>
          <ScanLine size={16} color={theme.brand} strokeWidth={2.1} />
          <Text style={[styles.tipText, { color: theme.muted }]}>
            Consejo: para validar el ingreso y marcarlo como usado, usa el Modo puerta desde el perfil.
          </Text>
        </View>
      ) : null}

      <QrScannerModal visible={scanner} onClose={() => setScanner(false)} onScanned={onScanned} title="Verificar pase" />
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.detail, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
      <Text style={[styles.detailLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.textSoft }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  searchCard: { marginBottom: 16 },
  searchIntro: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 17 },
  searchIcon: { width: 46, height: 46, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  searchTitle: { fontFamily, fontSize: 15, fontWeight: '800' },
  searchText: { fontFamily, fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  searchActions: { flexDirection: 'row', gap: 9 },
  demoButton: { marginTop: 8, alignSelf: 'center' },
  resultError: { marginBottom: 14 },
  resultCard: { marginBottom: 14 },
  resultStatusRow: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  resultStatusIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resultTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  resultTitle: { fontFamily, fontSize: 15, fontWeight: '800', flex: 1 },
  resultText: { fontFamily, fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  eventRow: { height: 128, borderRadius: 17, overflow: 'hidden', marginTop: 16, backgroundColor: '#11101a' },
  poster: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  posterShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  eventContent: { flex: 1, justifyContent: 'flex-end', padding: 12 },
  eventCode: { fontFamily, fontSize: 8.5, color: '#a9f0cf', fontWeight: '800', letterSpacing: 0.7 },
  eventTitle: { fontFamily, fontSize: 17, color: '#fffdf9', fontWeight: '800', marginTop: 2 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  eventMetaText: { fontFamily, fontSize: 9.5, color: 'rgba(255,253,249,0.7)', fontWeight: '600', flex: 1 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  detail: { width: '47.5%', borderWidth: 1, borderRadius: 12, padding: 10 },
  detailLabel: { fontFamily, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  detailValue: { fontFamily, fontSize: 11, fontWeight: '700', marginTop: 3 },
  tip: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingHorizontal: 4, marginTop: 8 },
  tipText: { fontFamily, fontSize: 10.5, lineHeight: 16, flex: 1 },
});
