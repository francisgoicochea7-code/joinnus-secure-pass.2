# =========================================================================
#  JOINNUS SECURE PASS — backend/Dockerfile
#  API REST (Node.js + Express + PostgreSQL)
# =========================================================================
FROM node:20-alpine

LABEL maintainer="Proyecto universitario Joinnus Secure Pass"
LABEL description="API de verificacion, QR dinamico, transferencia e historial"

WORKDIR /app

# 1) Dependencias (capa cacheada). npm ci instala exactamente el lockfile:
#    el mismo commit produce siempre las mismas versiones.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# 2) Codigo fuente de la API
COPY index.js ./
COPY auth.js ./
COPY activacion.js ./
COPY emitir-activacion.js ./

# 3) Variables de entorno por defecto (docker-compose.yml las sobreescribe)
ENV NODE_ENV=production \
    PORT=3000 \
    DB_HOST=postgres \
    DB_PORT=5432 \
    DB_NAME=joinnus_secure_pass \
    QR_TTL_SECONDS=15

# El usuario nobody reduce el impacto de una eventual intrusion
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Sonda de salud: Docker espera a OK antes de publicar el frontend
HEALTHCHECK --interval=10s --timeout=4s --start-period=40s --retries=6 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "index.js"]
