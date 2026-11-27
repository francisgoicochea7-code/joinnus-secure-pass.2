'use strict';

/**
 * Verificación de sintaxis sin dependencias externas.
 *
 * Recorre el código propio del proyecto y compila cada archivo .js con el
 * motor de JavaScript de Node (`vm.Script`) sin ejecutarlo. Detecta errores
 * de sintaxis y archivos JSON mal formados, que es lo que sí rompe el
 * arranque; no opina sobre estilo.
 *
 * Uso:
 *   node scripts/verificar-sintaxis.js
 *   npm run lint
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');

/** Carpetas con código propio (node_modules y artefactos quedan fuera). */
const CARPETAS = [
  'api',
  'backend',
  'frontend/js',
  'frontend/staff',
  'scripts',
  'services',
  'test'
];

const IGNORAR = /(^|[\\/])(node_modules|\.git|dist|\.expo|coverage|outputs)([\\/]|$)/;

/** JSON que deben parsear: configuración del proyecto y del despliegue. */
const JSON_OBLIGATORIOS = [
  'package.json',
  'package-lock.json',
  'backend/package.json',
  'backend/package-lock.json',
  'services/package.json',
  'services/package-lock.json',
  'mobile/package.json',
  'mobile/app.json',
  'frontend/manifest.json',
  'vercel.json'
];

let revisados = 0;
const errores = [];

function listar(directorio) {
  const salida = [];
  for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
    const completo = path.join(directorio, entrada.name);
    if (IGNORAR.test(completo)) continue;
    if (entrada.isDirectory()) salida.push(...listar(completo));
    else salida.push(completo);
  }
  return salida;
}

function revisarJs(archivo) {
  const codigo = fs.readFileSync(archivo, 'utf8');
  const relativo = path.relative(RAIZ, archivo);
  revisados += 1;

  // Un módulo ES no se puede compilar con vm.Script: se delega a `node --check`.
  if (archivo.endsWith('.mjs')) {
    try {
      execFileSync(process.execPath, ['--check', archivo], { stdio: 'pipe' });
    } catch (error) {
      errores.push(`${relativo}\n${error.stderr ? error.stderr.toString() : error.message}`);
    }
    return;
  }

  try {
    // eslint-disable-next-line no-new
    new vm.Script(codigo, { filename: relativo });
  } catch (error) {
    errores.push(`${relativo}\n${error.message}`);
  }
}

function revisarJson(archivo) {
  const relativo = path.relative(RAIZ, archivo);
  revisados += 1;
  try {
    JSON.parse(fs.readFileSync(archivo, 'utf8'));
  } catch (error) {
    errores.push(`${relativo}\n${error.message}`);
  }
}

for (const carpeta of CARPETAS) {
  const base = path.join(RAIZ, carpeta);
  if (!fs.existsSync(base)) continue;
  for (const archivo of listar(base)) {
    if (archivo.endsWith('.js') || archivo.endsWith('.mjs')) revisarJs(archivo);
  }
}

for (const archivo of JSON_OBLIGATORIOS) {
  const completo = path.join(RAIZ, archivo);
  if (fs.existsSync(completo)) revisarJson(completo);
}

if (errores.length) {
  console.error(`\nSintaxis: ${errores.length} archivo(s) con problemas de ${revisados} revisados.\n`);
  for (const error of errores) console.error(`- ${error}\n`);
  process.exit(1);
}

console.log(`Sintaxis: ${revisados} archivos correctos.`);
