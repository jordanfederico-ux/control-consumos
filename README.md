# Control de Consumos — V3.2

V3.2 conserva todo lo de V3.1 y corrige el problema de historial anterior.

## Cambios

- Al actualizar desde una versión anterior, V3.2 limpia **una sola vez** el historial viejo/importado.
- Conserva la configuración: remitente, asunto, Client ID, saldo inicial, alerta y auto-sync.
- Al guardar configuración por primera vez después de la limpieza, fija el inicio del seguimiento en ese instante.
- El botón **“Borrar historial y empezar desde ahora”** ya no depende de un `confirm()` del navegador:
  borra directamente el historial y reinicia el seguimiento.
- Sigue evitando duplicados por Gmail ID.
- Mantiene auto-sync al abrir, botón manual, última actualización, alertas, notificaciones y filtro UYU-only.
- Mantiene la corrección de importes como `4071.0 UYU` → `4071,00`.

## Actualización

Reemplazá los archivos actuales por los de este ZIP y ejecutá:

git add .
git commit -m "Version 3.2 - reset de historial"
git push

Después de que GitHub Pages actualice, cerrá completamente la PWA y volvé a abrirla.
V3.2 mostrará saldo/historial en cero una vez, manteniendo tus datos de configuración.
