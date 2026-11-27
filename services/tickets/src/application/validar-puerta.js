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
    let dniQr = null;

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
      dniQr = validacion.titularDni;
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

    if (token && (!dniQr || dniQr !== fila.titular_dni)) {
      return {
        valido: false, motivo: 'titular',
        error: 'Este QR pertenece a un titular anterior.',
        mensaje: 'Este QR pertenece a un titular anterior.', encargado: encargado.nombre
      };
    }
    if (token && fila.qr_ultimo_token !== token) {
      return { valido: false, motivo: 'invalidado',
        mensaje: 'Este QR fue reemplazado. Escanea el QR actual.', encargado: encargado.nombre };
    }

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

    if (!['valido', 'transferido'].includes(fila.estado)) {
      return { valido: false, motivo: 'estado', mensaje: 'La entrada no está vigente.', encargado: encargado.nombre };
    }

    const registrar = b.registrar === true || b.registrar === 'true';
    let registrado = false;

    if (registrar) {
      const guardado = await entradaRepo.registrarIngreso(codigo, fila.titular_dni, encargado.nombre, token);
      if (!guardado) {
        const actual = await entradaRepo.obtenerPorCodigo(codigo);
        return {
          valido: false,
          motivo: actual?.estado === 'usado' ? 'usada' : actual?.estado === 'anulado' ? 'anulada' : token && actual?.titular_dni === fila.titular_dni ? 'invalidado' : 'titular',
          mensaje: actual?.estado === 'usado' ? 'La entrada ya fue utilizada.' :
            'La entrada cambió de estado o de titular. Escanea el QR actualizado.',
          encargado: encargado.nombre
        };
      }

      // El ingreso y su historial ya se confirmaron en tickets_db. El estado
      // usado bloquea cualquier nueva validacion, aun si qr_db tarda en
      // actualizarse. No retrasar la respuesta al encargado por esa limpieza.
      void Promise.resolve()
        .then(() => token ? qrClient.marcarUsado(token, requestId) : qrClient.invalidar(fila.id, requestId))
        .catch((err) => {
          logger.warn('marcar_token_usado_fallido', { codigo, error: err.message });
        });

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
