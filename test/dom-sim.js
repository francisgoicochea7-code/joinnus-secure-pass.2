/* =========================================================================
 * JOINNUS SECURE PASS — test/dom-sim.js
 * Micro-DOM para ejecutar las páginas en Node (no requiere navegador).
 * Permite correr los scripts reales de cada página y detectar errores.
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

/* --------------------------------------------------------------------- */
/* Elemento simulado                                                     */
/* --------------------------------------------------------------------- */
class El {
  constructor(tag = 'div', id = '') {
    this.tagName = String(tag).toUpperCase();
    this.id = id;
    this._html = '';
    this._text = '';
    this.value = '';
    this.className = '';
    this.style = {};
    this.dataset = {};
    this.attributes = {};
    this.disabled = false;
    this.href = '';
    this.files = [];
    this.children = [];
    this.parent = null;
    this._listeners = {};
    this._classList = new Set();

    const self = this;
    this.classList = {
      add: (...c) => c.forEach(x => self._classList.add(x)),
      remove: (...c) => c.forEach(x => self._classList.delete(x)),
      contains: c => self._classList.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !self._classList.has(c) : !!force;
        on ? self._classList.add(c) : self._classList.delete(c);
        return on;
      }
    };
  }

  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = String(v == null ? '' : v);
    // Registro perezoso de los ids presentes en el HTML generado
    const re = /id="([A-Za-z0-9_-]+)"/g;
    let m;
    while ((m = re.exec(this._html))) REGISTRO.asegurar(m[1]);
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v == null ? '' : v); }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  hasAttribute(k) { return k in this.attributes; }
  removeAttribute(k) { delete this.attributes[k]; }

  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  focus() { }
  select() { }
  click() { this._fire('click', { target: this, preventDefault() { } }); }
  scrollIntoView() { }
  getContext() { return CTX; }
  setAttribute2() { }

  addEventListener(tipo, fn) { (this._listeners[tipo] = this._listeners[tipo] || []).push(fn); }
  removeEventListener(tipo, fn) {
    if (this._listeners[tipo]) this._listeners[tipo] = this._listeners[tipo].filter(f => f !== fn);
  }
  dispatchEvent(ev) { this._fire(ev.type, ev); }

  _fire(tipo, ev) {
    ev = ev || {};
    ev.type = ev.type || tipo;
    ev.target = ev.target || this;
    if (!ev.preventDefault) ev.preventDefault = () => { };
    if (!ev.stopPropagation) ev.stopPropagation = () => { };
    (this._listeners[tipo] || []).forEach(fn => fn.call(this, ev));
  }

  /** closest() con selectores simples: '#id', '.clase', '[attr]', 'tag' */
  closest(sel) {
    let n = this;
    while (n) {
      if (coincide(n, sel)) return n;
      n = n.parent;
    }
    return null;
  }

  /** querySelector/querySelectorAll: por id, clase, atributo o descendencia */
  _buscar(sel, todos) {
    const partes = String(sel).trim().split(/\s+/);
    let lista = [this];
    for (const parte of partes) {
      const siguiente = [];
      for (const raiz of lista) {
        const nivel = raiz === this ? [...this.children] : [];
        if (raiz !== this) visitarHijos(raiz, nivel);
        for (const c of nivel) if (coincide(c, parte)) siguiente.push(c);
      }
      lista = siguiente;
    }
    // El micro-DOM no construye arboles: un <tbody> (u hijo equivalente) no
    // existe como elemento. Cuando el selector es un unico nombre de etiqueta
    // se devuelve el elemento receptor, igual que ya hace document.querySelector
    // con los selectores de descendencia. Asi `tabla.querySelector('tbody')`
    // escribe sobre el elemento registrado, que es el que lee la asercion.
    if (!lista.length && partes.length === 1) {
      lista = [this];
    }
    return todos ? lista : (lista[0] || null);
  }
  querySelector(sel) { return this._buscar(sel, false); }
  querySelectorAll(sel) { return this._buscar(sel, true); }
}

function coincide(el, sel) {
  sel = String(sel).trim();
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  if (sel.startsWith('.')) return el._classList.has(sel.slice(1)) || (el.className || '').split(/\s+/).includes(sel.slice(1));
  if (sel.startsWith('[') && sel.endsWith(']')) {
    const attr = sel.slice(1, -1).split('=')[0];
    return el.hasAttribute(attr);
  }
  return el.tagName === sel.toUpperCase();
}

function visitarHijos(el, salida) {
  for (const c of el.children) { salida.push(c); visitarHijos(c, salida); }
  return salida;
}

/* Contexto de canvas 2D simulado */
const CTX = new Proxy({}, {
  get(target, prop) {
    if (prop === 'canvas') return { width: 0, height: 0 };
    return () => { };
  },
  set() { return true; }
});

