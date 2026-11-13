# =========================================================================
#  JOINNUS SECURE PASS — Dockerfile (raiz)
#  Contenedor del FRONTEND: nginx serve los archivos estaticos y hace
#  de proxy inverso hacia la API (/api -> backend:3000).
#
#  Se construye con el contexto de la raiz del proyecto:
#      docker build -f Dockerfile -t joinnus-secure-pass-frontend .
# =========================================================================
FROM nginx:1.27-alpine

LABEL maintainer="Proyecto universitario Joinnus Secure Pass"
LABEL description="Frontend estatico de Joinnus Secure Pass sobre nginx"

# Se reemplaza la configuracion por defecto de nginx
RUN rm -f /etc/nginx/conf.d/default.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/security-headers.conf /etc/nginx/security-headers.conf
COPY frontend/site.conf /etc/nginx/site.conf
COPY frontend/hsts-map.conf /etc/nginx/conf.d/00-hsts-map.conf

# Sitio estatico
COPY frontend/ /usr/share/nginx/html/

# Expone el puerto por defecto de nginx
EXPOSE 80

HEALTHCHECK --interval=10s --timeout=4s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
