'use strict';

const { AppError } = require('../../../shared/errors');
const { enriquecer } = require('../domain/entrada');

function crearCambiarEstado({ entradaRepo, historialRepo, qrClient, logger, demoDni }) {
  return async ({ codigo, estado, dni, requestId }) => {
    if (!['usado', 'anulado', 'valido'].includes(estado)) {
      throw new AppError(`Estado no permitido: ${estado}`, 400, 'ESTADO_NO_PERMITIDO');
    }

    if (estado === 'usado') {
      throw new AppError(
        'El ingreso en puerta solo lo registra un encargado desde /staff/.',
        403,
        'SOLO_ENCARGADO',
        { motivo: 'solo-encargado' }
      );
    }

    const fila = await entradaRepo.obtenerPorCodigo(codigo);
    if (!fila) {
      throw new AppError('La entrada no existe.', 404, 'ENTRADA_NO_ENCONTRADA');
    }

    await entradaRepo.cambiarEstado(codigo, estado);

    const accion = estado === 'anulado' ? 'anulada' : 'verificada';
    const detalle = estado === 'anulado'
      ? 'Entrada anulada por el organizador'
      : 'Entrada reactivada';

    await historialRepo.registrar(codigo, accion, fila.titular_nombre, detalle, estado);

    if (estado === 'anulado') {
      try {
        await qrClient.invalidar(fila.id, requestId);
      } catch (err) {
        logger.warn('invalidar_qr_fallido', { codigo, error: err.message });
      }
    }

    const actualizada = await entradaRepo.obtenerPorCodigo(codigo);
    return enriquecer(actualizada, dni, demoDni);
  };
}

module.exports = { crearCambiarEstado };
