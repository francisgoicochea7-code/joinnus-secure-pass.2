/* =========================================================================
 *  Prueba de humo de los microservicios.
 *
 *  Requisitos:
 *    docker compose --env-file .env.micro -f docker-compose.micro.yml up -d
 *
 *  Uso:
 *    npm run test:micro
 *
 *  Habla con https://localhost:8444 (certificado autofirmado local). No forma
 *  parte de `npm test` para que la suite unitaria no dependa de Docker.
 * ========================================================================= */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE = process.env.MICRO_BASE_URL || 'https://localhost:8444';

let comprobaciones = 0;
let fallos = 0;

function comprobar(condicion, mensaje) {
  comprobaciones += 1;
  if (condicion) {
    console.log(`  OK  ${mensaje}`);
  } else {
    fallos += 1;
    console.error(`FALLO ${mensaje}`);
  }
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pedir(metodo, ruta, cuerpo, headers = {}, intento = 0) {
  const respuesta = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });

  // El gateway limita las escrituras a 30/min. La prueba hace varias
  // seguidas, así que si el cubo está vacío espera y reintenta en vez de
  // declarar un fallo funcional. En producción el 429 es la respuesta
  // correcta y el navegador muestra el aviso al usuario.
  if (respuesta.status === 429 && intento < 8) {
    await esperar(3000);
    return pedir(metodo, ruta, cuerpo, headers, intento + 1);
  }

  const texto = await respuesta.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = { texto }; }
  return { status: respuesta.status, ok: respuesta.ok, datos };
}

