/* Autoverificación del generador de QR (Node) — no forma parte de la web.
 * Ejecutar:  node test/qr-selftest.js
 *
 * Comprueba de forma independiente del codificador:
 *  A) Estructura de la matriz (finder, timing, módulo oscuro, info de formato BCH)
 *  B) Viaje redondo: lectura en zigzag -> des-intercalado -> sindrome Reed-Solomon -> texto
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = { devicePixelRatio: 1 };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'qr.js'), 'utf8'), sandbox);
const QRCode = sandbox.window.QRCode;

/* ---- Tabla ECC local (copia independiente para el test) ---- */
const ECC = {
  L: [null,[7,1,19,0,0],[10,1,34,0,0],[15,1,55,0,0],[20,1,80,0,0],[26,1,108,0,0],[18,2,68,0,0],[20,2,78,0,0],[24,2,97,0,0],[30,2,116,0,0],[18,2,68,2,69],[20,4,81,0,0],[24,2,92,2,93],[26,4,107,0,0],[30,3,115,1,116],[22,5,87,1,88],[24,5,98,1,99],[28,1,107,5,108],[30,5,120,1,121],[28,3,113,4,114],[28,3,107,5,108]],
  M: [null,[10,1,16,0,0],[16,1,28,0,0],[26,1,44,0,0],[18,2,32,0,0],[24,2,43,0,0],[16,4,27,0,0],[18,4,31,0,0],[22,2,38,2,39],[22,3,36,2,37],[26,4,43,1,44],[30,1,50,4,51],[22,6,36,2,37],[22,8,37,1,38],[24,4,40,5,41],[24,5,41,5,42],[28,7,45,3,46],[28,10,46,1,47],[26,9,43,4,44],[26,3,44,11,45],[26,3,41,13,42]],
  Q: [null,[13,1,13,0,0],[22,1,22,0,0],[18,2,17,0,0],[26,2,24,0,0],[18,2,15,2,16],[24,4,19,0,0],[18,2,14,4,15],[22,4,18,2,19],[20,4,16,4,17],[24,6,19,2,20],[28,4,22,4,23],[26,4,20,6,21],[24,8,20,4,21],[20,11,16,5,17],[30,5,24,7,25],[24,15,19,2,20],[28,1,22,15,23],[28,17,22,1,23],[26,17,21,4,22],[30,15,24,5,25]],
  H: [null,[17,1,9,0,0],[28,1,16,0,0],[22,2,13,0,0],[16,4,9,0,0],[22,2,11,2,12],[28,4,15,0,0],[26,4,13,1,14],[26,4,14,2,15],[24,4,12,4,13],[28,6,15,2,16],[24,3,12,8,13],[28,7,14,4,15],[22,12,11,4,12],[24,11,12,5,13],[24,11,12,7,13],[30,3,15,13,16],[28,2,14,17,15],[28,2,14,19,15],[26,9,13,16,14],[28,15,15,10,16]]
};
const TOTAL = [0,26,44,70,100,134,172,196,242,292,346,404,466,532,581,655,733,815,901,991,1085];
const ALIGN = [null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90]];

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function polyEval(coeffs, x) { // coeffs[0] = mayor grado
  let y = 0;
  for (const c of coeffs) y = mul(y, x) ^ c;
  return y;
}
function syndromesZero(block, eccCount) {
  const n = block.length;
  for (let i = 0; i < eccCount; i++) {
    if (polyEval(block, EXP[i]) !== 0) return false;
  }
  return n >= eccCount;
}

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.log('  FALLO: ' + msg); } }

