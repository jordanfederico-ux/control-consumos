# Control de Consumos — V4.1

V4.1 conserva todo lo de V4 y agrega:

- Sesión local persistente: después del primer login con una cuenta autorizada, la app recuerda qué usuario usa ese dispositivo y no obliga a pasar por Google cada vez que se abre.
- Bloqueo opcional con Face ID / Touch ID / código del dispositivo mediante WebAuthn (autenticador de plataforma).
- Si Face ID está activado, al abrir la PWA aparece una pantalla de desbloqueo antes de mostrar saldo e historial.
- Botón para usar otra cuenta desde la pantalla bloqueada.

## Importante sobre Gmail
La PWA no guarda refresh tokens de Google. El token web de Gmail es temporal.
Por eso:
- entrar a la app ya no requiere login repetido;
- pero si Google necesita emitir un token nuevo para Gmail, puede requerir un toque del usuario en “Buscar nuevos consumos”.

Un backend con Authorization Code Flow sería necesario para renovar Gmail completamente en segundo plano.

## Face ID
En una PWA se usa WebAuthn/passkeys del dispositivo, no la API nativa de Face ID.
iOS puede usar Face ID/Touch ID y, si corresponde, el código del dispositivo como verificación.

## Actualizar
Reemplazá los archivos actuales por estos y ejecutá:

git add .
git commit -m "Version 4.1 - sesion persistente y Face ID"
git push

Después cerrá completamente la PWA y volvé a abrirla.
