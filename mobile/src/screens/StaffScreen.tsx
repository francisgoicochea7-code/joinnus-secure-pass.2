import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, LogOut, ScanLine, Server, ShieldAlert, ShieldCheck, Ticket as TicketIcon, UserRound, XCircle } from 'lucide-react-native';
import { api, ApiError, getApiBaseUrl, loadApiSettings, setApiBaseUrl } from '../api/client';
import { StaffSession, StaffValidation, Ticket } from '../api/types';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { QrScannerModal, ScanFeedback } from '../components/QrScannerModal';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { formatEventDate, seatLabel } from '../utils/format';

function vibrar(tone: ScanFeedback['tone']) {
  const tipo = tone === 'ok'
    ? Haptics.NotificationFeedbackType.Success
    : tone === 'warn'
      ? Haptics.NotificationFeedbackType.Warning
      : Haptics.NotificationFeedbackType.Error;
  Haptics.notificationAsync(tipo).catch(() => undefined);
}

type PendingEntry = { raw: string; codigo: string; entrada?: Ticket; previewing: boolean };

/** Muestra solo el codigo, nunca el nonce ni el token completo del QR. */
function codigoVisible(value: string) {
  const codigoValido = /^[A-Z0-9][A-Z0-9-]{3,23}$/i;
  const partes = /^JSP\|([^|]+)\|[0-9A-F]{8,}(?:\|.*)?$/i.exec(value);
  if (partes && codigoValido.test(partes[1])) return partes[1].toUpperCase();
  const directo = /^JSP-(.+)-[0-9A-F]{8,}$/i.exec(value);
  if (directo && codigoValido.test(directo[1])) return directo[1].toUpperCase();
  return codigoValido.test(value) ? value.toUpperCase() : 'QR escaneado';
}

const reasons: Record<string, string> = {
  usada: 'Esta entrada ya fue utilizada.',
  usado: 'Esta entrada ya fue utilizada.',
  anulada: 'La entrada fue anulada.',
  transferida: 'La entrada fue transferida a otra persona.',
  titular: 'El QR pertenece al titular anterior. Pide el pase actualizado.',
  firma: 'La firma del QR no coincide.',
  invalidado: 'El QR fue reemplazado por uno mas reciente. Pide que lo actualicen.',
  desconocido: 'El QR no pertenece a una entrada emitida.',
  formato: 'El codigo no tiene un formato valido.',
  expirado: 'El QR expiro. Pide que lo actualicen.',
  estado: 'La entrada no esta vigente.',
  error: 'No se pudo validar la entrada.',
};

type Props = {
  /** La app de encargados abre directamente aqui: no hay pantalla anterior. */
  root?: boolean;
};

