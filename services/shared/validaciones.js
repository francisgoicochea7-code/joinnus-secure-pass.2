'use strict';

const { verificarSesion } = require('./session');
const { AppError } = require('./errors');

const RE_DNI = /^\d{8}$/;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const RE_NOMBRE = /^\p{L}[\p{L}\s'.-]*$/u;

/** Enmascara un DNI dejando visibles los dos últimos dígitos. */
function ocultarDNI(dni) {
  const d = String(dni || '');
  if (d.length < 4) return '********';
  return '********' + d.slice(-2);
}

/** Normaliza un nombre: espacios simples y sin extremos. */
function normalizarNombre(nombre) {
  return String(nombre || '').replace(/\s+/g, ' ').trim();
}

/** Valida los datos mínimos de un usuario. */
function validarUsuario(datos) {
  const b = datos || {};
  const campos = {};

  const dni = String(b.dni || '').trim();
  if (!RE_DNI.test(dni)) campos.dni = 'El DNI debe tener exactamente 8 números.';

  const nombre = normalizarNombre(b.nombre);
  if (nombre.length < 3 || nombre.length > 120 || !RE_NOMBRE.test(nombre)) {
    campos.nombre = 'Escribe el nombre completo (sólo letras).';
  }

  const correo = String(b.correo || '').trim().toLowerCase();
  if (!correo || correo.length > 160 || !RE_CORREO.test(correo)) {
    campos.correo = 'El correo no tiene un formato válido (ej. ana@correo.com).';
  }

  if (Object.keys(campos).length) {
    return { ok: false, error: 'Revisa los datos del formulario.', campos };
  }

  return {
    ok: true,
    datos: {
      dni,
      nombre,
      correo,
      telefono: String(b.telefono || '').trim().slice(0, 30) || null
    }
  };
}

/**
 * DNI de la persona que hace la petición.
 *
 * Sólo se acepta la sesión firmada que emite auth-service al comprobar la
 * contraseña (cabecera Authorization: Bearer ...). La antigua cabecera
 * X-Usuario-DNI ya NO se usa para autenticar: cualquiera podía escribir el
 * DNI de otra persona. El DNI de demostración queda reservado para los
 * resúmenes públicos que lo solicitan explícitamente.
 */
function dniDePeticion(req, demoDni, secreto) {
  const cabecera = String(req.get('Authorization') || '');
  const encontrado = /^Bearer\s+([^\s]+)$/i.exec(cabecera);
  const sesion = encontrado ? verificarSesion(encontrado[1], secreto) : null;
  return sesion ? sesion.dni : demoDni;
}

function requerirDniDeSesion(req, secreto) {
  const dni = dniDePeticion(req, null, secreto);
  if (!dni) {
    throw new AppError('Inicia sesión para continuar.', 401, 'SESION_REQUERIDA');
  }
  return dni;
}

module.exports = {
  RE_DNI,
  RE_CORREO,
  RE_NOMBRE,
  ocultarDNI,
  normalizarNombre,
  validarUsuario,
  dniDePeticion,
  requerirDniDeSesion
};
