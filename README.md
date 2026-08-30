# Control de Consumos — V5.3 CORREGIDA

BASE EXACTA: V4.2.1 estable.

## Corrección importante
En la V5.2 el JavaScript podía detenerse antes de inicializar el login porque
los controles de cuotas no habían quedado insertados correctamente en el HTML.
Eso hacía que el botón “Ingresar con mi Gmail” no respondiera y que no se
alcanzara el flujo de Face ID.

V5.3 corrige ese problema y además deja los controles nuevos protegidos para
que, aunque faltara algún elemento de cuotas, NUNCA pueda romperse el login.

## Se mantiene de V4.2.1
- sesión persistente
- Face ID / código del iPhone
- login Gmail
- OAuth
- app privada
- multiusuario
- Gmail readonly
- solo UYU
- auto-sync
- alertas
- historial
- consumos ya contabilizados
- IDs de mails procesados

## Se agrega solamente
1. Compras en cuotas.
2. Etiquetas 1/3, 2/3, etc.
3. Arrastre automático de la siguiente cuota al reset.
4. Gasto disponible por día hasta el 27 inclusive.

## Actualización
git add .
git commit -m "Version 5.3 corregida - cuotas y gasto diario"
git push

No borres historial ni datos del iPhone al actualizar.
