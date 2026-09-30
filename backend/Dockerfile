# =========================================================================
#  JOINNUS SECURE PASS — backend/Dockerfile
#  API REST (Node.js + Express + MySQL)
# =========================================================================
FROM node:20-alpine

LABEL maintainer="Proyecto universitario Joinnus Secure Pass"
LABEL description="API de verificacion, QR dinamico, transferencia e historial"

WORKDIR /app

# 1) Dependencias (capa cacheada: solo se reinstalan si cambia package.json)
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# 2) Codigo fuente de la API
COPY index.js ./

# 3) Variables de entorno por defecto (docker-compose.yml las sobreescribe)
ENV NODE_ENV=production \
    PORT=3000 \
    DB_HOST=mysql \
    DB_PORT=3306 \
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
