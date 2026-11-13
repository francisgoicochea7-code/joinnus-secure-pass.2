FROM node:20-alpine

WORKDIR /app

# Dependencias compartidas por los tres servicios (express, pg, dotenv).
# Se instalan en /app/services/node_modules para que las resuelvan tanto
# services/shared como services/<servicio>/src.
COPY services/package.json ./services/package.json
RUN cd services && npm install --omit=dev --no-audit --no-fund

COPY services/shared ./services/shared
COPY services/qr/src ./services/qr/src

WORKDIR /app/services/qr
ENV NODE_ENV=production
USER node
EXPOSE 3103

CMD ["node", "src/main.js"]
