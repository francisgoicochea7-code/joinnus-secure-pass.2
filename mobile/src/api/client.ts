import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { ApiErrorPayload, HistoryItem, QrResult, StaffSession, StaffValidation, Summary, Ticket, TransferPayload, User } from './types';

const RENDER_API = 'https://joinnus-secure-pass2.onrender.com/api';
const API_STORAGE_KEY = 'jsp.mobile.apiUrl.v1';
const REQUEST_TIMEOUT = 12000;

let baseUrl = resolveDefaultApiUrl();
let sessionToken: string | null = null;

function resolveDefaultApiUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/+$/, '');

  // En desarrollo, el telefono y la computadora estan en la misma red. Expo
  // conoce la IP del servidor de Metro; el proxy local evita el certificado
  // autofirmado del gateway. En produccion se usa Render.
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    const host = hostUri?.split(':')[0];
    const isTunnel = Boolean(host && /\.exp\.direct$|\.ngrok\./i.test(host));
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !isTunnel) {
      return `http://${host}:8091/api`;
    }
  }
  return RENDER_API;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;

  constructor(message: string, status = 0, code?: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function loadApiSettings() {
  try {
    const stored = await AsyncStorage.getItem(API_STORAGE_KEY);
    if (stored && stored.trim()) baseUrl = stored.trim().replace(/\/+$/, '');
  } catch {
    // La URL por defecto sigue siendo valida si el almacenamiento falla.
  }
  return baseUrl;
}

export function getApiBaseUrl() {
  return baseUrl;
}

export async function setApiBaseUrl(next: string) {
  const clean = next.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(clean)) {
    throw new Error('La direccion debe empezar con http:// o https://');
  }
  baseUrl = clean;
  await AsyncStorage.setItem(API_STORAGE_KEY, clean);
}

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

async function request<T>(path: string, options: { method?: string; body?: unknown; allow404?: boolean } = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const data = (payload && typeof payload === 'object' ? payload : {}) as T & ApiErrorPayload;

    if (response.status === 404 && options.allow404) return null as T;

    if (!response.ok || (data as ApiErrorPayload).ok === false) {
      throw new ApiError(
        data.error || `La API respondio con estado ${response.status}.`,
        response.status,
        data.codigo,
        data.campos
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('La API tardo demasiado en responder. Revisa tu conexion.', 0, 'timeout');
    }
    throw new ApiError('No se pudo conectar con la API. Revisa la direccion del servidor y tu red.', 0, 'network');
  } finally {
    clearTimeout(timeout);
  }
}

const code = (value: string) => encodeURIComponent(value.trim().toUpperCase());

export const api = {
  health: () => request<{ ok: boolean }>('/health'),

  summary: async () => {
    const data = await request<{ resumen: Summary }>('/resumen');
    return data.resumen;
  },

  tickets: async () => {
    const data = await request<{ entradas: Ticket[] }>('/entradas');
    return data.entradas || [];
  },

  ticket: (codigo: string) => request<{ entrada: Ticket }>(`/entradas/${code(codigo)}`, { allow404: true }),

  verify: (codigo: string) => request<{ entrada: Ticket }>(`/verificar/${code(codigo)}`, { allow404: true }),

  qr: (codigo: string) => request<QrResult>(`/entradas/${code(codigo)}/qr?log=0`, { method: 'POST' }),

  transfer: (codigo: string, body: TransferPayload) =>
    request<{ ok: boolean; entrada?: Ticket; mensaje?: string }>(`/entradas/${code(codigo)}/transferir`, {
      method: 'POST',
      body,
    }),

  history: async (dni?: string) => {
    const data = await request<{ historial: HistoryItem[] }>(`/historial${dni ? `?dni=${encodeURIComponent(dni)}` : ''}`);
    return data.historial || [];
  },

  ticketHistory: async (codigo: string) => {
    const data = await request<{ historial: HistoryItem[] }>(`/entradas/${code(codigo)}/historial`);
    return data.historial || [];
  },

  user: (dni: string) => request<{ usuario: User }>(`/usuarios/${encodeURIComponent(dni)}`, { allow404: true }),

  login: async (dni: string, password: string) => {
    const data = await request<{ ok: boolean; usuario: User; token: string; expiraEn: number }>('/usuarios/login', {
      method: 'POST',
      body: { dni: dni.trim(), password },
    });
    if (!data.usuario || !data.token) {
      throw new ApiError('El servidor no devolvio una sesion valida.', 500, 'sesion');
    }
    return data;
  },

  createUser: (body: { dni: string; nombre: string; correo: string; password: string }) =>
    request<{ ok: boolean; usuario?: User; error?: string; campos?: Record<string, string> }>('/usuarios', {
      method: 'POST',
      body,
    }),

  staffLogin: (nombre: string, codigo: string) =>
    request<{ ok: boolean; encargado: StaffSession }>('/encargados/login', {
      method: 'POST',
      body: { nombre, codigo },
    }),

  staffValidate: (session: StaffSession, raw: string, registrar = false) => {
    const isToken = /^JSP/i.test(raw.trim());
    return request<StaffValidation>('/encargados/validar', {
      method: 'POST',
      body: {
        encargado: session.nombre,
        codigo: session.codigo,
        registrar,
        ...(isToken ? { token: raw.trim() } : { entrada: raw.trim() }),
      },
    });
  },

  resetDemo: () => request<{ ok: boolean }>('/demo/reiniciar', { method: 'POST' }),
};
