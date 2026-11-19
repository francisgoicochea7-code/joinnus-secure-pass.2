export function normalizeName(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function formatEventDate(fecha: string, hora?: string) {
  if (!fecha) return 'Fecha por confirmar';
  const date = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(date.getTime())) return fecha;
  const formatted = date.toLocaleDateString('es-PE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const clean = formatted.replace(/\./g, '');
  return hora ? `${clean} · ${hora}` : clean;
}

export function formatShortDate(fecha: string) {
  if (!fecha) return '';
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return fecha;
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
}

export function formatDateTime(fecha: string | null) {
  if (!fecha) return '';
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return fecha;
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(/\./g, '');
}

export function formatPrice(value: number | null | undefined) {
  const amount = Number(value || 0);
  return `S/ ${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export function initials(name: string) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function seatLabel(ticket: { zona: string; fila: string; asiento: string }) {
  return [ticket.zona, ticket.fila && ticket.fila !== '-' ? `Fila ${ticket.fila}` : '', ticket.asiento ? `Asiento ${ticket.asiento}` : '']
    .filter(Boolean)
    .join(' · ');
}

export function extractCodeFromQr(raw: string) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const parts = value.split('|');
  if (parts.length >= 2 && /^JSP$/i.test(parts[0])) return parts[1].toUpperCase();
  if (/^[A-Z0-9-]{3,}$/i.test(value)) return value.toUpperCase();
  return value;
}

export function statusTone(status: string) {
  switch (status) {
    case 'valido':
      return 'ok';
    case 'usado':
      return 'info';
    case 'transferido':
      return 'warn';
    case 'anulado':
      return 'danger';
    default:
      return 'muted';
  }
}

export function actionLabel(action: string) {
  const labels: Record<string, string> = {
    creada: 'Entrada emitida',
    transferida: 'Transferencia',
    recibida: 'Entrada recibida',
    usada: 'Ingreso registrado',
    anulada: 'Entrada anulada',
    verificada: 'Verificacion',
    qr: 'QR generado',
  };
  return labels[action] || action;
}
