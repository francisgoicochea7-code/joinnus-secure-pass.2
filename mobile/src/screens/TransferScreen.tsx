import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeftRight, Mail, ShieldAlert, Ticket as TicketIcon, UserRound } from 'lucide-react-native';
import { api, ApiError } from '../api/client';
import { Ticket } from '../api/types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { ErrorState, LoadingState } from '../components/States';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { formatEventDate, formatPrice, seatLabel } from '../utils/format';
import { posterFor } from '../utils/posters';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

type FieldErrors = Partial<Record<'nombre' | 'dni' | 'correo' | 'precio', string>>;

export function TransferScreen({ route, navigation }: Props) {
  const { codigo } = route.params;
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [correo, setCorreo] = useState('');
  const [precio, setPrecio] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.ticket(codigo);
      if (!result?.entrada) {
        setError('No encontramos esa entrada.');
        return;
      }
      setTicket(result.entrada);
      setPrecio(String(result.entrada.precioOriginal ?? result.entrada.precio ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la entrada.');
    } finally {
      setLoading(false);
    }
  }, [codigo]);

  useEffect(() => {
    load();
  }, [load]);

  const validate = () => {
    const next: FieldErrors = {};
    if (nombre.trim().length < 3) next.nombre = 'Escribe el nombre completo de la persona.';
    if (!/^\d{8}$/.test(dni.trim())) next.dni = 'El DNI debe tener exactamente 8 numeros.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) next.correo = 'Escribe un correo valido.';
    const amount = Number(precio);
    const max = Number(ticket?.precioOriginal ?? ticket?.precio ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) next.precio = 'El precio debe ser mayor a cero.';
    else if (max > 0 && amount > max) next.precio = `El maximo permitido es ${formatPrice(max)}.`;
    setFields(next);
    return Object.keys(next).length === 0;
  };

  const doTransfer = async () => {
    setSending(true);
    try {
      await api.transfer(codigo, { nombre: nombre.trim(), dni: dni.trim(), correo: correo.trim(), precio: Number(precio) });
      showToast({ type: 'success', title: 'Transferencia realizada', message: 'La entrada ya pertenece a la otra persona.' });
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFields(err.fields as FieldErrors);
      }
      showToast({ type: 'error', title: 'No se pudo transferir', message: err instanceof Error ? err.message : 'Intenta nuevamente.' });
    } finally {
      setSending(false);
    }
  };

  const confirm = () => {
    if (!validate()) return;
    Alert.alert(
      'Confirmar transferencia',
      `${nombre.trim()} recibira la entrada ${codigo}. Esta accion no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Transferir', style: 'destructive', onPress: doTransfer },
      ]
    );
  };

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Transferir" subtitle={codigo} back />
        <LoadingState label="Preparando la transferencia..." />
      </Screen>
    );
  }

  if (error || !ticket) {
    return (
      <Screen>
        <ScreenHeader title="Transferir" subtitle={codigo} back />
        <ErrorState message={error || 'Entrada no encontrada.'} onRetry={load} />
      </Screen>
    );
  }

  if (!ticket.esMia) {
    return (
      <Screen>
        <ScreenHeader title="Transferir" subtitle={codigo} back />
        <Card>
          <View style={styles.blocked}>
            <ShieldAlert size={30} color={theme.warn} strokeWidth={1.8} />
            <Text style={[styles.blockedTitle, { color: theme.text }]}>Esta entrada no es tuya</Text>
            <Text style={[styles.blockedText, { color: theme.muted }]}>Solo el titular actual puede transferir la entrada.</Text>
          </View>
        </Card>
      </Screen>
    );
  }

  if (!ticket.puedeTransferir) {
    return (
      <Screen>
        <ScreenHeader title="Transferir" subtitle={codigo} back />
        <Card>
          <View style={styles.blocked}>
            <ShieldAlert size={30} color={theme.warn} strokeWidth={1.8} />
            <Text style={[styles.blockedTitle, { color: theme.text }]}>Transferencia no disponible</Text>
            <Text style={[styles.blockedText, { color: theme.muted }]}>{ticket.estadoDetalle?.descripcion || 'Esta entrada ya no se puede transferir.'}</Text>
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <ScreenHeader title="Transferir" subtitle={codigo} back />

      <Card style={styles.ticketCard}>
        <Image source={posterFor(ticket.evento, ticket.codigo)} style={styles.poster} resizeMode="cover" />
        <View style={styles.ticketInfo}>
          <Text style={[styles.ticketEvent, { color: theme.text }]} numberOfLines={1}>{ticket.evento}</Text>
          <Text style={[styles.ticketMeta, { color: theme.muted }]}>{formatEventDate(ticket.fecha, ticket.hora)}</Text>
          <Text style={[styles.ticketMeta, { color: theme.muted }]} numberOfLines={1}>{seatLabel(ticket)}</Text>
          <Text style={[styles.ticketPrice, { color: theme.text }]}>{formatPrice(ticket.precioOriginal ?? ticket.precio)}</Text>
        </View>
      </Card>

      <Card style={styles.formCard}>
        <View style={styles.formHeader}>
          <View style={[styles.formIcon, { backgroundColor: `${theme.brand}16` }]}>
            <ArrowLeftRight size={21} color={theme.brand} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.formTitle, { color: theme.text }]}>Datos de la persona</Text>
            <Text style={[styles.formText, { color: theme.muted }]}>La entrada se transfiere una sola vez y genera un nuevo QR.</Text>
          </View>
        </View>

        <Input
          label="Nombre completo"
          placeholder="Ej. Maria Torres"
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="words"
          leftIcon={<UserRound size={17} color={theme.muted} strokeWidth={2.1} />}
          error={fields.nombre}
        />
        <Input
          label="DNI"
          placeholder="8 numeros"
          value={dni}
          onChangeText={(value) => setDni(value.replace(/\D/g, '').slice(0, 8))}
          keyboardType="number-pad"
          maxLength={8}
          leftIcon={<TicketIcon size={17} color={theme.muted} strokeWidth={2.1} />}
          error={fields.dni}
        />
        <Input
          label="Correo electronico"
          placeholder="persona@correo.com"
          value={correo}
          onChangeText={setCorreo}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          leftIcon={<Mail size={17} color={theme.muted} strokeWidth={2.1} />}
          error={fields.correo}
        />
        <Input
          label="Precio de transferencia (S/)"
          placeholder="0"
          value={precio}
          onChangeText={(value) => setPrecio(value.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          error={fields.precio}
          hint={`Precio maximo permitido: ${formatPrice(ticket.precioOriginal ?? ticket.precio)}`}
        />

        <Button label="Transferir entrada" icon={ArrowLeftRight} onPress={confirm} loading={sending} fullWidth style={styles.submit} />
        <View style={styles.note}>
          <ShieldAlert size={14} color={theme.warn} strokeWidth={2} />
          <Text style={[styles.noteText, { color: theme.muted }]}>
            Verifica el DNI y el correo antes de confirmar. La operacion queda registrada en el historial.
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ticketCard: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'center' },
  poster: { width: 76, height: 92, borderRadius: 15 },
  ticketInfo: { flex: 1, gap: 3 },
  ticketEvent: { fontFamily, fontSize: 14, fontWeight: '800' },
  ticketMeta: { fontFamily, fontSize: 10, fontWeight: '500' },
  ticketPrice: { fontFamily, fontSize: 16, fontWeight: '800', marginTop: 4 },
  formCard: { marginBottom: 16 },
  formHeader: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 18 },
  formIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  formTitle: { fontFamily, fontSize: 15, fontWeight: '800' },
  formText: { fontFamily, fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  submit: { marginTop: 4 },
  note: { flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 13 },
  noteText: { fontFamily, fontSize: 9.5, lineHeight: 14, flex: 1 },
  blocked: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16 },
  blockedTitle: { fontFamily, fontSize: 17, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  blockedText: { fontFamily, fontSize: 11.5, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 290 },
});