export function StaffScreen({ root = false }: Props) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [session, setSession] = useState<StaffSession | null>(null);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [raw, setRaw] = useState('');
  const [validating, setValidating] = useState(false);
  const validationInFlight = useRef(false);
  const previewId = useRef(0);
  const [pending, setPending] = useState<PendingEntry | null>(null);
  const [result, setResult] = useState<StaffValidation | null>(null);
  const [error, setError] = useState('');
  const [scanner, setScanner] = useState(false);
  const [scans, setScans] = useState(0);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showServer, setShowServer] = useState(false);
  const [server, setServer] = useState(getApiBaseUrl());
  const [savingServer, setSavingServer] = useState(false);

  useEffect(() => {
    let active = true;
    void loadApiSettings().then((saved) => {
      if (active) setServer(saved);
    });
    return () => { active = false; };
  }, []);

  const saveServer = async () => {
    setSavingServer(true);
    try {
      await setApiBaseUrl(server);
      showToast({ type: 'success', title: 'Servidor actualizado', message: 'Se usara en las proximas peticiones.' });
      setShowServer(false);
    } catch (err) {
      showToast({ type: 'error', title: 'Direccion invalida', message: err instanceof Error ? err.message : 'Revisa la URL.' });
    } finally {
      setSavingServer(false);
    }
  };

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const showFeedback = (value: ScanFeedback) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(value);
    vibrar(value.tone);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2800);
  };

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
      previewId.current += 1;
      setResult(null);
      setPending(null);
      setRaw('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'No se pudo iniciar la sesion de encargado.');
    } finally {
      setLoggingIn(false);
    }
  };

  const prepareEntry = (input = raw) => {
    if (!session || validationInFlight.current || pending) return;
    const value = String(input || '').trim();
    if (!value) {
      setError('Escanea un QR o escribe el codigo de la entrada.');
      return;
    }
    setError('');
    setResult(null);
    setFeedback(null);
    setRaw('');
    setScans((current) => current + 1);
    // Sin esperar la red: la confirmacion aparece inmediatamente.
    const id = ++previewId.current;
    setPending({ raw: value, codigo: codigoVisible(value), previewing: true });
    // Vista previa autenticada: nunca registra el ingreso ni bloquea el boton.
    void api.staffValidate(session, value, false).then((response) => {
      if (previewId.current !== id) return;
      if (response.valido) {
        setPending((current) => current?.raw === value
          ? { ...current, entrada: response.entrada, previewing: false }
          : current);
      } else {
        previewId.current += 1;
        setPending(null);
        setResult(response);
        const detalle = reasons[response.motivo || ''] || response.mensaje || response.error || 'Entrada no valida.';
        showFeedback({ tone: 'error', title: 'Entrada no valida', message: detalle });
      }
    }).catch((err: unknown) => {
      if (previewId.current !== id) return;
      if (err instanceof ApiError && err.status === 401) {
        previewId.current += 1;
        setPending(null);
        setSession(null);
        setScanner(false);
        setLoginError('Tu sesion de encargado expiro. Vuelve a entrar.');
      } else {
        // Aun puede confirmarse: el servidor validara la entrada al registrar.
        setPending((current) => current?.raw === value ? { ...current, previewing: false } : current);
      }
    });
  };

  const cancelEntry = () => {
    if (validationInFlight.current) return;
    previewId.current += 1;
    setPending(null);
    setResult(null);
    setRaw('');
    setFeedback(null);
  };

  const confirmEntry = async () => {
    if (!session || !pending || validationInFlight.current) return;
    const current = pending;
    previewId.current += 1;
    validationInFlight.current = true;
    setValidating(true);
    setError('');
    try {
      // Una sola peticion: el servidor valida el QR y registra solo si sigue vigente.
      const response = await api.staffValidate(session, current.raw, true);
      setPending(null);
      if (response.valido && response.registrado) {
        setResult(response);
        showFeedback({ tone: 'ok', title: 'Ingreso registrado', message: 'Listo para el siguiente pase.' });
        showToast({ type: 'success', title: 'Ingreso registrado', message: response.entrada?.evento || current.codigo });
      } else {
        const detalle = response.valido
          ? 'El servidor no confirmo el ingreso. Consulta el estado antes de reintentar.'
          : reasons[response.motivo || ''] || response.mensaje || response.error || 'El ingreso no se registro. Escanea de nuevo.';
        setResult({ ...response, valido: false, motivo: response.valido ? 'error' : response.motivo, mensaje: detalle });
        showFeedback({ tone: 'error', title: 'Ingreso no registrado', message: detalle });
        showToast({ type: 'error', title: 'Ingreso no registrado', message: detalle });
      }
    } catch (err) {
      setPending(null);
      setResult(null);
      const message = err instanceof Error ? err.message : 'No se pudo confirmar el ingreso.';
      if (err instanceof ApiError && err.status === 401) {
        setSession(null);
        setScanner(false);
        setLoginError('Tu sesion de encargado expiro. Vuelve a entrar.');
      } else {
        setError(`${message} Consulta el estado de la entrada antes de reintentar.`);
        showFeedback({ tone: 'error', title: 'Ingreso no confirmado', message });
      }
    } finally {
      validationInFlight.current = false;
      setValidating(false);
    }
  };

  const closeSession = () => {
    previewId.current += 1;
    setSession(null);
    setNombre('');
    setCodigo('');
    setRaw('');
    setResult(null);
    setPending(null);
    setScans(0);
    setScanner(false);
    setFeedback(null);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  };

  if (!session) {
    return (
      <Screen keyboard>
        <ScreenHeader title="Modo puerta" subtitle="Acceso para personal del evento" back={!root} />
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

        <Pressable onPress={() => setShowServer((value) => !value)} style={styles.serverToggle} accessibilityRole="button">
          <Server size={13} color={theme.muted} strokeWidth={2.1} />
          <Text style={[styles.serverToggleText, { color: theme.muted }]}>Servidor de la API</Text>
        </Pressable>
        {showServer ? (
          <Card>
            <Input
              label="Direccion de la API"
              value={server}
              onChangeText={setServer}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://.../api"
              hint="Con el celular en la misma red: http://TU-IP-LOCAL:8091/api"
            />
            <Button label="Guardar servidor" onPress={saveServer} loading={savingServer} fullWidth />
          </Card>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <ScreenHeader
        title="Modo puerta"
        subtitle={`${session.nombre} · ${scans} escaneo(s)`}
        back={!root}
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
            <Text style={[styles.scanText, { color: theme.muted }]}>Escanea el QR. Veras los datos del titular sin bloquear el boton; el ingreso se comprueba al confirmar.</Text>
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
          onSubmitEditing={() => prepareEntry()}
          returnKeyType="done"
        />
        <View style={styles.actions}>
          <Button label="Continuar" icon={ShieldCheck} onPress={() => prepareEntry()} disabled={validating || !!pending} style={{ flex: 1 }} />
          <Button label="Camara" icon={ScanLine} variant="secondary" onPress={() => { setFeedback(null); setScanner(true); }} disabled={!!pending} style={{ flex: 1 }} />
        </View>
        <View style={[styles.registerRow, { borderTopColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.registerTitle, { color: theme.text }]}>Ingreso con confirmacion</Text>
            <Text style={[styles.registerText, { color: theme.muted }]}>Escanear no marca la entrada como usada. El servidor la validara al confirmar.</Text>
          </View>
        </View>
      </Card>

      {pending ? (
        <Card style={styles.result}>
          <Text style={[styles.scanTitle, { color: theme.text }]}>¿Registrar el ingreso?</Text>
          <Text style={[styles.entryTitle, { color: theme.text }]}>{pending.entrada?.titular || pending.codigo}</Text>
          {pending.entrada ? (
            <Text style={[styles.entryMeta, { color: theme.muted }]}>{pending.entrada.evento} · {seatLabel(pending.entrada)}</Text>
          ) : pending.previewing ? (
            <Text style={[styles.entryMeta, { color: theme.muted }]}>Consultando titular y evento...</Text>
          ) : null}
          <Text style={[styles.registerText, { color: theme.muted }]}>El servidor vuelve a verificar el QR al confirmar. Solo una entrada vigente quedara marcada como usada.</Text>
          <View style={styles.actions}>
            <Button label="Cancelar" variant="secondary" onPress={cancelEntry} disabled={validating} style={{ flex: 1 }} />
            <Button label="Registrar ingreso" onPress={() => { void confirmEntry(); }} loading={validating} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      {result && !pending ? <ValidationResult result={result} /> : null}

      {!result && !pending ? (
        <View style={styles.tip}>
          <ShieldCheck size={15} color={theme.brand} strokeWidth={2.1} />
          <Text style={[styles.tipText, { color: theme.muted }]}>
            El QR se renueva cada 15 segundos. Si la pantalla muestra un QR vencido, pide que lo actualicen.
          </Text>
        </View>
      ) : null}

      <QrScannerModal
        visible={scanner}
        onClose={() => { if (!validating) { setScanner(false); cancelEntry(); } }}
        onScanned={prepareEntry}
        title="Validar entrada"
        continuous
        busy={validating || !!pending}
        feedback={pending ? null : feedback}
        confirmation={pending ? {
          codigo: pending.codigo,
          titular: pending.entrada?.titular,
          evento: pending.entrada?.evento,
          asiento: pending.entrada ? seatLabel(pending.entrada) : undefined,
          previewing: pending.previewing,
        } : null}
        onConfirm={() => { void confirmEntry(); }}
        onCancel={cancelEntry}
      />
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
          <Text style={[styles.resultTitle, { color }]}>{result.valido ? (result.registrado ? 'Ingreso registrado' : 'Entrada valida') : 'Acceso denegado'}</Text>
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
  serverToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  serverToggleText: { fontFamily, fontSize: 10, fontWeight: '600' },
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
