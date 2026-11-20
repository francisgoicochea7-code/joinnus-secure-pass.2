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

  // ---------------------------------------------------------------------
  // 1b. Inicio de sesión real (DNI + contraseña → token firmado)
  // ---------------------------------------------------------------------
  const loginCarlos = await pedir('POST', '/api/usuarios/login', { dni: '45678945', password: 'Carlos2026!' });
  comprobar(loginCarlos.status === 200 && Boolean(loginCarlos.datos.token), 'Carlos inicia sesión y recibe un token');
  comprobar(!loginCarlos.datos.usuario.password_hash, 'el login nunca devuelve el hash de la contraseña');
  const authCarlos = { Authorization: 'Bearer ' + loginCarlos.datos.token };

  const loginMaria = await pedir('POST', '/api/usuarios/login', { dni: '43871264', password: 'Maria2026!' });
  comprobar(loginMaria.status === 200 && Boolean(loginMaria.datos.token), 'María inicia sesión y recibe un token');
  const authMaria = { Authorization: 'Bearer ' + loginMaria.datos.token };

  const loginUsuarioMalo = await pedir('POST', '/api/usuarios/login', { dni: '45678945', password: 'incorrecta' });
  comprobar(loginUsuarioMalo.status === 401, 'una contraseña incorrecta devuelve 401');

  const loginInexistente = await pedir('POST', '/api/usuarios/login', { dni: '49999999', password: 'Cualquiera1' });
  comprobar(loginInexistente.status === 401, 'un DNI inexistente también devuelve 401');
  comprobar(loginInexistente.datos.error === loginUsuarioMalo.datos.error,
    'el mensaje es idéntico para DNI y contraseña incorrectos');

  const cabeceraVieja = await pedir('GET', '/api/entradas/ENTRY005', undefined, { 'X-Usuario-DNI': '43871264' });
  comprobar(cabeceraVieja.status === 401,
    'la cabecera X-Usuario-DNI ya no permite hacerse pasar por otra persona');

  const entradaInicial = await pedir('GET', '/api/entradas/ENTRY001', undefined, authCarlos);
  comprobar(entradaInicial.status === 200 && entradaInicial.datos.ok, 'GET /api/entradas/ENTRY001 responde 200');
  comprobar(entradaInicial.datos.entrada.titular === 'Carlos Pérez', 'ENTRY001 pertenece a Carlos Pérez');
  comprobar(entradaInicial.datos.entrada.qrToken === null, 'la semilla no inventa tokens QR');

  // Datos personales: sólo con sesión y sólo los propios.
  const entradasSinSesion = await pedir('GET', '/api/entradas');
  comprobar(entradasSinSesion.status === 401, 'el listado de entradas exige sesión');

  const entradasCarlos = await pedir('GET', '/api/entradas', undefined, authCarlos);
  const codigosCarlos = (entradasCarlos.datos.entradas || []).map((e) => e.codigo).sort();
  comprobar(entradasCarlos.status === 200 && codigosCarlos.length === 2 &&
    codigosCarlos[0] === 'ENTRY001' && codigosCarlos[1] === 'ENTRY006',
    'el listado sólo trae las entradas de Carlos: ' + codigosCarlos.join(','));

  const verificarPublico = await pedir('GET', '/api/verificar/ENTRY001');
  comprobar(verificarPublico.status === 200 && verificarPublico.datos.entrada.estado === 'valido',
    'la verificación pública devuelve el estado');
  comprobar(!('titular' in verificarPublico.datos.entrada) &&
    !('evento' in verificarPublico.datos.entrada) &&
    !('dniOculto' in verificarPublico.datos.entrada),
    'la verificación pública no expone la entrada ni al titular');

  const verificarConSesion = await pedir('GET', '/api/verificar/ENTRY001', undefined, authCarlos);
  comprobar(verificarConSesion.datos.entrada.evento === 'Lima Music Fest' &&
    verificarConSesion.datos.entrada.titular === 'Carlos Pérez',
    'con sesión la verificación muestra la ficha completa');

  const historialSinSesion = await pedir('GET', '/api/historial?dni=43871264');
  comprobar(historialSinSesion.status === 401, 'el historial exige sesión');

  const historialAjeno = await pedir('GET', '/api/historial?dni=45678945', undefined, authMaria);
  comprobar(historialAjeno.status === 403, 'no se puede consultar el historial de otro DNI');

  // ---------------------------------------------------------------------
  // 2. QR propio y ajeno
  // ---------------------------------------------------------------------
  const qrSinSesion = await pedir('POST', '/api/entradas/ENTRY001/qr', {});
  comprobar(qrSinSesion.status === 401, 'la emisión de QR requiere sesión');

  const qr = await pedir('POST', '/api/entradas/ENTRY001/qr', {}, authCarlos);
  comprobar(qr.status === 200 && qr.datos.ok, 'POST /api/entradas/ENTRY001/qr responde 200');
  comprobar(Boolean(qr.datos.token), 'el QR trae token');
  comprobar(Boolean(qr.datos.payload), 'el QR trae payload');
  comprobar(qr.datos.entrada.qrToken === qr.datos.token, 'la entrada devuelta trae el token vigente');
  comprobar(qr.datos.entrada.esMia === true, 'la entrada se marca como propia del titular');

  const qrAjeno = await pedir('POST', '/api/entradas/ENTRY005/qr', {}, authCarlos);
  comprobar(qrAjeno.status === 403 && qrAjeno.datos.motivo === 'no-es-tuya', 'otro DNI no puede generar el QR ajeno');

  const validar = await pedir('POST', '/api/qr/validar', { token: qr.datos.token });
  comprobar(validar.status === 200 && validar.datos.valido === true, 'el token recién generado es válido');
  comprobar(validar.datos.titular === 'Carlos Pérez', 'la validación identifica al titular');

  const validarMalo = await pedir('POST', '/api/qr/validar', { token: 'JSP-ENTRY001-00000000' });
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
  const anularSinSesion = await pedir('POST', '/api/entradas/ENTRY001/estado/anulado', {});
  comprobar(anularSinSesion.status === 401, 'un invitado no puede cambiar el estado');

  const anularAjena = await pedir('POST', '/api/entradas/ENTRY001/estado/anulado', {}, authMaria);
  comprobar(anularAjena.status === 403, 'otra cuenta no puede cambiar el estado');

  const anular = await pedir('POST', '/api/entradas/ENTRY001/estado/anulado', {}, authCarlos);
  comprobar(anular.status === 200 && anular.datos.entrada.estado === 'anulado', 'se puede anular una entrada');
  comprobar(anular.datos.entrada.qrToken === null, 'al anular se limpia la proyección del QR');

  const reactivar = await pedir('POST', '/api/entradas/ENTRY001/estado/valido', {}, authCarlos);
  comprobar(reactivar.status === 200 && reactivar.datos.entrada.estado === 'valido', 'se puede reactivar una entrada');
  comprobar(reactivar.datos.entrada.qrToken === null, 'al reactivar se pide un QR nuevo');

  const usadoDirecto = await pedir('POST', '/api/entradas/ENTRY001/estado/usado', {}, authCarlos);
  comprobar(usadoDirecto.status === 403, 'el titular no puede marcar usado sin encargado');

  // ---------------------------------------------------------------------
  // 5. Usuarios
  // ---------------------------------------------------------------------
  const nuevo = await pedir('POST', '/api/usuarios', {
    nombre: 'Lucía Ramos',
    dni: '40000001',
    correo: 'lucia.ramos@demo.pe',
    password: 'Lucia2026!'
  });
  comprobar(nuevo.status === 201 && nuevo.datos.ok, 'se registra un usuario nuevo con contraseña');
  comprobar(nuevo.datos.usuario.dni === '40000001', 'el usuario devuelve su DNI');

  const nuevoSinClave = await pedir('POST', '/api/usuarios', {
    nombre: 'Sin Clave',
    dni: '40000002',
    correo: 'sin.clave@demo.pe'
  });
  comprobar(nuevoSinClave.status === 400, 'el registro sin contraseña se rechaza');

  const loginLucia = await pedir('POST', '/api/usuarios/login', { dni: '40000001', password: 'Lucia2026!' });
  comprobar(loginLucia.status === 200 && Boolean(loginLucia.datos.token), 'la cuenta recién creada puede iniciar sesión');

  const duplicado = await pedir('POST', '/api/usuarios', {
    nombre: 'Lucía Ramos',
    dni: '40000001',
    correo: 'lucia.ramos@demo.pe',
    password: 'Lucia2026!'
  });
  comprobar(duplicado.status === 409, 'un DNI duplicado devuelve 409');

  const authLucia = { Authorization: 'Bearer ' + loginLucia.datos.token };
  const buscar = await pedir('GET', '/api/usuarios/40000001', undefined, authLucia);
  comprobar(buscar.status === 200 && buscar.datos.usuario.nombre === 'Lucía Ramos', 'la titular puede consultar su perfil');

  const perfilInvitado = await pedir('GET', '/api/usuarios/40000001');
  comprobar(perfilInvitado.status === 401 && !perfilInvitado.datos.usuario, 'el perfil requiere sesión');
  const perfilAjeno = await pedir('GET', '/api/usuarios/40000001', undefined, authCarlos);
  comprobar(perfilAjeno.status === 403 && !perfilAjeno.datos.usuario, 'otra cuenta no puede leer el perfil');

  // ---------------------------------------------------------------------
  // 6. Transferencia con rotación de QR
  // ---------------------------------------------------------------------
  const qrMaria = await pedir('POST', '/api/entradas/ENTRY005/qr', {}, authMaria);
  comprobar(qrMaria.status === 200 && Boolean(qrMaria.datos.token), 'María genera el QR de ENTRY005');

  const transferenciaAjena = await pedir('POST', '/api/entradas/ENTRY005/transferir', {
    nombre: 'Pedro Castillo',
    dni: '41234567',
    correo: 'pedro.castillo@demo.pe',
    precio: 50
  }, authCarlos);
  comprobar(transferenciaAjena.status === 403, 'otro DNI no puede transferir una entrada ajena');

  const transferenciaInvalida = await pedir('POST', '/api/entradas/ENTRY005/transferir', {
    nombre: 'P',
    dni: '123',
    correo: 'no-es-correo',
    precio: 999
  }, authMaria);
  comprobar(transferenciaInvalida.status === 400, 'datos inválidos devuelven 400');
  comprobar(Boolean(transferenciaInvalida.datos.campos), 'los errores indican los campos');

  const transferencia = await pedir('POST', '/api/entradas/ENTRY005/transferir', {
    nombre: 'Pedro Castillo',
    dni: '41234567',
    correo: 'pedro.castillo@demo.pe',
    precio: 50
  }, authMaria);
  comprobar(transferencia.status === 200 && transferencia.datos.ok, 'la transferencia correcta responde 200');
  comprobar(transferencia.datos.titularNuevo === 'Pedro Castillo', 'la transferencia cambia el titular');
  comprobar(transferencia.datos.estado === 'transferido', 'la entrada queda en estado transferido');
  comprobar(!transferencia.datos.tokenNuevo && !transferencia.datos.payload && !transferencia.datos.entrada.qrToken,
    'el remitente no recibe el QR del destinatario');
  comprobar(transferencia.datos.qrPendiente === false, 'el QR no queda pendiente');

  const tokenViejo = await pedir('POST', '/api/qr/validar', { token: qrMaria.datos.token });
  comprobar(tokenViejo.datos.valido === false, 'el token del titular anterior queda invalidado');

  // El destinatario necesita activar su cuenta antes de pedir un QR propio.
  const loginPendiente = await pedir('POST', '/api/usuarios/login', { dni: '41234567', password: 'ClaveDePrueba1' });
  comprobar(loginPendiente.status === 401, 'una cuenta pendiente requiere activación');
  const entradaPedro = await pedir('GET', '/api/entradas/ENTRY005', undefined, authMaria);
  comprobar(entradaPedro.datos.entrada.esMia === false, 'ENTRY005 ya no es propia para María');
  comprobar(entradaPedro.datos.entrada.titular === null &&
    entradaPedro.datos.entrada.dniOculto === null,
    'una entrada ajena no expone el nombre ni el DNI del titular');

  const entradaPedroCabecera = await pedir('GET', '/api/entradas/ENTRY005', undefined, { 'X-Usuario-DNI': '41234567' });
  comprobar(entradaPedroCabecera.status === 401,
    'escribir el DNI del nuevo titular en la cabecera no da acceso');

  const historial = await pedir('GET', '/api/historial?dni=43871264', undefined, authMaria);
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

  const entradaFinal = await pedir('GET', '/api/entradas/ENTRY005', undefined, authMaria);
  comprobar(entradaFinal.datos.entrada.titular === 'María Torres', 'ENTRY005 vuelve a María Torres');
  comprobar(entradaFinal.datos.entrada.estado === 'valido', 'ENTRY005 vuelve a estado válido');

  console.log(`\n${comprobaciones} comprobaciones, ${fallos} fallo(s).\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nLa prueba de humo falló por una excepción:', err);
  process.exit(1);
});
