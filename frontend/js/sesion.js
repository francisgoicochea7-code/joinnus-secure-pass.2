/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/sesion.js
 * -------------------------------------------------------------------------
 * Sesión de la persona que está viendo el panel.
 *
 * Desde esta versión el inicio de sesión es REAL: DNI + contraseña. La
 * contraseña se comprueba en el servidor (hash scrypt en la base de datos) y
 * la respuesta trae un token firmado (HMAC-SHA256, 8 horas). Ese token viaja
 * en Authorization: Bearer ... y el servidor ya NO acepta la cabecera
 * X-Usuario-DNI para hacerse pasar por otra persona.
 *
 * Sin conexión con la API (modo local, sin Docker) sólo puede entrar el
 * usuario de demostración; el resto de la maqueta funciona con localStorage.
 *
 * `identificar(dni, nombres, apellidos)` se conserva por compatibilidad con
 * las pruebas y las sesiones antiguas: ya no se usa desde el modal.
 * ========================================================================= */

const Sesion = (function () {
  'use strict';

  const CLAVE = 'jsp.sesion.usuario.v1';

  /* Usuario ficticio del modo local (sin API). La contraseña es pública a
   * propósito: sólo sirve en la maqueta. */
  const DEMO = { dni: '45678945', nombre: 'Carlos Pérez', password: 'Carlos2026!' };

  /* @type {{dni:string,nombre:string,nombres?:string,apellidos?:string,token?:string,expiraEn?:number}|null} */
  let usuario = null;

  const suscriptores = [];

  /* ---------------------------------------------------------------------
   * Persistencia
   * ----------------------------------------------------------------- */
  function leer() {
    if (usuario) return usuario;
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      const u = JSON.parse(crudo);
      if (!u || typeof u.dni !== 'string' || !/^\d{8}$/.test(u.dni)) return null;

      // Token caducado: se descarta.
      if (u.expiraEn && Date.now() >= Number(u.expiraEn)) {
        try { localStorage.removeItem(CLAVE); } catch (e) { /* ignorar */ }
        return null;
      }

      // Sesiones antiguas (sin token) de otra persona: ya no sirven para el
      // servidor, así que no se restauran. La del usuario demo se conserva
      // porque el modo local no tiene token.
      if (!u.token && u.dni !== DEMO.dni) {
        try { localStorage.removeItem(CLAVE); } catch (e) { /* ignorar */ }
        return null;
      }

      usuario = u;
      return usuario;
    } catch (e) { /* almacenamiento no disponible */ }
    return null;
  }

  function guardar(u) {
    usuario = u;
    try { localStorage.setItem(CLAVE, JSON.stringify(u)); } catch (e) { /* ignorar */ }
    return usuario;
  }

  function olvidar() {
    usuario = null;
    try { localStorage.removeItem(CLAVE); } catch (e) { /* ignorar */ }
    notificar();
  }

  /* ---------------------------------------------------------------------
   * Estado
   * ----------------------------------------------------------------- */
  function estaIdentificado() { return !!leer(); }
  function dni() { const u = leer(); return u ? u.dni : null; }
  function nombre() { const u = leer(); return u ? u.nombre : null; }

  /** Cabeceras que viajan en cada petición a la API. */
  function cabeceras() {
    const u = leer();
    if (!u) return {};
    const h = { 'X-Usuario-DNI': u.dni };       // compatibilidad con la demo
    if (u.token) h.Authorization = 'Bearer ' + u.token;
    return h;
  }

  /** Compara nombres ignorando tildes, mayúsculas y espacios de sobra. */
  function normalizar(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // quita los signos diacríticos
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  /* ---------------------------------------------------------------------
   * Validaciones
   * ----------------------------------------------------------------- */
  function validarDni(valor) {
    const v = String(valor || '').trim();
    if (!v) return { ok: false, mensaje: 'El DNI es obligatorio.' };
    if (!/^\d{8}$/.test(v)) {
      return { ok: false, mensaje: 'El DNI debe tener exactamente 8 números.' };
    }
    return { ok: true, valor: v };
  }

  function validarTexto(valor, etiqueta) {
    const v = String(valor || '').trim();
    if (!v) return { ok: false, mensaje: 'El ' + etiqueta + ' es obligatorio.' };
    if (v.length < 2) return { ok: false, mensaje: 'El ' + etiqueta + ' es demasiado corto.' };
    if (!/^[A-Za-zÁÉÍÓÚÑáéíóúñ' ]{2,}$/.test(v)) {
      return { ok: false, mensaje: 'El ' + etiqueta + ' solo admite letras y espacios.' };
    }
    return { ok: true, valor: v };
  }

  /* ---------------------------------------------------------------------
   * Inicio de sesión con contraseña
   * ----------------------------------------------------------------- */
  /**
   * Entra con DNI + contraseña contra la API.
   * @returns {{ok:true, usuario:object}|{ok:false, campo:string, mensaje:string}}
   */
  async function iniciarSesion(dniEntrada, password) {
    const d = validarDni(dniEntrada);
    if (!d.ok) return { ok: false, campo: 'dni', mensaje: d.mensaje };

    const clave = String(password == null ? '' : password);
    if (!clave) {
      return { ok: false, campo: 'password', mensaje: 'Escribe tu contraseña.' };
    }

    if (window.ClienteAPI) {
      let disponible = false;
      try { disponible = await window.ClienteAPI.comprobar(); }
      catch (e) { disponible = false; }

      if (disponible) {
        let r;
        try {
          r = await window.ClienteAPI.iniciarSesion(d.valor, clave);
        } catch (e) {
          return {
            ok: false, campo: 'password',
            mensaje: 'No se pudo contactar con la API. Revisa que los contenedores estén arriba.'
          };
        }

        if (r && r.status === 404) {
          return {
            ok: false, campo: 'password',
            mensaje: 'Este servidor no admite el inicio de sesión con contraseña. Usa la versión de microservicios (puerto 8444).'
          };
        }

        if (!r || !r.ok || !r.datos || !r.datos.ok) {
          const delServidor = r && r.datos && (r.datos.error || r.datos.mensaje);
          return {
            ok: false, campo: 'password',
            mensaje: delServidor || 'DNI o contraseña incorrectos.'
          };
        }

        const u = r.datos.usuario || {};
        return {
          ok: true,
          usuario: guardar({
            dni: d.valor,
            nombre: u.nombre || '',
            token: r.datos.token || null,
            expiraEn: r.datos.expiraEn || null
          })
        };
      }
    }

    // Modo local: sólo existe el usuario de demostración.
    if (d.valor === DEMO.dni && clave === DEMO.password) {
      return {
        ok: true,
        usuario: guardar({ dni: DEMO.dni, nombre: DEMO.nombre, token: null, expiraEn: null })
      };
    }
    return {
      ok: false, campo: 'password',
      mensaje: 'Sin conexión con la API sólo puede entrar el usuario de demostración (DNI 45678945 / Carlos2026!).'
    };
  }

  /* ---------------------------------------------------------------------
   * Identificación antigua (SIN contraseña). Sólo se conserva para las
   * pruebas y las sesiones locales anteriores; el modal ya no la usa.
   * ----------------------------------------------------------------- */
  async function identificar(dniEntrada, nombres, apellidos) {
    const d = validarDni(dniEntrada);
    if (!d.ok) return { ok: false, campo: 'dni', mensaje: d.mensaje };

    const nom = validarTexto(nombres, 'nombre');
    if (!nom.ok) return { ok: false, campo: 'nombres', mensaje: nom.mensaje };

    const ape = validarTexto(apellidos, 'apellido');
    if (!ape.ok) return { ok: false, campo: 'apellidos', mensaje: ape.mensaje };

    const escrito = normalizar(nom.valor + ' ' + ape.valor);
    const montar = function (nombreRegistrado) {
      return guardar({
        dni: d.valor,
        nombre: nombreRegistrado,
        nombres: nom.valor,
        apellidos: ape.valor
      });
    };

    // Modo API: se pregunta al backend
    if (window.ClienteAPI) {
      let disponible = false;
      try { disponible = await window.ClienteAPI.comprobar(); }
      catch (e) { disponible = false; }

      if (disponible) {
        let r;
        try {
          r = await window.ClienteAPI.buscarUsuario(d.valor);
        } catch (e) {
          return {
            ok: false, campo: 'dni',
            mensaje: 'No se pudo contactar con la API. Revisa que los contenedores estén arriba.'
          };
        }
        if (!r) {
          return {
            ok: false, campo: 'dni',
            mensaje: 'No encontramos a ninguna persona con ese DNI.'
          };
        }
        if (normalizar(r.nombre) !== escrito) {
          return {
            ok: false, campo: 'nombres',
            mensaje: 'El nombre no coincide con el registrado para ese DNI.'
          };
        }
        return { ok: true, usuario: montar(r.nombre) };
      }
    }

    // Modo local (sin Docker): solo existe el usuario de demostracion
    if (d.valor === DEMO.dni) {
      if (normalizar(DEMO.nombre) !== escrito) {
        return {
          ok: false, campo: 'nombres',
          mensaje: 'El nombre no coincide con el usuario de demostración.'
        };
      }
      return {
        ok: true,
        usuario: montar(DEMO.nombre)
      };
    }
    return {
      ok: false, campo: 'dni',
      mensaje: 'Sin conexión con la API solo se reconoce el usuario de demostración (DNI 45678945).'
    };
  }

  /* ---------------------------------------------------------------------
   * Aviso a las páginas cuando cambia la persona
   * ----------------------------------------------------------------- */
  function alCambiar(fn) { suscriptores.push(fn); }

  function notificar() {
    suscriptores.forEach(function (fn) {
      try { fn(leer()); } catch (e) { console.warn('[Sesion] suscriptor falló', e); }
    });
  }

  /* ------------------------------------------------------------------ */
  return {
    estaIdentificado: estaIdentificado,
    dni: dni,
    nombre: nombre,
    usuario: leer,
    cabeceras: cabeceras,
    iniciarSesion: iniciarSesion,
    identificar: identificar,
    olvidar: olvidar,
    normalizar: normalizar,
    validarDni: validarDni,
    validarTexto: validarTexto,
    alCambiar: alCambiar,
    notificar: notificar
  };
})();

if (typeof window !== 'undefined') window.Sesion = Sesion;
