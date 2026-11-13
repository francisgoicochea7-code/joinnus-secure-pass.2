# =========================================================================
#  Gateway de microservicios — nginx:stable-alpine3.24-slim
#  Se construye con el contexto de la raíz del proyecto:
#      docker build -f services/gateway/Dockerfile -t joinnus-micro-gateway .
#
#  Corre como usuario "nginx" (no root) y escucha en 8080/8443. Docker
#  Desktop publica esos puertos como 8082/8444.
# =========================================================================
FROM nginx:stable-alpine3.24-slim

LABEL maintainer="Proyecto universitario Joinnus Secure Pass"
LABEL description="Gateway Nginx para la arquitectura de microservicios"

RUN rm -f /etc/nginx/conf.d/default.conf

COPY services/gateway/nginx-main.conf  /etc/nginx/nginx.conf
COPY services/gateway/nginx.conf       /etc/nginx/conf.d/default.conf
COPY services/gateway/api-common.conf  /etc/nginx/api-common.conf
COPY frontend/security-headers.conf    /etc/nginx/security-headers.conf
COPY frontend/hsts-map.conf            /etc/nginx/conf.d/00-hsts-map.conf

# Sitio estático. Se eliminan los .conf para no servirlos como archivos.
COPY frontend/ /usr/share/nginx/html/
RUN rm -f /usr/share/nginx/html/*.conf

# El entrypoint de la imagen base intenta modificar configuraciones como
# root. Al ejecutar como "nginx" no hace falta: la configuración ya está
# completa y los certificados se montan en /etc/nginx/certs.
USER nginx

EXPOSE 8080 8443

HEALTHCHECK --interval=10s --timeout=4s --start-period=5s --retries=3 \
  CMD wget --no-check-certificate -q -O /dev/null https://127.0.0.1:8443/api/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
