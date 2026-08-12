# Control de Consumos — V4.2

V4.2 conserva todo lo de V4.1, pero elimina por completo la necesidad de escribir o recordar el OAuth Client ID.

## Cambio principal
El Client ID Web queda incorporado en el código de la app:

`1008229627670-snds8nh12cesb8htda7s38oi73uck9qj.apps.googleusercontent.com`

Un OAuth Client ID web no es una contraseña ni un secreto, por lo que puede estar embebido en una aplicación web.

Ahora el flujo es:

1. Abrís la app.
2. Tocás **Ingresar con mi Gmail**.
3. Google muestra el selector de cuentas.
4. Elegís tu email autorizado.
5. Entrás.

La app ya no muestra campos para escribir el Client ID.

## Mantiene todo lo anterior
- Sesión local persistente.
- Acceso privado mediante Google Test Users.
- Multiusuario.
- Face ID / autenticación del dispositivo opcional.
- Solo UYU.
- USD ignorado.
- Corrección de `4071.0 UYU`.
- Auto-sync.
- Historial, alertas, notificaciones y no duplicados.

## Actualizar
Reemplazá los archivos actuales por los de este ZIP y ejecutá:

git add .
git commit -m "Version 4.2 - login por Gmail"
git push
