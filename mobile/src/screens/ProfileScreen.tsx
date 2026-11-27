import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import {
  ChevronRight,
  Info,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  ScanLine,
  Server,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react-native';
import { api, getApiBaseUrl, setApiBaseUrl } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/tokens';
import { initials } from '../utils/format';
import { useTabNavigation } from '../navigation/useAppNavigation';

export function ProfileScreen() {
  const navigation = useTabNavigation();
  const { theme, isDark, setMode } = useTheme();
  const { user, logout, refresh } = useAuth();
  const { showToast } = useToast();
  const [server, setServer] = useState(getApiBaseUrl());
  const [savingServer, setSavingServer] = useState(false);
  const [testing, setTesting] = useState(false);

  const saveServer = async () => {
    setSavingServer(true);
    try {
      const changed = server.trim().replace(/\/+$/, '') !== getApiBaseUrl();
      await setApiBaseUrl(server);
      if (changed) await logout();
      showToast({ type: 'success', title: 'Servidor actualizado', message: changed
        ? 'Inicia sesion de nuevo en este servidor. Tu token anterior no se enviara a otra direccion.'
        : 'La direccion del servidor ya estaba configurada.' });
    } catch (err) {
      showToast({ type: 'error', title: 'Direccion invalida', message: err instanceof Error ? err.message : 'Revisa la URL.' });
    } finally {
      setSavingServer(false);
    }
  };

  const testServer = async () => {
    setTesting(true);
    try {
      await api.health();
      showToast({ type: 'success', title: 'Conexion correcta', message: 'La API respondio desde la direccion configurada.' });
    } catch (err) {
      showToast({ type: 'error', title: 'Sin conexion', message: err instanceof Error ? err.message : 'No se pudo contactar la API.' });
    } finally {
      setTesting(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Cerrar sesion', 'Tus pases seguiran seguros en la base de datos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesion',
        style: 'destructive',
        onPress: async () => {
          await logout();
          showToast({ type: 'info', title: 'Sesion cerrada', message: 'Puedes volver a identificarte cuando quieras.' });
          navigation.navigate('Inicio');
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader title="Perfil" subtitle="Cuenta, apariencia y servidor" />

      {user ? (
        <Card style={styles.userCard}>
          <View style={[styles.avatar, { backgroundColor: `${theme.brand}18`, borderColor: `${theme.brand}40` }]}>
            <Text style={[styles.avatarText, { color: theme.brand }]}>{initials(user.nombre)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>{user.nombre}</Text>
            <Text style={[styles.meta, { color: theme.muted }]}>DNI {user.dni}</Text>
            {user.correo ? <Text style={[styles.meta, { color: theme.muted }]}>{user.correo}</Text> : null}
          </View>
          <Badge label="Verificado" color={theme.ok} compact />
        </Card>
      ) : (
        <Card style={styles.anonymousCard} onPress={() => navigation.navigate('Login')}>
          <View style={[styles.avatar, { backgroundColor: `${theme.brand}18`, borderColor: `${theme.brand}40` }]}>
            <UserRound size={24} color={theme.brand} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>Modo invitado</Text>
            <Text style={[styles.meta, { color: theme.muted }]}>Identificate para ver tus pases</Text>
          </View>
          <LogIn size={18} color={theme.brand} strokeWidth={2.2} />
        </Card>
      )}

      <Text style={[styles.sectionLabel, { color: theme.muted }]}>CUENTA</Text>
      <Card style={styles.menuCard} padded={false}>
        {user ? (
          <MenuRow
            icon={RefreshCw}
            title="Actualizar mis datos"
            caption="Sincronizar con la base de datos"
            onPress={async () => {
              await refresh();
              showToast({ type: 'success', title: 'Datos actualizados' });
            }}
          />
        ) : (
          <MenuRow icon={LogIn} title="Iniciar sesion" caption="DNI y contrasena" onPress={() => navigation.navigate('Login')} />
        )}
        <MenuRow icon={ScanLine} title="Modo puerta" caption="Validar ingresos con QR" onPress={() => navigation.navigate('Staff')} accent={theme.warn} />
        {user ? <MenuRow icon={LogOut} title="Cerrar sesion" caption="Salir de este dispositivo" onPress={confirmLogout} accent={theme.danger} last /> : null}
      </Card>

      <Text style={[styles.sectionLabel, { color: theme.muted }]}>APARIENCIA</Text>
      <Card>
        <View style={styles.themeHeader}>
          <View style={[styles.menuIcon, { backgroundColor: `${theme.brand}16` }]}>
            {isDark ? <Moon size={18} color={theme.brand} strokeWidth={2.1} /> : <Sun size={18} color={theme.brand} strokeWidth={2.1} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Tema de la app</Text>
            <Text style={[styles.menuCaption, { color: theme.muted }]}>Respeta la identidad visual de Joinnus</Text>
          </View>
        </View>
        <View style={[styles.themeSwitch, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
          <ThemeOption label="Oscuro" icon={Moon} active={isDark} onPress={() => setMode('dark')} />
          <ThemeOption label="Claro" icon={Sun} active={!isDark} onPress={() => setMode('light')} />
        </View>
      </Card>

      <Text style={[styles.sectionLabel, { color: theme.muted }]}>CONEXION</Text>
      <Card>
        <View style={styles.themeHeader}>
          <View style={[styles.menuIcon, { backgroundColor: `${theme.info}16` }]}>
            <Server size={18} color={theme.info} strokeWidth={2.1} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Servidor de la API</Text>
            <Text style={[styles.menuCaption, { color: theme.muted }]}>Cambia entre local y Render para probar</Text>
          </View>
        </View>
        <Input
          value={server}
          onChangeText={setServer}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://.../api"
          hint="Telefono fisico: usa http://TU-IP-LOCAL:8091/api con el proxy encendido."
        />
        <View style={styles.serverActions}>
          <Button label="Guardar" onPress={saveServer} loading={savingServer} small style={{ flex: 1 }} />
          <Button label="Probar" variant="secondary" onPress={testServer} loading={testing} small style={{ flex: 1 }} />
        </View>
      </Card>

      <Text style={[styles.sectionLabel, { color: theme.muted }]}>ACERCA DE</Text>
      <Card>
        <View style={styles.aboutRow}>
          <ShieldCheck size={20} color={theme.accent} strokeWidth={2.1} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.aboutTitle, { color: theme.text }]}>Joinnus Secure Pass</Text>
            <Text style={[styles.aboutText, { color: theme.muted }]}>Version {Constants.expoConfig?.version || '1.0.0'} · Expo + React Native</Text>
          </View>
          <Info size={16} color={theme.muted} strokeWidth={2} />
        </View>
        <Text style={[styles.disclaimer, { color: theme.muted }]}>
          El QR se renueva cada 15 segundos. Tu contrasena se comprueba en el servidor y se guarda cifrada con scrypt; la sesion usa un token firmado que caduca cada 8 horas.
        </Text>
      </Card>
    </Screen>
  );
}

function ThemeOption({
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
      style={[styles.themeOption, active && { backgroundColor: theme.mode === 'dark' ? theme.surface : theme.surfaceRaised }]}
      accessibilityRole="button"
    >
      <Icon size={15} color={active ? theme.brand : theme.muted} strokeWidth={2.1} />
      <Text style={[styles.themeOptionText, { color: active ? theme.text : theme.muted }]}>{label}</Text>
      <View style={[styles.radio, { borderColor: active ? theme.brand : theme.border }]}>
        {active ? <View style={[styles.radioDot, { backgroundColor: theme.brand }]} /> : null}
      </View>
    </Pressable>
  );
}

function MenuRow({
  icon: Icon,
  title,
  caption,
  onPress,
  accent,
  last,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  caption: string;
  onPress: () => void;
  accent?: string;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const color = accent || theme.brand;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !last && { borderBottomColor: theme.border, borderBottomWidth: 1 },
        pressed && { opacity: 0.65 },
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.menuIcon, { backgroundColor: `${color}16` }]}>
        <Icon size={18} color={color} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.menuCaption, { color: theme.muted }]}>{caption}</Text>
      </View>
      <ChevronRight size={17} color={theme.muted} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  anonymousCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  avatar: { width: 48, height: 48, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily, fontSize: 16, fontWeight: '800' },
  name: { fontFamily, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  meta: { fontFamily, fontSize: 10.5, marginTop: 2, fontWeight: '500' },
  sectionLabel: { fontFamily, fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginTop: 13, marginBottom: 8, marginLeft: 3 },
  menuCard: { padding: 0, overflow: 'hidden', marginBottom: 2 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14 },
  menuIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontFamily, fontSize: 12.5, fontWeight: '800' },
  menuCaption: { fontFamily, fontSize: 10, marginTop: 2, lineHeight: 14 },
  themeHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 },
  themeSwitch: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 3, gap: 3 },
  themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 10 },
  themeOptionText: { fontFamily, fontSize: 11, fontWeight: '700', flex: 1 },
  radio: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 7, height: 7, borderRadius: 4 },
  serverActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  aboutTitle: { fontFamily, fontSize: 13, fontWeight: '800' },
  aboutText: { fontFamily, fontSize: 10, marginTop: 2 },
  disclaimer: { fontFamily, fontSize: 10, lineHeight: 15, marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.16)' },
});
