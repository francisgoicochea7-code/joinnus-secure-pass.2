'use strict';

const { AppError } = require('../../../shared/errors');
const { enriquecer, mapearHistorial } = require('../domain/entrada');

function crearConsultas({ entradaRepo, historialRepo, demoDni }) {
  return {
    async listar(dni) {
      const filas = await entradaRepo.listar();
      return filas.map((fila) => enriquecer(fila, dni, demoDni));
    },

    async obtener(codigo, dni) {
      const fila = await entradaRepo.obtenerPorCodigo(codigo);
      if (!fila) {
        throw new AppError(`La entrada ${codigo} no existe en el sistema.`, 404, 'ENTRADA_NO_ENCONTRADA');
      }
      return enriquecer(fila, dni, demoDni);
    },

    async resumen(dni) {
      const r = await entradaRepo.resumen(dni);
      return {
        activas: Number(r.activas || 0),
        usadas: Number(r.usadas || 0),
        transferidas: Number(r.transferidas || 0),
        anuladas: Number(r.anuladas || 0),
        total: Number(r.total || 0),
        mias: Number(r.mias || 0)
      };
    },

    async historial(dni) {
      const filas = dni
        ? await historialRepo.listarPorDni(dni)
        : await historialRepo.listarTodo();
      return mapearHistorial(filas);
    },

    async historialEntrada(codigo) {
      const filas = await historialRepo.listarPorEntrada(codigo);
      return mapearHistorial(filas);
    },

    async verificar(codigo, dni) {
      const fila = await entradaRepo.obtenerPorCodigo(codigo);
      if (!fila) {
        throw new AppError(`La entrada ${codigo} no existe en el sistema.`, 404, 'ENTRADA_NO_ENCONTRADA');
      }

      await historialRepo.registrar(
        codigo,
        'verificada',
        fila.titular_nombre,
        'Consulta de estado desde el verificador',
        fila.estado
      );

      const entrada = enriquecer(fila, dni, demoDni);
      const consultas = await entradaRepo.contarHistorial(codigo);

      return {
        entrada,
        verificacion: {
          fecha: new Date().toISOString(),
          consultas: Number(consultas),
          mensaje: entrada.estadoDetalle.descripcion
        }
      };
    }
  };
}

module.exports = { crearConsultas };
