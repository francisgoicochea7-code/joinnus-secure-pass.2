FROM node:20-alpine

WORKDIR /app

# Dependencias compartidas por los tres servicios (express, pg, dotenv).
# Se instalan en /app/services/node_modules para que las resuelvan tanto
# services/shared como services/<servicio>/src.
COPY services/package.json ./services/package.json
RUN cd services && npm install --omit=dev --no-audit --no-fund

COPY services/shared ./services/shared
COPY services/auth/src ./services/auth/src
COPY backend/activacion.js ./backend/activacion.js
COPY backend/emitir-activacion.js ./backend/emitir-activacion.js

WORKDIR /app/services/auth
ENV NODE_ENV=production
USER node
EXPOSE 3101

CMD ["node", "src/main.js"]
