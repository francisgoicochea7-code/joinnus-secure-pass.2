# Certificado de DESARROLLO: no modifica el almacén de confianza de Windows.
# Para confianza de navegador usar mkcert (instrucciones en docs/ZAP-MEJORAS.md).
$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
$carpeta = Join-Path $raiz '.certs'
$cert = Join-Path $carpeta 'localhost.pem'
$clave = Join-Path $carpeta 'localhost-key.pem'
if ((Test-Path $cert) -or (Test-Path $clave)) {
    throw 'Ya existen certificados. No se sobrescriben; revisa .certs antes de continuar.'
}
$comando = Get-Command openssl -ErrorAction SilentlyContinue
$openssl = if ($comando) { $comando.Source } else { 'C:\Program Files\Git\usr\bin\openssl.exe' }
if (-not (Test-Path $openssl)) { throw 'Instala OpenSSL o genera los certificados con mkcert.' }
New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
$anterior = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& $openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 30 `
    -keyout $clave -out $cert -subj '/CN=localhost' `
    -addext 'subjectAltName=DNS:localhost,DNS:host.docker.internal,IP:127.0.0.1' `
    -addext 'extendedKeyUsage=serverAuth' 2>&1 | Out-Null
$codigo = $LASTEXITCODE
$ErrorActionPreference = $anterior
if ($codigo -ne 0) { throw 'No se pudo generar el certificado local.' }
Write-Output 'Certificado local creado por 30 días. No es de confianza automáticamente.'
Write-Output 'No uses esta clave ni este certificado en producción.'
