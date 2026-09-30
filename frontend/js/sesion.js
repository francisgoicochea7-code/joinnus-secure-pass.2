/* =========================================================================
 * JOINNUS SECURE PASS — frontend/js/sesion.js
 * -------------------------------------------------------------------------
 * Identidad de la persona que esta viendo el panel.
 *
 * IMPORTANTE — esto NO es autenticacion:
 * no hay contrasena y el DNI lo elige quien navega, asi que cualquiera
 * puede escribir el nombre de otra persona. Es una SIMULACION de iniciar
 * sesion, que sirve para que el prototipo sea multiusuario (cada quien ve
 * sus entradas y sus movimientos) y para dejar claro ante los jurados
 * donde esta el limite del sistema.
 *
 * Lo que si comprueba: que el DNI exista en la base y que el nombre
 * escrito coincida con el registrado, de modo que no se muestren datos
 * de una persona que se ha escrito mal.
 *
 * El DNI confirmado se guarda en localStorage (para no escribirlo en cada
 * pagina) y viaja al backend en la cabecera X-Usuario-DNI.
 * ========================================================================= */

const Sesion = (function () {
  'use strict';

  const CLAVE = 'jsp.sesion.usuario.v1';

  /* @type {{dni:string,nombre:string,nombres:string,apellidos:string}|null} */
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
      if (u && typeof u.dni === 'string' && /^\d{8}$/.test(u.dni)) {
        usuario = u;
        return usuario;
      }
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

  /** Cabecera que debe viajar en cada peticion a la API. */
  function cabeceras() {
    const d = dni();
    return d ? { 'X-Usuario-DNI': d } : {};
  }

  /** Compara nombres ignorando tildes, mayusculas y espacios de sobra. */
  function normalizar(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')   // quita los signos diacriticos
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
   * Identificacion
   * ----------------------------------------------------------------- */
  const DEMO = { dni: '45678945', nombre: 'Carlos Pérez' };

  /**
   * Confirma la identidad contra la base de datos.
   * @returns {{ok:true, usuario:object}|{ok:false, campo:string, mensaje:string}}
   */
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
   * Aviso a las paginas cuando cambia la persona
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
