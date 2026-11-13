# 004 — Plan

1. Revisar recursos, scripts y estilos actuales.
2. Servir fuente variable TTF oficial y licencia desde `frontend/assets/fonts/`.
3. Centralizar cabeceras en un snippet Nginx incluido en cada location con
   `add_header` propio (Nginx no hereda las cabeceras en ese caso).
4. CSP estricta en scripts; los estilos inline existentes se limitan a
   atributos con `style-src-attr`, dejando `style-src` y `style-src-elem` en
   `'self'`. Añadir HSTS para hosts públicos, omitiéndolo en localhost, y
   cabeceras COEP/COOP/CORP. No confundir presencia de CSP con protección
   completa.
5. Añadir configuración HTTPS opcional en puerto 8443, certificados locales
   fuera de Git y redirección desde 8081. Healthcheck por HTTPS en ese modo.
6. Pruebas de regresión de configuración; suite completa y comprobaciones
   reales si el entorno lo permite. Nuevo ZAP separado de otras aplicaciones.
