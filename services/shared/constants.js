'use strict';

/** Metadatos de estado compartidos por tickets y qr.
 *  Deben coincidir con frontend/js/api.js. */
const ESTADOS = {
  valido: {
    clave: 'valido',
    etiqueta: 'Válido / Sin usar',
    corta: 'Válido',
    clase: 'badge-valido',
    punto: 'st-valido',
    emoji: '✅',
    icono: 'check-circle',
    color: '#22c55e',
    descripcion: 'La entrada está activa y puede utilizarse una sola vez.'
  },
  usado: {
    clave: 'usado',
    etiqueta: 'Usado / Ingresado',
    corta: 'Usado',
    clase: 'badge-usado',
    punto: 'st-usado',
    emoji: '❌',
    icono: 'x-circle',
    color: '#f43f5e',
    descripcion: 'Esta entrada ya fue utilizada para ingresar al evento.'
  },
  anulado: {
    clave: 'anulado',
    etiqueta: 'Anulado',
    corta: 'Anulado',
    clase: 'badge-anulado',
    punto: 'st-anulado',
    emoji: '⛔',
    icono: 'ban',
    color: '#f59e0b',
    descripcion: 'Esta entrada ya no puede utilizarse.'
  },
  transferido: {
    clave: 'transferido',
    etiqueta: 'Transferido',
    corta: 'Transferido',
    clase: 'badge-transferido',
    punto: 'st-transferido',
    emoji: '🔄',
    icono: 'repeat',
    color: '#3b82f6',
    descripcion: 'Esta entrada fue transferida a un nuevo titular.'
  }
};

module.exports = { ESTADOS };