/* --------------------------------------------------------------------- */
/* Registro de elementos por id                                           */
/* --------------------------------------------------------------------- */
const REGISTRO = {
  mapa: new Map(),
  fuenteHtml: '',
  asegurar(id) {
    if (!this.mapa.has(id)) this.mapa.set(id, new El('div', id));
    return this.mapa.get(id);
  },
  cargar(paginaHtml) {
    this.mapa.clear();
    this.fuenteHtml = paginaHtml;
    const re = /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*\sid="([A-Za-z0-9_-]+)"[^>]*)>/g;
    let m;
    while ((m = re.exec(paginaHtml))) {
      const el = new El(m[1], m[3]);
      const attrRe = /([a-zA-Z-]+)="([^"]*)"/g;
      let a;
      while ((a = attrRe.exec(m[2]))) el.setAttribute(a[1], a[2]);
      if (el.className) el.className.split(/\s+/).forEach(c => c && el._classList.add(c));
      el.tagName = m[1].toUpperCase();
      this.mapa.set(m[3], el);
    }
  }
};

/* --------------------------------------------------------------------- */
/* Documento y contexto                                                   */
/* --------------------------------------------------------------------- */
function crearContexto() {
  REGISTRO.cargar('');

  const cuerpo = new El('body');
  cuerpo.setAttribute('data-clock-format', 'fecha-hora');

  const document = {
    body: cuerpo,
    documentElement: new El('html'),
    readyState: 'complete',
    _listeners: {},
    getElementById(id) { return REGISTRO.mapa.get(id) || REGISTRO.asegurar(id); },
    querySelector(sel) {
      sel = String(sel).trim();
      if (sel === 'body') return cuerpo;
      // Selector con descendencia: '#id hijo'. El micro-DOM no construye
      // arboles, asi que se devuelve el elemento raiz (su innerHTML es el
      // contenedor real de todo el contenido).
      if (sel.includes(' ')) {
        const [raiz, ...resto] = sel.split(/\s+/);
        const padre = document.querySelector(raiz);
        if (!padre) return null;
        if (!resto.length) return padre;
        const real = padre.querySelector(resto.join(' '));
        return real || padre;
      }
      if (sel.startsWith('#')) return document.getElementById(sel.slice(1));
      if (sel.startsWith('.')) {
        for (const el of REGISTRO.mapa.values()) {
          if (el._classList.has(sel.slice(1))) return el;
        }
        return null;
      }
      return null;
    },
    querySelectorAll() { return []; },
    createElement(tag) { return new El(tag); },
    addEventListener(tipo, fn) { (this._listeners[tipo] = this._listeners[tipo] || []).push(fn); },
    removeEventListener() { },
    _fire(tipo, ev) {
      ev = ev || {};
      ev.type = tipo;
      if (!ev.preventDefault) ev.preventDefault = () => { };
      (this._listeners[tipo] || []).forEach(fn => fn(ev));
    }
  };

  // localStorage en memoria
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; }
  };

  const sandbox = {
    console,
    document,
    localStorage,
    navigator: { clipboard: null },
    performance: { now: () => Date.now() },
    requestAnimationFrame: fn => setTimeout(() => fn(Date.now()), 0),
    setTimeout, clearTimeout, setInterval, clearInterval,
    AbortController: typeof AbortController !== 'undefined' ? AbortController : undefined,
    Date, JSON, Math, Number, String, Array, Object, Boolean, Error,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    URLSearchParams, Promise, RegExp, Uint8Array, Int32Array,
    HTMLCanvasElement: El,
    Blob: class { constructor() { } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => { } },
    TextEncoder: typeof TextEncoder !== 'undefined' ? TextEncoder : undefined
  };
  // cliente-api.js construye un AbortController en cada peticion: sin esto el
  // ReferenceError aborta la deteccion del backend y el modo API nunca arranca.
  if (typeof AbortController !== 'undefined') sandbox.AbortController = AbortController;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.devicePixelRatio = 1;
  sandbox.crypto = {
    getRandomValues(buf) {
      for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
      return buf;
    }
  };
  sandbox.location = {
    pathname: '/index.html',
    search: '',
    href: 'http://localhost:8080/index.html'
  };
  sandbox.addEventListener = () => { };

  vm.createContext(sandbox);
  return { sandbox, document, localStorage, store };
}

/* Carga un archivo JS dentro del contexto */
function cargarJs(ctx, relativo) {
  const codigo = fs.readFileSync(path.join(RAIZ, relativo), 'utf8');
  try {
    vm.runInContext(codigo, ctx.sandbox, { filename: relativo });
  } catch (e) {
    throw new Error(`Error al ejecutar ${relativo}: ${e.message}`);
  }
}
/* Carga una página: registra sus ids y ejecuta sus scripts */
function cargarPagina(ctx, pagina, scripts) {
  const html = fs.readFileSync(path.join(RAIZ, pagina), 'utf8');
  REGISTRO.cargar(html);
  ctx.document._listeners = {};
  ctx.sandbox.location.pathname = '/' + pagina;
  ctx.sandbox.location.href = 'http://localhost:8080/' + pagina;
  ctx.sandbox.location.search = '';
  (scripts || []).forEach(s => cargarJs(ctx, s));
  // DOMContentLoaded
  ctx.document._fire('DOMContentLoaded');
  return html;
}

/* Evalúa una expresión dentro del contexto (los `const` de nivel superior
 * viven en el ámbito léxico global, no como propiedades del objeto global) */
function evaluar(ctx, expresion) {
  return vm.runInContext(expresion, ctx.sandbox, { filename: 'eval' });
}

module.exports = { crearContexto, cargarJs, cargarPagina, evaluar, REGISTRO, El };
