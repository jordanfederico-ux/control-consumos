# Control de Consumos — V1

Primera versión de una app personal para iPhone que:
- guarda un saldo inicial;
- se conecta a Gmail mediante OAuth;
- busca mails por remitente y asunto;
- extrae importes en UYU aunque el formato tenga pequeñas variaciones;
- guarda el ID único de Gmail para no duplicar consumos;
- muestra saldo, total consumido e historial.

## Importante
Esta V1 usa `gmail.readonly`: la app solo necesita leer los mensajes. No guarda tu contraseña de Google.

## Para conectar tu Gmail
1. Crear un proyecto en Google Cloud.
2. Habilitar Gmail API.
3. Configurar OAuth consent screen como app externa en modo Testing.
4. Agregarte como Test User.
5. Crear un OAuth Client ID de tipo Web application.
6. Agregar como Authorized JavaScript origin la URL donde publiques esta app.
7. Copiar el Client ID en Configuración dentro de la app.

Google puede mostrar una pantalla de "app no verificada" durante el desarrollo. Para uso personal esto es compatible con el régimen de apps personales; el límite relevante es de usuarios, no de correos.

## Publicarla como app en iPhone
La forma más sencilla de esta primera versión es alojarla en HTTPS (por ejemplo, GitHub Pages) y luego usar "Añadir a pantalla de inicio" en Safari. Después podemos convertirla en una app iOS más nativa si queremos.

## Próximo paso
Probar con un correo real de ejemplo y ajustar el parser para las variantes exactas de los avisos del banco.
