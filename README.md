# Control de Consumos — V5.1

BASE: V4.2.1 estable + cuotas de V5.0.

V5.1 agrega únicamente el bloque de **gasto disponible por día**.

## Gasto diario
La tarjeta cierra el 27 de cada mes.
El período se considera del 28 al 27 inclusive.

La app calcula:
`saldo disponible actual / días restantes hasta el 27 inclusive`

El valor se actualiza automáticamente:
- cuando entra un consumo;
- cuando una compra se convierte en cuotas;
- cuando se cargan cuotas pendientes al reset;
- cuando cambia el saldo;
- cuando cambia el día.

## Cuotas
Se mantiene exactamente la lógica de V5.0:
- tocar un gasto;
- elegir cantidad de cuotas;
- corregir el período actual a Cuota 1/N;
- cargar Cuota 2/N, 3/N, etc. en resets posteriores.

## Mantiene todo lo demás de V4.2.1
- Gmail
- OAuth
- Face ID
- App privada
- Multiusuario
- Sesión persistente
- Solo UYU
- USD ignorado
- Auto-sync
- Historial
- Alertas
- Notificaciones
- No duplicados

## Actualizar
git add .
git commit -m "Version 5.1 - cuotas y gasto diario"
git push
