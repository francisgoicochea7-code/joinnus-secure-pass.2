'use strict';

const { AppError } = require('../../../shared/errors');
const { ESTADOS } = require('../../../shared/constants');
const { ocultarDNI } = require('../../../shared/validaciones');
const { enriquecer } = require('../domain/entrada');
const { validarTransferencia, generarCodigoOperacion } = require('../domain/transferencia');

function crearTransferirEntrada({
  entradaRepo,
  historialRepo,
  authClient,
  qrClient,
  logger,
  demoDni
}) {
  return async ({ codigo, datos, dniSolicitante, requestId }) => {
    const fila = await entradaRepo.obtenerPorCodigo(codigo);
    if (!fila) {
      throw new AppError('La entrada no existe en el sistema.', 404, 'ENTRADA_NO_ENCONTRADA');
    }

    if (fila.titular_dni !== dniSolicitante) {
      throw new AppError(
        `La entrada ${codigo} pertenece a otra persona: sólo su titular puede transferirla.`,
        403,
        'NO_ES_TUYA',
        { motivo: 'no-es-tuya' }
      );
    }

    if (fila.estado !== 'valido') {
      throw new AppError(
        `No es posible transferir una entrada con estado "${(ESTADOS[fila.estado] || ESTADOS.valido).etiqueta}".`,
        409,
        'ESTADO_INVALIDO'
      );
    }

    const validacion = validarTransferencia(datos, fila);
    if (!validacion.ok) {
      throw new AppError(validacion.error, 400, 'DATOS_INVALIDOS', { campos: validacion.campos });
    }

    const titularAnterior = fila.titular_nombre;
    const dniAnterior = fila.titular_dni;
    const tokenAnterior = fila.qr_ultimo_token;

    // 1. El nuevo titular vive en auth_db.
    const usuarioNuevo = await authClient.upsertUsuario({
      nombre: validacion.nombre,
      dni: validacion.dni,
      correo: validacion.correo
    }, requestId);

    // 2. Transacción local en tickets_db.
    await entradaRepo.transferir({
      codigo,
      usuarioNuevoId: usuarioNuevo.id,
      nombre: validacion.nombre,
      dni: validacion.dni,
      correo: validacion.correo,
      precio: validacion.precio,
      precioOriginal: Number(fila.precio),
      codigoOperacion: generarCodigoOperacion()
    });

    // 3. Rotación del QR. Si falla, la transferencia ya está hecha y el
    //    nuevo titular puede generar su QR más tarde.
    let qr = null;
    try {
      qr = await qrClient.rotar({
        codigo,
        entradaId: fila.id,
        titularDni: validacion.dni
      }, requestId);

      await entradaRepo.actualizarProyeccionQr(codigo, {
        token: qr.token,
        anterior: qr.tokenAnterior,
        firma: qr.firma,
        expiraEn: qr.expiraEn
      });

      await historialRepo.registrar(
        codigo,
        'qr',
        validacion.nombre,
        qr.tokenAnterior
          ? `Nuevo QR generado (se invalidó ${qr.tokenAnterior})`
          : 'Nuevo QR generado para el nuevo titular',
        'transferido'
      );
    } catch (err) {
      logger.warn('rotacion_qr_fallida', { codigo, error: err.message });
    }

    const actualizada = await entradaRepo.obtenerPorCodigo(codigo);

    return {
      codigo,
      titularAnterior,
      titularNuevo: validacion.nombre,
      dniAnterior: ocultarDNI(dniAnterior),
      dniNuevo: ocultarDNI(validacion.dni),
      correoNuevo: validacion.correo,
      precio: validacion.precio,
      estado: 'transferido',
      estadoEtiqueta: ESTADOS.transferido.etiqueta,
      tokenAnterior,
      tokenNuevo: qr ? qr.token : null,
      payload: qr ? qr.payload : null,
      qrPendiente: !qr,
      entrada: enriquecer(actualizada, dniSolicitante, demoDni)
    };
  };
}

module.exports = { crearTransferirEntrada };
