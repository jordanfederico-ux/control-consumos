# Control de Consumos — V3.1

Esta versión conserva **todo lo de V3** y corrige el parser de importes.

## Cambios de V3.1

### 1. Solo consumos en UYU
La app ahora agrega un movimiento únicamente cuando el importe del mail está seguido explícitamente por `UYU`.

Ejemplos:
- `Importe: 4071.0 UYU` ✅
- `Importe: 4.071,50 UYU` ✅
- `Importe: 120 USD` ❌ se ignora
- cualquier otra moneda ❌ se ignora

### 2. Corrección de separadores
El parser distingue entre decimal y miles:

- `4071.0 UYU` → `4071,00 UYU`
- `4071.00 UYU` → `4071,00 UYU`
- `4.071 UYU` → `4071,00 UYU`
- `4.071,50 UYU` → `4071,50 UYU`
- `4071,5 UYU` → `4071,50 UYU`

## Mantiene todo lo anterior
- Sincronización automática al abrir.
- Botón manual de actualización.
- Última actualización.
- Prevención persistente de duplicados por Gmail ID.
- “Borrar historial y empezar desde ahora”.
- Alertas de saldo bajo.
- Notificaciones PWA.
- Filtro por remitente y asunto.
- Extracción del comercio.
- Configuración guardada localmente.

## Actualizar GitHub
Reemplazá los archivos actuales por los de este ZIP y ejecutá:

git add .
git commit -m "Version 3.1 - UYU y correccion de importes"
git push

El service worker fue versionado nuevamente para forzar la actualización del código en la PWA.
