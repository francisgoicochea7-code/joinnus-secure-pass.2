import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, loadApiSettings, setSessionToken, setUnauthorizedHandler } from '../api/client';
import { useToast } from '../components/Toast';
import { User } from '../api/types';

const SESSION_KEY = 'jsp.mobile.session.v2';

type StoredSession = {
  dni: string;
  nombre: string;
  token: string;
  expiraEn: number;
};

type LoginInput = {
  dni: string;
  password: string;
};

type RegisterInput = {
  dni: string;
  nombre: string;
  correo: string;
  password: string;
};

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  login: (input: LoginInput) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = Platform.OS === 'web'
      ? await AsyncStorage.getItem(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.dni || !/^\d{8}$/.test(parsed.dni)) return null;
    if (!parsed.token || typeof parsed.token !== 'string') return null;
    if (!parsed.expiraEn || parsed.expiraEn <= Date.now()) {
      await writeSession(null);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeSession(session: StoredSession | null) {
  try {
    if (Platform.OS === 'web') {
      if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else await AsyncStorage.removeItem(SESSION_KEY);
      return;
    }
    if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // La sesion se mantiene en memoria aunque el almacenamiento seguro falle.
  }
}

function guardarSesion(usuario: User, token: string, expiraEn: number) {
  setSessionToken(token);
  return writeSession({
    dni: usuario.dni,
    nombre: usuario.nombre,
    token,
    expiraEn,
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all([loadApiSettings(), readSession()]).then(async ([, stored]) => {
        if (!alive || !stored) return;
        setSessionToken(stored.token);
        setUser({ id: 0, dni: stored.dni, nombre: stored.nombre, correo: '' });
        try {
          const remote = await api.user(stored.dni);
          if (alive && remote?.usuario) {
            setUser(remote.usuario);
            await writeSession({
              dni: remote.usuario.dni,
              nombre: remote.usuario.nombre,
              token: stored.token,
              expiraEn: stored.expiraEn,
            });
          }
        } catch {
          // Si no hay red, conservamos la sesion local y la app avisa al usarla.
        }
      }).finally(() => {
        if (alive) setReady(true);
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async ({ dni, password }: LoginInput) => {
    const cleanDni = dni.trim();
    if (!/^\d{8}$/.test(cleanDni)) throw new ApiError('El DNI debe tener exactamente 8 numeros.', 400, 'dni');
    if (String(password || '').length < 8) {
      throw new ApiError('La contrasena debe tener al menos 8 caracteres.', 400, 'password');
    }

    const remote = await api.login(cleanDni, password);
    const expiraEn = Number(remote.expiraEn) || Date.now() + 8 * 60 * 60 * 1000;
    setUser(remote.usuario);
    await guardarSesion(remote.usuario, remote.token, expiraEn);
    return remote.usuario;
  }, []);

  const register = useCallback(async ({ dni, nombre, correo, password }: RegisterInput) => {
    const cleanDni = dni.trim();
    const cleanNombre = nombre.trim();
    const cleanCorreo = correo.trim();

    if (!/^\d{8}$/.test(cleanDni)) throw new ApiError('El DNI debe tener exactamente 8 numeros.', 400, 'dni');
    if (cleanNombre.length < 3) throw new ApiError('Escribe tu nombre completo.', 400, 'nombre');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanCorreo)) {
      throw new ApiError('Escribe un correo valido.', 400, 'correo');
    }
    if (String(password || '').length < 8) {
      throw new ApiError('La contrasena debe tener al menos 8 caracteres.', 400, 'password');
    }

    const result = await api.createUser({
      dni: cleanDni,
      nombre: cleanNombre,
      correo: cleanCorreo,
      password,
    });
    if (!result.usuario) throw new ApiError('No se pudo crear la cuenta.', 500, 'registro');

    // La cuenta recien creada se entra con la misma contraseña.
    const session = await api.login(cleanDni, password);
    const expiraEn = Number(session.expiraEn) || Date.now() + 8 * 60 * 60 * 1000;
    setUser(session.usuario);
    await guardarSesion(session.usuario, session.token, expiraEn);
    return session.usuario;
  }, []);

  const logout = useCallback(async () => {
    setSessionToken(null);
    setUser(null);
    await writeSession(null);
  }, []);

  // El servidor rechazo el token (caducado o revocado): se cierra la sesion
  // con un aviso, en vez de dejar al usuario como invitado sin explicacion.
  const expireSession = useCallback(async () => {
    await logout();
    showToast({
      type: 'error',
      title: 'Tu sesion expiro',
      message: 'Por seguridad cerramos la sesion. Vuelve a entrar para seguir usando la app.',
    });
  }, [logout, showToast]);

  useEffect(() => {
    setUnauthorizedHandler(() => { void expireSession(); });
    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const remote = await api.user(user.dni);
      if (remote?.usuario) setUser(remote.usuario);
    } catch {
      // El refresh es opcional; las pantallas muestran su propio error de red.
    }
  }, [user]);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, refresh }),
    [user, ready, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return value;
}
