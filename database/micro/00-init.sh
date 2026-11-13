#!/bin/sh
# =========================================================================
#  JOINNUS SECURE PASS — inicialización de las tres bases de microservicios
#  Se ejecuta solo la primera vez que arranca el contenedor PostgreSQL.
# =========================================================================
set -e

: "${AUTH_DB_PASSWORD:?Falta AUTH_DB_PASSWORD}"
: "${TICKETS_DB_PASSWORD:?Falta TICKETS_DB_PASSWORD}"
: "${QR_DB_PASSWORD:?Falta QR_DB_PASSWORD}"

crear_rol() {
  rol="$1"
  pass="$2"
  existe=$(psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$rol'" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB")
  if [ "$existe" != "1" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
      -c "CREATE ROLE $rol LOGIN PASSWORD '$pass';"
  fi
}

crear_base() {
  base="$1"
  dueno="$2"
  existe=$(psql -tAc "SELECT 1 FROM pg_database WHERE datname='$base'" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB")
  if [ "$existe" != "1" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
      -c "CREATE DATABASE $base OWNER $dueno;"
  fi
}

crear_rol auth_user "$AUTH_DB_PASSWORD"
crear_rol tickets_user "$TICKETS_DB_PASSWORD"
crear_rol qr_user "$QR_DB_PASSWORD"

crear_base auth_db auth_user
crear_base tickets_db tickets_user
crear_base qr_db qr_user

psql -v ON_ERROR_STOP=1 --username auth_user --dbname auth_db -f /scripts/auth.sql
psql -v ON_ERROR_STOP=1 --username tickets_user --dbname tickets_db -f /scripts/tickets.sql
psql -v ON_ERROR_STOP=1 --username qr_user --dbname qr_db -f /scripts/qr.sql

echo "[micro] Bases auth_db, tickets_db y qr_db inicializadas."
