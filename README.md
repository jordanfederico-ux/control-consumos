# Control de Consumos — V4.2.1

Corrige el OAuth de V4.2.

- Client ID Web fijo: `1008229627670-snds8nh12cesb8htda7s38oi73uck9qj.apps.googleusercontent.com`
- Login con **Ingresar con mi Gmail**
- La identidad del usuario se obtiene con Gmail API `users/me/profile`
- Se usa únicamente `gmail.readonly`
- Mantiene sesión local, multiusuario, App Privada, Face ID, UYU-only, auto-sync, historial, alertas y no duplicados.

## Actualizar

git add .
git commit -m "Version 4.2.1 - correccion OAuth"
git push