function readFormat(m) {
  const size = m.size, g = (r, c) => m.get(r, c);
  const bits = [];
  for (let i = 0; i <= 5; i++) bits.push(g(i, 8));
  bits.push(g(7, 8)); bits.push(g(8, 8)); bits.push(g(8, 7));
  for (let i = 9; i < 15; i++) bits.push(g(8, 14 - i));
  let v = 0; for (let i = 14; i >= 0; i--) v = (v << 1) | bits[i];
  return v;
}
function readFormat2(m) {
  const size = m.size, g = (r, c) => m.get(r, c);
  const bits = [];
  for (let i = 0; i < 8; i++) bits.push(g(8, size - 1 - i));
  for (let i = 8; i < 15; i++) bits.push(g(size - 15 + i, 8));
  let v = 0; for (let i = 14; i >= 0; i--) v = (v << 1) | bits[i];
  return v;
}
function formatIsValidBch(bits) {
  const raw = bits ^ 0x5412;
  const data = raw >>> 10;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) === raw;
}

function maskFn(mask, r, c) {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return (r * c) % 2 + (r * c) % 3 === 0;
    case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
    default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
  }
}

function extractDataBits(m) {
  const size = m.size, bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!m.reserved[y * size + x]) {
          let v = m.get(y, x);
          if (maskFn(m.maskUsed, y, x)) v ^= 1;   // quitar la máscara
          bits.push(v);
        }
      }
    }
  }
  return bits;
}

function decodeQR(m, eccLevel) {
  const v = m.version, row = ECC[eccLevel][v];
  const eccPerBlock = row[0], nG1 = row[1], szG1 = row[2], nG2 = row[3], szG2 = row[4];
  const totalData = nG1 * szG1 + nG2 * szG2;
  const bits = extractDataBits(m);
  const cw = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0; for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
    cw.push(b);
  }
  ok(cw.length === TOTAL[v], `total de palabras ${cw.length} != ${TOTAL[v]}`);

  // Des-intercalar
  const blocks = [], eccs = [];
  const sizes = [];
  for (let i = 0; i < nG1; i++) sizes.push(szG1);
  for (let i = 0; i < nG2; i++) sizes.push(szG2);
  for (let i = 0; i < sizes.length; i++) { blocks.push([]); eccs.push([]); }
  let idx = 0;
  const maxSz = Math.max(szG1, szG2);
  for (let d = 0; d < maxSz; d++)
    for (let b = 0; b < blocks.length; b++)
      if (d < sizes[b]) blocks[b].push(cw[idx++]);
  for (let e = 0; e < eccPerBlock; e++)
    for (let b = 0; b < blocks.length; b++) eccs[b].push(cw[idx++]);

  blocks.forEach((b, i) => ok(syndromesZero(b.concat(eccs[i]), eccPerBlock),
    `síndrome Reed-Solomon no nulo en bloque ${i}`));

  // Reconstruir el flujo de datos
  const dataStream = [].concat(...blocks);
  const flat = [];
  dataStream.forEach(b => { for (let i = 7; i >= 0; i--) flat.push((b >>> i) & 1); });
  const countBits = v < 10 ? 8 : 16;
  const mode = flat.slice(0, 4).join('');
  ok(mode === '0100', `modo esperado 0100, obtenido ${mode}`);
  let len = 0;
  for (let i = 4; i < 4 + countBits; i++) len = (len << 1) | flat[i];
  const bytes = [];
  for (let i = 0; i < len; i++) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | flat[4 + countBits + i * 8 + k];
    bytes.push(b);
  }
  ok(len <= (totalData * 8 - 4 - countBits) / 8, 'longitud de datos coherente');
  return Buffer.from(bytes).toString('utf8');
}

const samples = [
  'JSP-ENTRY001-8F42A91C',
  'JSP|ENTRY001|8F42A91C|1731|4',
  'a',
  'Hola Peru',
  'https://joinnussecurepass.demo/verificar?codigo=ENTRY001&token=8F42A91C',
  'JSP|ENTRY002|B31D07E2|1029|2',
  'Ñandú áéíóú 123 — prueba de UTF-8',
  'JSP|ENTRY005|C55D99AB|0930|1',
  'JSP|ENTRY004|D00F1234|2015|3',
  'X'.repeat(200),
  'Y'.repeat(600)
];

