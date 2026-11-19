'use strict';

const { AppError } = require('../../../shared/errors');
const { extraerToken } = require('../../../shared/tokens');
const { enriquecer } = require('../domain/entrada');

function crearValidarPuerta({
  entradaRepo,
  historialRepo,
  authClient,
  qrClient,
  logger
}) {
  return async ({ datos, requestId }) => {
    const b = datos || {};
    const nombre = String(b.encargado || b.nombre || '').trim();
    const codigoEncargado = String(b.codigo || '').trim();

    const encargado = await authClient.verificarEncargado({
      nombre,
      codigo: codigoEncargado
    }, requestId);

    const token = extraerToken(b.token || b.payload);
    const codigoEntrada = String(b.entrada || '').trim().toUpperCase();

    if (!token && !/^[A-Z0-9][A-Z0-9-]{3,23}$/.test(codigoEntrada)) {
      throw new AppError('Escanea un QR o escribe el código de la entrada.', 400, 'FORMATO_INVALIDO', {
        valido: false,
        motivo: 'formato',
        encargado: encargado.nombre
      });
    }

    let codigo = codigoEntrada;

    if (token) {
      const validacion = await qrClient.validar({ token }, requestId);
      if (!validacion.valido) {
        return {
          valido: false,
          motivo: validacion.motivo,
          error: validacion.mensaje,
          mensaje: validacion.mensaje,
          encargado: encargado.nombre
        };
      }
      codigo = validacion.codigo;
    }

    const fila = await entradaRepo.obtenerPorCodigo(codigo);
    if (!fila) {
      throw new AppError(
        `La entrada ${codigo || token} no existe en el sistema.`,
        404,
        'ENTRADA_NO_ENCONTRADA',
        { valido: false, motivo: 'desconocido', encargado: encargado.nombre }
      );
    }

    const entrada = enriquecer(fila, null);

    if (fila.estado === 'usado') {
      return {
        valido: false,
        motivo: 'usada',
        error: 'La entrada ya fue utilizada para ingresar al evento.',
        mensaje: 'La entrada ya fue utilizada para ingresar al evento.',
        entrada,
        encargado: encargado.nombre
      };
    }

    if (fila.estado === 'anulado') {
      return {
        valido: false,
        motivo: 'anulada',
        error: 'La entrada está anulada.',
        mensaje: 'La entrada está anulada.',
        entrada,
        encargado: encargado.nombre
      };
    }

    const registrar = b.registrar === true || b.registrar === 'true';
    let registrado = false;

    if (registrar) {
      await entradaRepo.marcarUsada(codigo);

      try {
        if (token) {
          await qrClient.marcarUsado(token, requestId);
        } else {
          await qrClient.invalidar(fila.id, requestId);
        }
      } catch (err) {
        // La entrada ya está usada en tickets_db; el token no puede reutilizarse
        // porque la validación consulta el estado de la entrada.
        logger.warn('marcar_token_usado_fallido', { codigo, error: err.message });
      }

      await historialRepo.registrar(
        codigo,
        'usada',
        fila.titular_nombre,
        `Ingreso registrado por ${encargado.nombre} (encargado)`,
        'usado'
      );

      registrado = true;
    }

    const actualizada = await entradaRepo.obtenerPorCodigo(codigo);

    return {
      valido: true,
      motivo: registrado ? 'registrado' : 'ok',
      registrado,
      conFirma: !!token,
      entrada: enriquecer(actualizada, null),
      encargado: encargado.nombre,
      mensaje: registrado
        ? `Ingreso registrado por ${encargado.nombre}.`
        : (token ? 'QR vigente: acceso permitido.' : 'Entrada válida (código sin token firmado).')
    };
  };
}

module.exports = { crearValidarPuerta };
