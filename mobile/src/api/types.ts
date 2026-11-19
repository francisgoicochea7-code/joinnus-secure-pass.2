export type TicketStatus = 'valido' | 'usado' | 'anulado' | 'transferido' | string;

export type EstadoDetalle = {
  clave: string;
  etiqueta: string;
  corta: string;
  clase: string;
  punto: string;
  emoji: string;
  icono: string;
  color: string;
  descripcion: string;
};

export type Ticket = {
  codigo: string;
  evento: string;
  fecha: string;
  hora: string;
  lugar: string;
  zona: string;
  fila: string;
  asiento: string;
  titular: string;
  dni: string;
  correo: string;
  estado: TicketStatus;
  estadoEtiqueta: string;
  estadoDetalle: EstadoDetalle;
  dniOculto: string;
  dniAnteriorOculto: string | null;
  precioOriginal: number;
  precio: number;
  qrToken: string | null;
  qrAnterior: string | null;
  qrExpiraEn: string | null;
  qrGeneradoEn: string | null;
  creadoEn: string;
  transferidaEn: string | null;
  usadoEn: string | null;
  anuladoEn: string | null;
  motivoAnulacion: string | null;
  titularAnterior: string | null;
  dniAnterior: string | null;
  puedeTransferir: boolean;
  esMia: boolean;
};

export type Summary = {
  activas: number;
  usadas: number;
  transferidas: number;
  anuladas: number;
  total: number;
  mias: number;
};

export type HistoryItem = {
  id: string;
  codigo: string;
  accion: string;
  titular: string;
  detalle: string;
  estado: TicketStatus;
  fecha: string;
};

export type User = {
  id: number;
  nombre: string;
  dni: string;
  correo: string;
  telefono?: string | null;
};

export type QrResult = {
  ok: boolean;
  codigo: string;
  token: string;
  tokenAnterior: string | null;
  payload: string;
  expiraEn: string;
  ttl: number;
  id: number;
  entrada: Ticket;
};

export type TransferPayload = {
  nombre: string;
  dni: string;
  correo: string;
  precio: number;
};

export type StaffSession = {
  id: number;
  nombre: string;
  codigo: string;
};

export type StaffValidation = {
  ok: boolean;
  valido?: boolean;
  motivo?: string;
  mensaje?: string;
  error?: string;
  encargado?: string;
  registrado?: boolean;
  conFirma?: boolean;
  entrada?: Ticket;
};

export type ApiErrorPayload = {
  ok?: boolean;
  error?: string;
  codigo?: string;
  campos?: Record<string, string>;
};