for (const level of ['L', 'M', 'Q', 'H']) {
  for (const text of samples) {
    const bytes = Buffer.byteLength(text, 'utf8');
    // Capacidad máxima de la versión 20 para este nivel (calculada desde la tabla)
    const r20 = ECC[level][20];
    const totalData20 = r20[1] * r20[2] + r20[3] * r20[4];
    const maxCap = Math.floor((totalData20 * 8 - 4 - 16) / 8);
    if (bytes > maxCap) {   // se espera una excepción controlada
      let threw = false;
      try { QRCode.create(text, { eccLevel: level }); } catch (e) { threw = true; }
      ok(threw, `debería lanzar error por exceso de capacidad [${level}]`);
      continue;
    }
    let m;
    try { m = QRCode.create(text, { eccLevel: level }); }
    catch (e) { ok(false, `[${level}] excepción con "${text.slice(0, 20)}": ${e.message}`); continue; }

    ok(m.size === m.version * 4 + 17, 'tamaño de matriz');
    // Patrones finder
    for (const [fr, fc] of [[0, 0], [0, m.size - 7], [m.size - 7, 0]]) {
      let good = true;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        const ring = (r === 0 || r === 6 || c === 0 || c === 6);
        const core = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        if (!!m.get(fr + r, fc + c) !== (ring || core)) good = false;
      }
      ok(good, 'patrón de detección de posición');
    }
    // Temporización
    let timing = true;
    for (let i = 8; i < m.size - 8; i++) {
      if (m.get(6, i) !== (i % 2 === 0 ? 1 : 0)) timing = false;
      if (m.get(i, 6) !== (i % 2 === 0 ? 1 : 0)) timing = false;
    }
    ok(timing, 'patrones de temporización');
    ok(m.get(m.size - 8, 8) === 1, 'módulo oscuro fijo');
    // Alineación
    const pos = ALIGN[m.version];
    if (pos.length) {
      const last = pos[pos.length - 1];
      ok(m.get(last, last) === 1, 'centro del patrón de alineación');
    }
    // Información de formato
    const f1 = readFormat(m), f2 = readFormat2(m);
    ok(f1 === f2, `las dos copias de la info de formato difieren (${f1} vs ${f2})`);
    ok(formatIsValidBch(f1), 'BCH de la información de formato inválido');
    const raw = f1 ^ 0x5412;
    const eccBits = raw >>> 13;
    const expectedBits = { L: 1, M: 0, Q: 3, H: 2 }[level];
    ok(eccBits === expectedBits, `nivel ECC de la info de formato: ${eccBits} != ${expectedBits}`);
    ok(((raw >>> 10) & 7) === m.maskUsed, 'máscara declarada en la info de formato');
    // Información de versión (v>=7)
    if (m.version >= 7) {
      let rem = m.version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const expect = (m.version << 12) | rem;
      let got = 0;
      for (let i = 0; i < 18; i++) {
        const a = m.size - 11 + (i % 3), b = Math.floor(i / 3);
        const bit = (expect >>> i) & 1;
        if (m.get(a, b) !== bit || m.get(b, a) !== bit) got = 1;
      }
      ok(got === 0, 'información de versión (BCH-18) incorrecta');
    }
    // Viaje redondo completo
    const back = decodeQR(m, level);
    ok(back === text, `viaje redondo: "${back}" != "${text.slice(0, 24)}"`);
  }
}

// Comprobación de versiones elegidas contra capacidades conocidas
ok(QRCode.create('JSP-ENTRY001-8F42A91C').version === 2, 'versión esperada para el token de ejemplo');
ok(QRCode.create('JSP|ENTRY001|8F42A91C|1731|4').version === 3, 'versión esperada para el payload del QR');

console.log(`\nQR selftest: ${checks} comprobaciones, ${failures} fallo(s).`);
process.exit(failures ? 1 : 0);
