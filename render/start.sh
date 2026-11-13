#!/bin/sh
# =========================================================================
#  Arranque del contenedor publicado en Render.
#
#  1. Prepara la base administrada (crea las 3 bases y carga el esquema).
#  2. Genera la configuración de Nginx con el puerto que asigna Render.
#  3. Levanta auth, tickets y qr en puertos internos fijos y espera su /ready.
#  4. Deja Nginx al frente y vigila que ningún proceso muera.
# =========================================================================
set -eu

log() {
    echo "[render] $*"
}

# Render publica la aplicación en el puerto de la variable PORT (10000 por
# defecto). Nginx es el único que lo escucha.
export PORT="${PORT:-10000}"
export TZ="${TZ:-America/Lima}"
export NODE_ENV="${NODE_ENV:-production}"
export DB_POOL_MAX="${DB_POOL_MAX:-3}"

# -------------------------------------------------------------------------
# 1) Base de datos
# -------------------------------------------------------------------------
if [ "${SEED_ON_START:-true}" = "true" ]; then
    log "preparando la base de datos"
    if ! node /app/services/scripts/init-render-db.js; then
        # No se aborta: si la base estaba lista, los servicios igual arrancan
        # y el error queda visible en el log de Render.
        log "aviso: la preparación de la base falló; se continúa con el arranque"
    fi
else
    log "SEED_ON_START=false: se omite la preparación de la base"
fi

# -------------------------------------------------------------------------
# 2) Gateway
# -------------------------------------------------------------------------
mkdir -p /app/render/conf
envsubst '${PORT}' < /app/render/gateway.conf.template > /app/render/conf/default.conf

# -------------------------------------------------------------------------
# 3) Microservicios (puertos internos fijos, nunca $PORT)
# -------------------------------------------------------------------------
PORT=3101 SEED_SQL=/app/seed/auth.sql    node /app/services/auth/src/main.js    &
PID_AUTH=$!
PORT=3102 SEED_SQL=/app/seed/tickets.sql node /app/services/tickets/src/main.js &
PID_TICKETS=$!
PORT=3103                                node /app/services/qr/src/main.js       &
PID_QR=$!

esperar() {
    url="$1"
    nombre="$2"
    intento=0
    while [ "$intento" -lt 40 ]; do
        if wget -q -O /dev/null "$url" 2>/dev/null; then
            log "$nombre listo"
            return 0
        fi
        intento=$((intento + 1))
        sleep 2
    done
    log "aviso: $nombre no respondió a tiempo"
    return 1
}

esperar "http://127.0.0.1:3101/ready" auth || true
esperar "http://127.0.0.1:3102/ready" tickets || true
esperar "http://127.0.0.1:3103/ready" qr || true

# -------------------------------------------------------------------------
# 4) Nginx al frente
# -------------------------------------------------------------------------
nginx -c /etc/nginx/nginx.conf -g 'daemon off;' &
PID_NGINX=$!

apagar() {
    codigo="${1:-0}"
    log "deteniendo servicios"
    kill -TERM "$PID_AUTH" "$PID_TICKETS" "$PID_QR" "$PID_NGINX" 2>/dev/null || true
    wait 2>/dev/null || true
    exit "$codigo"
}

trap 'apagar 0' INT TERM

while true; do
    for pid in "$PID_AUTH" "$PID_TICKETS" "$PID_QR" "$PID_NGINX"; do
        if ! kill -0 "$pid" 2>/dev/null; then
            log "un proceso terminó (pid $pid): se reinicia el contenedor"
            apagar 1
        fi
    done
    sleep 5
done
