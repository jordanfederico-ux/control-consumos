# Control de Consumos — V5.2

BASE EXACTA: V4.2.1 estable.

Se mantuvo intacta la lógica existente de:
- login
- sesión persistente
- Face ID
- OAuth
- Gmail
- app privada
- multiusuario
- solo UYU
- auto-sync
- alertas
- historial
- control de duplicados

Se agregaron únicamente dos funciones:

1. Compras en cuotas
2. Gasto disponible por día

## Cuotas
Tocá un consumo del historial, elegí la cantidad de cuotas y el gasto actual se corrige a Cuota 1/N.
En cada “Borrar historial y empezar desde ahora”, la app carga la siguiente cuota pendiente.

## Gasto diario
Saldo disponible actual / días restantes hasta el 27 inclusive.

## Actualizar
git add .
git commit -m "Version 5.2 - cuotas y gasto diario sobre V4.2.1"
git push
