'use strict';

const crypto = require('crypto');

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/** Espejo de la validación que usa el frontend. */
function validarTransferencia(datos, entrada) {
  const campos = {};
  const b = datos || {};

  const nombre = String(b.nombre || '').trim();
  if (!nombre) campos.nombre = 'El nombre del nuevo titular es obligatorio.';
  else if (nombre.length < 5) campos.nombre = 'El nombre debe tener al menos 5 caracteres.';
  else if (nombre.split(/\s+/).length < 2) campos.nombre = 'Ingrese el nombre y el apellido del nuevo titular.';
  else if (!/^[A-Za-zÁÉÍÓÚÑáéíóúñ' ]+$/.test(nombre)) campos.nombre = 'El nombre solo puede contener letras y espacios.';

  const dni = String(b.dni || '').trim();
  if (!dni) campos.dni = 'El DNI es obligatorio.';
  else if (!/^\d{8}$/.test(dni)) campos.dni = 'El DNI debe tener exactamente 8 números.';
  else if (dni === entrada.titular_dni) campos.dni = 'La entrada ya pertenece a este DNI.';

  const correo = String(b.correo || '').trim();
  if (!correo) campos.correo = 'El correo electrónico es obligatorio.';
  else if (!RE_CORREO.test(correo)) campos.correo = 'Ingrese un correo electrónico válido (ejemplo@correo.com).';

  const precioMaximo = Number(entrada.precio);
  const precio = b.precio === '' || b.precio == null ? Number.NaN : Number(b.precio);
  if (Number.isNaN(precio)) campos.precio = 'Indique el precio de transferencia.';
  else if (precio < 0) campos.precio = 'El precio debe ser un número válido en soles.';
  else if (precio > precioMaximo) campos.precio = 'El precio de transferencia supera el límite permitido.';

  if (Object.keys(campos).length) {
    return { ok: false, error: 'Revisa los datos del formulario.', campos };
  }

  return { ok: true, nombre, dni, correo, precio };
}

/** Código de operación: 'TRF-' + 8 caracteres (12 en total). */
function generarCodigoOperacion() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let salida = '';
  for (const b of bytes) salida += alfabeto[b % alfabeto.length];
  return `TRF-${salida}`;
}

module.exports = { validarTransferencia, generarCodigoOperacion };