async function main() {
  console.log(`\nPrueba de humo contra ${BASE}\n`);

  // ---------------------------------------------------------------------
  // 1. Salud y datos iniciales
  // ---------------------------------------------------------------------
  const salud = await pedir('GET', '/api/health');
  comprobar(salud.status === 200 && salud.datos.ok, 'GET /api/health responde 200');

  const resetInicial = await pedir('POST', '/api/demo/reiniciar', {});
  comprobar(resetInicial.status === 200 && resetInicial.datos.entradas === 7, 'reset inicial deja 7 entradas');
  comprobar(resetInicial.datos.usuarios === 6, 'reset inicial deja 6 usuarios');
  comprobar(resetInicial.datos.tokens === 0, 'reset inicial deja 0 tokens QR');

  const entradaInicial = await pedir('GET', '/api/entradas/ENTRY001', undefined, { 'X-Usuario-DNI': '45678945' });
  comprobar(entradaInicial.status === 200 && entradaInicial.datos.ok, 'GET /api/entradas/ENTRY001 responde 200');
  comprobar(entradaInicial.datos.entrada.titular === 'Carlos Pérez', 'ENTRY001 pertenece a Carlos Pérez');
  comprobar(entradaInicial.datos.entrada.qrToken === null, 'la semilla no inventa tokens QR');

  // ---------------------------------------------------------------------
  // 2. QR propio y ajeno
  // ---------------------------------------------------------------------
  const qr = await pedir('POST', '/api/entradas/ENTRY001/qr', {}, { 'X-Usuario-DNI': '45678945' });
  comprobar(qr.status === 200 && qr.datos.ok, 'POST /api/entradas/ENTRY001/qr responde 200');
  comprobar(Boolean(qr.datos.token), 'el QR trae token');
  comprobar(Boolean(qr.datos.payload), 'el QR trae payload');
  comprobar(qr.datos.entrada.qrToken === qr.datos.token, 'la entrada devuelta trae el token vigente');
  comprobar(qr.datos.entrada.esMia === true, 'la entrada se marca como propia del titular');

  const qrAjeno = await pedir('POST', '/api/entradas/ENTRY005/qr', {}, { 'X-Usuario-DNI': '45678945' });
  comprobar(qrAjeno.status === 403 && qrAjeno.datos.motivo === 'no-es-tuya', 'otro DNI no puede generar el QR ajeno');

  const validar = await pedir('POST', '/api/qr/validar', { token: qr.datos.token }, { 'X-Usuario-DNI': '45678945' });
  comprobar(validar.status === 200 && validar.datos.valido === true, 'el token recién generado es válido');
  comprobar(validar.datos.titular === 'Carlos Pérez', 'la validación identifica al titular');

  const validarMalo = await pedir('POST', '/api/qr/validar', { token: 'JSP-ENTRY001-00000000' }, { 'X-Usuario-DNI': '45678945' });
  comprobar(validarMalo.status === 200 && validarMalo.datos.valido === false, 'un token inventado se rechaza');
  comprobar(['desconocido', 'no-existe'].includes(validarMalo.datos.motivo), 'el motivo indica que el token no existe');

  // ---------------------------------------------------------------------
  // 3. Puerto: login, validación por código y registro de ingreso
  // ---------------------------------------------------------------------
  const login = await pedir('POST', '/api/encargados/login', { nombre: 'Ana Torres', codigo: 'ANA2026' });
  comprobar(login.status === 200 && login.datos.ok, 'login de encargado correcto');
  comprobar(login.datos.encargado.nombre === 'Ana Torres', 'el login devuelve el nombre del encargado');

  const loginMalo = await pedir('POST', '/api/encargados/login', { nombre: 'Ana Torres', codigo: 'INCORRECTO' });
  comprobar(loginMalo.status === 401, 'login de encargado incorrecto devuelve 401');

  const puertaCodigo = await pedir('POST', '/api/encargados/validar', {
    encargado: 'Ana Torres',
    codigo: 'ANA2026',
    entrada: 'ENTRY007'
  });
  comprobar(puertaCodigo.status === 200 && puertaCodigo.datos.valido === true, 'puerta valida por código ENTRY007');
  comprobar(puertaCodigo.datos.registrado === false, 'la consulta por código no registra ingreso');

  const puertaRegistra = await pedir('POST', '/api/encargados/validar', {
    encargado: 'Ana Torres',
    codigo: 'ANA2026',
    entrada: 'ENTRY007',
    registrar: true
  });
  comprobar(puertaRegistra.status === 200 && puertaRegistra.datos.registrado === true, 'la puerta registra el ingreso');

  const puertaRepetida = await pedir('POST', '/api/encargados/validar', {
    encargado: 'Ana Torres',
    codigo: 'ANA2026',
    entrada: 'ENTRY007'
  });
  comprobar(puertaRepetida.status === 200 && puertaRepetida.datos.valido === false, 'una entrada usada no vuelve a pasar');
  comprobar(puertaRepetida.datos.motivo === 'usada', 'el motivo es "usada"');

  const encargadoMalo = await pedir('POST', '/api/encargados/validar', {
    encargado: 'Ana Torres',
    codigo: 'INCORRECTO',
    entrada: 'ENTRY001'
  });
  comprobar(encargadoMalo.status === 401, 'un encargado no autorizado no valida entradas');

  // ---------------------------------------------------------------------
  // 4. Anulación y reactivación
  // ---------------------------------------------------------------------
  const anular = await pedir('POST', '/api/entradas/ENTRY007/estado/anulado', {});
  comprobar(anular.status === 200 && anular.datos.entrada.estado === 'anulado', 'se puede anular una entrada');
  comprobar(anular.datos.entrada.qrToken === null, 'al anular se limpia la proyección del QR');

  const reactivar = await pedir('POST', '/api/entradas/ENTRY007/estado/valido', {});
  comprobar(reactivar.status === 200 && reactivar.datos.entrada.estado === 'valido', 'se puede reactivar una entrada');
  comprobar(reactivar.datos.entrada.qrToken === null, 'al reactivar se pide un QR nuevo');

  const usadoDirecto = await pedir('POST', '/api/entradas/ENTRY001/estado/usado', {});
  comprobar(usadoDirecto.status === 403, 'el titular no puede marcar usado sin encargado');

  // ---------------------------------------------------------------------
  // 5. Usuarios
  // ---------------------------------------------------------------------
  const nuevo = await pedir('POST', '/api/usuarios', {
    nombre: 'Lucía Ramos',
    dni: '40000001',
    correo: 'lucia.ramos@demo.pe'
  });
  comprobar(nuevo.status === 201 && nuevo.datos.ok, 'se registra un usuario nuevo');
  comprobar(nuevo.datos.usuario.dni === '40000001', 'el usuario devuelve su DNI');

  const duplicado = await pedir('POST', '/api/usuarios', {
    nombre: 'Lucía Ramos',
    dni: '40000001',
    correo: 'lucia.ramos@demo.pe'
  });
  comprobar(duplicado.status === 409, 'un DNI duplicado devuelve 409');

  const buscar = await pedir('GET', '/api/usuarios/40000001');
  comprobar(buscar.status === 200 && buscar.datos.usuario.nombre === 'Lucía Ramos', 'GET /api/usuarios/:dni encuentra al usuario');

  const noExiste = await pedir('GET', '/api/usuarios/49999999');
  comprobar(noExiste.status === 404, 'un DNI inexistente devuelve 404');

  // ---------------------------------------------------------------------
  // 6. Transferencia con rotación de QR
  // ---------------------------------------------------------------------
  const qrMaria = await pedir('POST', '/api/entradas/ENTRY005/qr', {}, { 'X-Usuario-DNI': '43871264' });
  comprobar(qrMaria.status === 200 && Boolean(qrMaria.datos.token), 'María genera el QR de ENTRY005');

  const transferenciaAjena = await pedir('POST', '/api/entradas/ENTRY005/transferir', {
    nombre: 'Pedro Castillo',
    dni: '41234567',
    correo: 'pedro.castillo@demo.pe',
    precio: 50
  }, { 'X-Usuario-DNI': '45678945' });
  comprobar(transferenciaAjena.status === 403, 'otro DNI no puede transferir una entrada ajena');

  const transferenciaInvalida = await pedir('POST', '/api/entradas/ENTRY005/transferir', {
    nombre: 'P',
    dni: '123',
    correo: 'no-es-correo',
    precio: 999
  }, { 'X-Usuario-DNI': '43871264' });
  comprobar(transferenciaInvalida.status === 400, 'datos inválidos devuelven 400');
  comprobar(Boolean(transferenciaInvalida.datos.campos), 'los errores indican los campos');

  const transferencia = await pedir('POST', '/api/entradas/ENTRY005/transferir', {
    nombre: 'Pedro Castillo',
    dni: '41234567',
    correo: 'pedro.castillo@demo.pe',
    precio: 50
  }, { 'X-Usuario-DNI': '43871264' });
  comprobar(transferencia.status === 200 && transferencia.datos.ok, 'la transferencia correcta responde 200');
  comprobar(transferencia.datos.titularNuevo === 'Pedro Castillo', 'la transferencia cambia el titular');
  comprobar(transferencia.datos.estado === 'transferido', 'la entrada queda en estado transferido');
  comprobar(Boolean(transferencia.datos.tokenNuevo), 'la transferencia rota el QR');
  comprobar(transferencia.datos.qrPendiente === false, 'el QR no queda pendiente');

  const tokenViejo = await pedir('POST', '/api/qr/validar', { token: qrMaria.datos.token }, { 'X-Usuario-DNI': '43871264' });
  comprobar(tokenViejo.datos.valido === false, 'el token del titular anterior queda invalidado');

  const tokenNuevo = await pedir('POST', '/api/qr/validar', { token: transferencia.datos.tokenNuevo }, { 'X-Usuario-DNI': '41234567' });
  comprobar(tokenNuevo.datos.valido === true, 'el token del nuevo titular es válido');
  comprobar(tokenNuevo.datos.titular === 'Pedro Castillo', 'el token nuevo identifica a Pedro Castillo');

  const entradaPedro = await pedir('GET', '/api/entradas/ENTRY005', undefined, { 'X-Usuario-DNI': '41234567' });
  comprobar(entradaPedro.datos.entrada.titular === 'Pedro Castillo', 'ENTRY005 muestra al nuevo titular');
  comprobar(entradaPedro.datos.entrada.esMia === true, 'ENTRY005 es propia para Pedro');

  const historial = await pedir('GET', '/api/historial?dni=43871264');
  const acciones = (historial.datos.historial || []).map((h) => h.accion);
  comprobar(acciones.includes('transferida'), 'el historial de María conserva la transferencia');
  comprobar(acciones.includes('qr'), 'el historial conserva la rotación del QR');

  // ---------------------------------------------------------------------
  // 7. Reinicio final: dejar la demo limpia
  // ---------------------------------------------------------------------
  const resetFinal = await pedir('POST', '/api/demo/reiniciar', {});
  comprobar(resetFinal.status === 200 && resetFinal.datos.ok, 'el reinicio final responde 200');
  comprobar(resetFinal.datos.entradas === 7, 'el reinicio final deja 7 entradas');
  comprobar(resetFinal.datos.usuarios === 6, 'el reinicio final deja 6 usuarios');
  comprobar(resetFinal.datos.tokens === 0, 'el reinicio final deja 0 tokens');

  const entradaFinal = await pedir('GET', '/api/entradas/ENTRY005', undefined, { 'X-Usuario-DNI': '43871264' });
  comprobar(entradaFinal.datos.entrada.titular === 'María Torres', 'ENTRY005 vuelve a María Torres');
  comprobar(entradaFinal.datos.entrada.estado === 'valido', 'ENTRY005 vuelve a estado válido');

  console.log(`\n${comprobaciones} comprobaciones, ${fallos} fallo(s).\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nLa prueba de humo falló por una excepción:', err);
  process.exit(1);
});
