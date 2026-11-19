import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, LogIn, Mail, ShieldCheck, Ticket as TicketIcon, UserPlus, UserRound } from 'lucide-react-native';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { useStackNavigation } from '../navigation/useAppNavigation';

type Mode = 'login' | 'register';
type FieldErrors = Partial<Record<'dni' | 'nombre' | 'correo' | 'password' | 'password2', string>>;

export function LoginScreen() {
  const navigation = useStackNavigation();
  const { theme } = useTheme();
  const { login, register } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<FieldErrors>({});

  const changeMode = (next: Mode) => {
    setMode(next);
    setError('');
    setFields({});
    setPassword('');
    setPassword2('');
  };

  const submit = async () => {
    setError('');
    setFields({});
    const next: FieldErrors = {};
    if (!/^\d{8}$/.test(dni.trim())) next.dni = 'El DNI debe tener exactamente 8 numeros.';
    if (password.length < 8) next.password = 'La contrasena debe tener al menos 8 caracteres.';
    if (mode === 'register') {
      if (nombre.trim().length < 3) next.nombre = 'Escribe tu nombre completo.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) next.correo = 'Escribe un correo valido.';
      if (password !== password2) next.password2 = 'Las contrasenas no coinciden.';
    }
    setFields(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        await login({ dni: dni.trim(), password });
        showToast({ type: 'success', title: 'Bienvenido', message: 'Tus pases ya estan disponibles.' });
      } else {
        await register({ dni: dni.trim(), nombre: nombre.trim(), correo: correo.trim(), password });
        showToast({ type: 'success', title: 'Cuenta creada', message: 'Tu cuenta quedo registrada en Secure Pass.' });
      }
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields as FieldErrors);
      setError(err instanceof Error ? err.message : 'No se pudo completar la operacion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard>
      <ScreenHeader title="Secure Pass" subtitle={mode === 'login' ? 'Entra con tu contrasena' : 'Crea tu cuenta'} back />

      <LinearGradient colors={['#1b1726', '#221a35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon}>
          <ShieldCheck size={25} color="#a9f0cf" strokeWidth={2.1} />
        </View>
        <Text style={styles.heroKicker}>JOINNUS · SECURE PASS</Text>
        <Text style={styles.heroTitle}>{mode === 'login' ? 'Tu pase te espera.' : 'Tu cuenta, protegida.'}</Text>
        <Text style={styles.heroText}>
          {mode === 'login'
            ? 'Entra con tu DNI y tu contrasena. La app guarda tu sesion de forma segura en este dispositivo.'
            : 'Registra tu DNI, tu nombre, tu correo y una contrasena para asociar tus entradas.'}
        </Text>
      </LinearGradient>

      <View style={[styles.switcher, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SwitchButton label="Entrar" icon={LogIn} active={mode === 'login'} onPress={() => changeMode('login')} />
        <SwitchButton label="Crear cuenta" icon={UserPlus} active={mode === 'register'} onPress={() => changeMode('register')} />
      </View>

      <Card>
        <Input
          label="DNI"
          placeholder="8 numeros"
          value={dni}
          onChangeText={(value) => setDni(value.replace(/\D/g, '').slice(0, 8))}
          keyboardType="number-pad"
          maxLength={8}
          autoComplete="username"
          leftIcon={<TicketIcon size={17} color={theme.muted} strokeWidth={2.1} />}
          error={fields.dni}
        />

        {mode === 'register' ? (
          <Input
            label="Nombre completo"
            placeholder="Ej. Carlos Perez"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="words"
            leftIcon={<UserRound size={17} color={theme.muted} strokeWidth={2.1} />}
            error={fields.nombre}
          />
        ) : null}

        {mode === 'register' ? (
          <Input
            label="Correo electronico"
            placeholder="tu@correo.com"
            value={correo}
            onChangeText={setCorreo}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<Mail size={17} color={theme.muted} strokeWidth={2.1} />}
            error={fields.correo}
          />
        ) : null}

        <Input
          label="Contrasena"
          placeholder={mode === 'login' ? 'Tu contrasena' : 'Minimo 8 caracteres'}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          maxLength={200}
          leftIcon={<Lock size={17} color={theme.muted} strokeWidth={2.1} />}
          error={fields.password}
        />

        {mode === 'register' ? (
          <Input
            label="Repite la contrasena"
            placeholder="Otra vez, para evitar errores"
            value={password2}
            onChangeText={setPassword2}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            maxLength={200}
            leftIcon={<Lock size={17} color={theme.muted} strokeWidth={2.1} />}
            error={fields.password2}
          />
        ) : null}

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <Button
          label={mode === 'login' ? 'Entrar a mi cuenta' : 'Crear cuenta'}
          icon={mode === 'login' ? LogIn : UserPlus}
          onPress={submit}
          loading={loading}
          fullWidth
          style={styles.submit}
        />

        {mode === 'login' ? (
          <Pressable
            onPress={() => {
              setDni('45678945');
              setPassword('Carlos2026!');
              setError('');
              setFields({});
            }}
            style={styles.demo}
            accessibilityRole="button"
          >
            <Text style={[styles.demoText, { color: theme.muted }]}>Usar cuenta demo (Carlos · 45678945)</Text>
          </Pressable>
        ) : null}
      </Card>

      <View style={[styles.note, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ShieldCheck size={16} color={theme.brand} strokeWidth={2.1} />
        <Text style={[styles.noteText, { color: theme.muted }]}>
          Tu contrasena viaja al servidor y se guarda cifrada con scrypt. Nunca se muestra ni se devuelve a la app.
        </Text>
      </View>
    </Screen>
  );
}

function SwitchButton({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.switchButton, active && { backgroundColor: theme.mode === 'dark' ? theme.paper : theme.text }]}
      accessibilityRole="button"
    >
      <Icon size={15} color={active ? (theme.mode === 'dark' ? '#17131f' : '#fffdf9') : theme.muted} strokeWidth={2.2} />
      <Text style={[styles.switchText, { color: active ? (theme.mode === 'dark' ? '#17131f' : '#fffdf9') : theme.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 25, padding: 20, marginBottom: 14, overflow: 'hidden' },
  heroIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: 'rgba(169,240,207,0.12)', borderWidth: 1, borderColor: 'rgba(169,240,207,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  heroKicker: { fontFamily, color: '#a9f0cf', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { fontFamily, color: '#fffdf9', fontSize: 29, fontWeight: '800', letterSpacing: -1.1, marginTop: 7 },
  heroText: { fontFamily, color: 'rgba(255,253,249,0.66)', fontSize: 11.5, lineHeight: 17, marginTop: 8, maxWidth: 300 },
  switcher: { flexDirection: 'row', borderWidth: 1, borderRadius: 15, padding: 3, gap: 3, marginBottom: 14 },
  switchButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 10 },
  switchText: { fontFamily, fontSize: 11.5, fontWeight: '800' },
  error: { fontFamily, fontSize: 11, lineHeight: 16, marginTop: 1, marginBottom: 10, fontWeight: '600' },
  submit: { marginTop: 5 },
  demo: { alignSelf: 'center', paddingTop: 13, paddingBottom: 2 },
  demoText: { fontFamily, fontSize: 10.5, fontWeight: '600' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 15, padding: 13, marginTop: 14 },
  noteText: { fontFamily, fontSize: 9.5, lineHeight: 15, flex: 1 },
});
