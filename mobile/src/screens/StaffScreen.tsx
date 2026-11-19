import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { CheckCircle2, LogOut, ScanLine, ShieldAlert, ShieldCheck, Ticket as TicketIcon, UserRound, XCircle } from 'lucide-react-native';
import { api, ApiError } from '../api/client';
import { StaffSession, StaffValidation } from '../api/types';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { QrScannerModal } from '../components/QrScannerModal';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { formatEventDate, seatLabel } from '../utils/format';

const reasons: Record<string, string> = {
  usado: 'Esta entrada ya fue utilizada.',
  anulada: 'La entrada fue anulada.',
  transferida: 'La entrada fue transferida a otra persona.',
  alterado: 'La firma del QR no coincide.',
  desconocido: 'El QR no pertenece a una entrada emitida.',
  formato: 'El codigo no tiene un formato valido.',
  expirado: 'El QR expiro. Pide que lo actualicen.',
  error: 'No se pudo validar la entrada.',
};

export function StaffScreen() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [session, setSession] = useState<StaffSession | null>(null);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [raw, setRaw] = useState('');
  const [registrar, setRegistrar] = useState(true);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<StaffValidation | null>(null);
  const [error, setError] = useState('');
  const [scanner, setScanner] = useState(false);
  const [scans, setScans] = useState(0);

  const enter = async () => {
    setLoginError('');
    if (!nombre.trim() || !codigo.trim()) {
      setLoginError('Escribe tu nombre y tu codigo de encargado.');
      return;
    }
    setLoggingIn(true);
    try {
      const response = await api.staffLogin(nombre.trim(), codigo.trim());
      setSession({ ...response.encargado, codigo: codigo.trim() });
      setResult(null);
      setRaw('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'No se pudo iniciar la sesion de encargado.');
    } finally {
      setLoggingIn(false);
    }
  };

  const validate = async (input = raw) => {
    if (!session) return;
    const value = String(input || '').trim();
    if (!value) {
      setError('Escanea un QR o escribe el codigo de la entrada.');
      return;
    }
    setValidating(true);
    setError('');
    setResult(null);
    setScans((current) => current + 1);
    try {
      const response = await api.staffValidate(session, value, registrar);
      setResult(response);
      if (response.valido) {
        showToast({
          type: 'success',
          title: response.registrado ? 'Ingreso registrado' : 'Entrada valida',
          message: response.entrada ? response.entrada.evento : 'El pase puede ingresar.',
        });
      } else {
        showToast({ type: 'error', title: 'Acceso denegado', message: reasons[response.motivo || ''] || response.mensaje || response.error || 'Entrada no valida.' });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSession(null);
        setLoginError('Tu sesion de encargado expiro. Vuelve a entrar.');
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo validar la entrada.');
      }
    } finally {
      setValidating(false);
    }
  };

  const closeSession = () => {
    setSession(null);
    setNombre('');
    setCodigo('');
    setRaw('');
    setResult(null);
    setScans(0);
  };

  if (!session) {
    return (
      <Screen keyboard>
        <ScreenHeader title="Modo puerta" subtitle="Acceso para personal del evento" back />
        <Card>
          <View style={styles.loginIntro}>
            <View style={[styles.loginIcon, { backgroundColor: `${theme.warn}16`, borderColor: `${theme.warn}38` }]}>
              <ShieldCheck size={24} color={theme.warn} strokeWidth={2.1} />
            </View>
            <Text style={[styles.loginTitle, { color: theme.text }]}>Valida ingresos en segundos</Text>
            <Text style={[styles.loginText, { color: theme.muted }]}>
              Ingresa con tu nombre y codigo de encargado. El codigo no se guarda en el dispositivo.
            </Text>
          </View>
          <Input
            label="Nombre del encargado"
            placeholder="Ej. Ana Torres"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="words"
            leftIcon={<UserRound size={17} color={theme.muted} strokeWidth={2.1} />}
          />
          <Input
            label="Codigo de encargado"
            placeholder="Codigo asignado"
            value={codigo}
            onChangeText={setCodigo}
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<ShieldCheck size={17} color={theme.muted} strokeWidth={2.1} />}
            secureTextEntry
          />
          {loginError ? <Text style={[styles.error, { color: theme.danger }]}>{loginError}</Text> : null}
          <Button label="Entrar al panel" icon={ShieldCheck} onPress={enter} loading={loggingIn} fullWidth />
          <View style={styles.demoBox}>
            <ShieldAlert size={14} color={theme.muted} strokeWidth={2} />
            <Text style={[styles.demoText, { color: theme.muted }]}>
              Los encargados demo estan definidos en la base de datos del proyecto. No compartas tu codigo.
            </Text>
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <ScreenHeader
        title="Modo puerta"
        subtitle={`${session.nombre} · ${scans} escaneo(s)`}
        back
        right={
          <Pressable onPress={closeSession} style={[styles.logout, { backgroundColor: theme.surface, borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel="Cerrar sesion de encargado">
            <LogOut size={17} color={theme.textSoft} strokeWidth={2.2} />
          </Pressable>
        }
      />

      <Card style={styles.scanCard}>
        <View style={styles.scanHeader}>
          <View style={[styles.scanIcon, { backgroundColor: `${theme.accent}16`, borderColor: `${theme.accent}35` }]}>
            <ScanLine size={24} color={theme.accent} strokeWidth={2.1} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.scanTitle, { color: theme.text }]}>Lector de pases</Text>
            <Text style={[styles.scanText, { color: theme.muted }]}>Escanea el QR dinamico o escribe el codigo.</Text>
          </View>
        </View>

        <Input
          label="QR o codigo de entrada"
          placeholder="JSP|ENTRY001|... o ENTRY001"
          value={raw}
          onChangeText={setRaw}
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon={<TicketIcon size={17} color={theme.muted} strokeWidth={2.1} />}
          onSubmitEditing={() => validate()}
          returnKeyType="done"
        />
        <View style={styles.actions}>
          <Button label="Validar" icon={ShieldCheck} onPress={() => validate()} loading={validating} style={{ flex: 1 }} />
          <Button label="Camara" icon={ScanLine} variant="secondary" onPress={() => setScanner(true)} style={{ flex: 1 }} />
        </View>
        <View style={[styles.registerRow, { borderTopColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.registerTitle, { color: theme.text }]}>Registrar ingreso</Text>
            <Text style={[styles.registerText, { color: theme.muted }]}>Marca la entrada como usada al validar.</Text>
          </View>
          <Switch
            value={registrar}
            onValueChange={setRegistrar}
            trackColor={{ false: theme.surfaceRaised, true: `${theme.ok}66` }}
            thumbColor={registrar ? theme.ok : theme.muted}
          />
        </View>
      </Card>

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      {result ? <ValidationResult result={result} /> : null}

      {!result ? (
        <View style={styles.tip}>
          <ShieldCheck size={15} color={theme.brand} strokeWidth={2.1} />
          <Text style={[styles.tipText, { color: theme.muted }]}>
            El QR se renueva cada 15 segundos. Si la pantalla muestra un QR vencido, pide que lo actualicen.
          </Text>
        </View>
      ) : null}

      <QrScannerModal visible={scanner} onClose={() => setScanner(false)} onScanned={(data) => { setScanner(false); setRaw(data); validate(data); }} title="Validar entrada" />
    </Screen>
  );
}

function ValidationResult({ result }: { result: StaffValidation }) {
  const { theme } = useTheme();
  const color = result.valido ? theme.ok : theme.danger;
  const Icon = result.valido ? CheckCircle2 : XCircle;
  const entry = result.entrada;

  return (
    <Card style={[styles.result, { borderColor: `${color}55` }]}>
      <View style={styles.resultHeader}>
        <View style={[styles.resultIcon, { backgroundColor: `${color}18` }]}>
          <Icon size={26} color={color} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.resultTitle, { color }]}>{result.valido ? 'Acceso permitido' : 'Acceso denegado'}</Text>
          <Text style={[styles.resultText, { color: theme.textSoft }]}>
            {result.valido ? (result.registrado ? 'La entrada quedo marcada como usada.' : 'La entrada es valida.') : reasons[result.motivo || ''] || result.mensaje || result.error || 'Entrada no valida.'}
          </Text>
        </View>
        {result.conFirma ? <Badge label="Firma OK" color={theme.ok} compact /> : null}
      </View>

      {entry ? (
        <View style={[styles.entryBox, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          <View style={styles.entryTop}>
            <Text style={[styles.entryCode, { color: theme.muted }]}>{entry.codigo}</Text>
            <Badge label={entry.estadoDetalle?.corta || entry.estadoEtiqueta} color={entry.estadoDetalle?.color || theme.muted} compact />
          </View>
          <Text style={[styles.entryTitle, { color: theme.text }]}>{entry.evento}</Text>
          <Text style={[styles.entryMeta, { color: theme.muted }]}>{formatEventDate(entry.fecha, entry.hora)} · {entry.lugar}</Text>
          <Text style={[styles.entryMeta, { color: theme.textSoft }]}>{entry.titular} · {entry.dniOculto || '********'}</Text>
          <Text style={[styles.entryMeta, { color: theme.muted }]}>{seatLabel(entry)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  loginIntro: { alignItems: 'center', paddingHorizontal: 12, marginBottom: 20 },
  loginIcon: { width: 58, height: 58, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  loginTitle: { fontFamily, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  loginText: { fontFamily, fontSize: 11.5, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 290 },
  error: { fontFamily, fontSize: 11, lineHeight: 16, fontWeight: '600', marginBottom: 10 },
  demoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 15 },
  demoText: { fontFamily, fontSize: 9.5, lineHeight: 14, flex: 1 },
  logout: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scanCard: { marginBottom: 14 },
  scanHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 17 },
  scanIcon: { width: 47, height: 47, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontFamily, fontSize: 16, fontWeight: '800' },
  scanText: { fontFamily, fontSize: 10.5, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 9 },
  registerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, marginTop: 15, paddingTop: 14 },
  registerTitle: { fontFamily, fontSize: 12, fontWeight: '800' },
  registerText: { fontFamily, fontSize: 9.5, marginTop: 2 },
  result: { marginBottom: 14 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  resultIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontFamily, fontSize: 16, fontWeight: '800' },
  resultText: { fontFamily, fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  entryBox: { borderWidth: 1, borderRadius: 15, padding: 12, marginTop: 14 },
  entryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  entryCode: { fontFamily, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  entryTitle: { fontFamily, fontSize: 15, fontWeight: '800', marginTop: 7 },
  entryMeta: { fontFamily, fontSize: 10, marginTop: 3, fontWeight: '500' },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  tipText: { fontFamily, fontSize: 10.5, lineHeight: 16, flex: 1 },
});
