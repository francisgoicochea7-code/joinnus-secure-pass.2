'use strict';

const { ESTADOS } = require('../../../shared/constants');
const { fechaCorta } = require('../../../shared/fechas');
const { ocultarDNI } = require('../../../shared/validaciones');

/** Convierte una fila de PostgreSQL al formato que consume el frontend. */
function enriquecer(fila, dni) {
  if (!fila) return null;
  const meta = ESTADOS[fila.estado] || ESTADOS.valido;
  const esMia = Boolean(dni) && fila.titular_dni === dni;

  return {
    codigo: fila.codigo,
    evento: fila.evento,
    fecha: fechaCorta(fila.fecha),
    hora: String(fila.hora).slice(0, 5),
    lugar: fila.lugar,
    zona: fila.zona,
    fila: fila.fila,
    asiento: fila.asiento,
    titular: fila.titular_nombre,
    // El DNI y el correo completos sólo se entregan al titular. El resto
    // recibe la versión enmascarada que ya usa la interfaz.
    dni: esMia ? fila.titular_dni : null,
    correo: esMia ? fila.titular_correo : null,
    estado: fila.estado,
    estadoEtiqueta: meta.etiqueta,
    estadoDetalle: meta,
    dniOculto: ocultarDNI(fila.titular_dni),
    dniAnteriorOculto: fila.dni_anterior ? ocultarDNI(fila.dni_anterior) : null,
    precioOriginal: Number(fila.precio),
    precio: Number(fila.precio),
    qrToken: esMia ? fila.qr_ultimo_token : null,
    qrAnterior: esMia ? fila.qr_anterior_token : null,
    qrExpiraEn: esMia ? fila.qr_expira_en : null,
    qrGeneradoEn: esMia ? fila.qr_generado_en : null,
    creadoEn: fila.creado_en,
    transferidaEn: fila.transferida_en,
    usadoEn: fila.usada_en,
    anuladoEn: fila.anulada_en,
    motivoAnulacion: fila.motivo_anulacion,
    titularAnterior: fila.titular_anterior,
    dniAnterior: esMia ? fila.dni_anterior : null,
    puedeTransferir: esMia && ['valido', 'transferido'].includes(fila.estado),
    esMia
  };
}

function mapearHistorial(rows) {
  return rows.map((r) => ({
    id: 'H' + r.id,
    codigo: r.codigo,
    accion: r.accion,
    titular: r.titular,
    detalle: r.detalle,
    estado: r.estado_registrado,
    fecha: r.creado_en
  }));
}

/** Datos internos que necesitan qr-service y otros servicios. */
function datosInternos(fila) {
  return {
    id: fila.id,
    codigo: fila.codigo,
    titular_id: fila.titular_id,
    titular_dni: fila.titular_dni,
    titular_nombre: fila.titular_nombre,
    titular_correo: fila.titular_correo,
    estado: fila.estado,
    precio: Number(fila.precio),
    qr_ultimo_token: fila.qr_ultimo_token
  };
}

module.exports = { enriquecer, mapearHistorial, datosInternos };
