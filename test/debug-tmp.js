'use strict';
const { crearContexto, cargarJs, cargarPagina, evaluar } = require('./dom-sim');
const dormir = ms => new Promise(r => setTimeout(r, ms));

process.on('unhandledRejection', e => { console.log('RECHAZO NO MANEJADO:', e); });

(async () => {
  /* --- entrada.html --- */
  console.log('--- entrada.html ---');
  const ctx = crearContexto();
  cargarJs(ctx, 'js/qr.js');
  cargarJs(ctx, 'js/api.js');
  cargarPagina(ctx, 'entrada.html', ['js/app.js', 'js/entrada.js']);
  await dormir(1200);
  const d = ctx.document;
  ['t-evento', 't-token', 'cd-num', 'panel-rotaciones', 't-dni'].forEach(id => {
    const el = d.getElementById(id);
    console.log('  ', id, '=', JSON.stringify(el.textContent));
  });
  const canvas = d.getElementById('qr-canvas');
  console.log('   canvas w/h =', canvas.width, canvas.height);
  console.log('   payload =', JSON.stringify(d.getElementById('payload-visible').textContent));

  /* --- verificar.html --- */
  console.log('--- verificar.html ---');
  const c2 = crearContexto();
  cargarJs(c2, 'js/qr.js');
  cargarJs(c2, 'js/api.js');
  cargarPagina(c2, 'verificar.html', ['js/app.js', 'js/verificar.js']);
  await dormir(800);
  const d2 = c2.document;
  console.log('   chips =', d2.getElementById('chips-codigos').innerHTML.length, 'chars');
  const form = d2.getElementById('form-verificar');
  d2.getElementById('codigo').value = 'NOEXISTE99';
  await form._fire('submit', { target: form });
  await dormir(800);
  console.log('   titulo =', JSON.stringify(d2.getElementById('res-titulo').textContent));
  console.log('   resultado class =', JSON.stringify(d2.getElementById('resultado').className));

  d2.getElementById('codigo').value = 'ENTRY001';
  await form._fire('submit', { target: form });
  await dormir(800);
  console.log('   titulo ENTRY001 =', JSON.stringify(d2.getElementById('res-titulo').textContent));
})();
