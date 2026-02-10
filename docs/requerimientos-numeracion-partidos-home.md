# Requerimiento: Numeración global de partidos (Home Único)

## Problema observado
En el Home Único, los partidos del jugador no muestran (o no respetan) la numeración del estilo **3, 9, 15, 20**, que es la numeración que el usuario ve y entiende desde el **fixture**.

Esto rompe el modelo mental operativo:
- el jugador se guía por “me toca el #X” y por cuántas canchas deben liberarse para llegar a ese #.

---

## Objetivo
Garantizar que el **número de orden del partido** sea:
- **Único en todo el sistema** (no por jugador, no por grupo).
- **Consistente** entre `fixture.html` y el Home Único.
- **Reutilizado** desde la lógica existente (no reinventado).

---

## Definición de “número de partido”
El “número” al que nos referimos es la **posición global** del partido en la **cola sugerida de pendientes** del fixture:
- En la vista de cola del fixture, se renderiza como `posicion: i + 1` (donde `i` es el índice en la cola global).
- Ese número es **global** (1..N para todo el torneo) y **no debe recalcularse con otra regla** en el Home.

> Nota: esta numeración es dinámica (puede cambiar cuando partidos dejan de ser pendientes). Aun así, el Home debe reflejar **exactamente la misma** numeración que el fixture en el mismo instante.

---

## Fuente de verdad (reutilizar, no duplicar)
La numeración global ya se calcula en `src/fixture.js` a partir de:
- `calcularColaSugerida(partidos, grupos)` (arma el orden global de pendientes)
- predicados de estado:
  - `esPartidoPendiente(partido)`
  - `esPartidoFinalizado(partido)`
  - `esPartidoYaJugado(partido)`

Dentro de `renderColaFixture(...)`, la numeración se asigna así:
- `cola.forEach((p, i) => renderColaItem(p, ..., { posicion: i + 1, ... }))`

**Requerimiento**: el Home Único debe tomar esta misma cola (o una función compartida equivalente) como **fuente de verdad** para el número global.

---

## Reglas funcionales para el Home Único

### R1 — El Home debe mostrar el número global del fixture
En cada tarjeta de “Mis partidos pendientes”:
- Mostrar el **número global** del partido (ej. `#3`) obtenido desde la cola sugerida global.

### R2 — No se renumera por jugador
Si el jugador tiene 4 partidos pendientes:
- NO se muestran como `#1, #2, #3, #4`.
- Se muestran con sus números globales reales (ej. `#3, #9, #15, #20`).

### R3 — Orden visual coherente
La lista “Mis partidos pendientes” debe estar ordenada por:
- número global ascendente (posición en cola global)

### R4 — Partidos no-pendientes
Si un partido ya no está pendiente (por resultado o estado):
- puede aparecer en “Jugados” o en otra sección,
- pero no debe “inventar” número; si se muestra un número, debe ser el mismo criterio (derivado de la cola correspondiente a la vista/estado).

---

## Recomendación de diseño técnico (sin implementar acá)
Para evitar duplicación:
- Extraer la lógica de orden/numeración a un módulo compartido (por ejemplo `src/utils/ordenFixture.js`) **o**
- Reutilizar el mismo método exportado/compartido sin copiar-pegar.

El Home debería:
1) calcular `colaGlobal = calcularColaSugerida(partidos, grupos)`
2) crear `mapIdAPosicion = Map(partido.id -> index+1)`
3) al renderizar un partido del jugador, leer `posicion = mapIdAPosicion.get(partido.id)`

Si `posicion` no existe (no está en la cola por estado raro):
- mostrar `—` o “Sin número” (mejor que inventar uno).

---

## Criterios de aceptación
- Al abrir `fixture.html` (cola) y el Home Único simultáneamente, el mismo partido tiene el **mismo número** en ambas vistas.
- Un jugador ve sus partidos con números globales (ej. `#3, #9, #15...`) y en el mismo orden.
- No existe una segunda lógica de numeración “propia del Home”.

---

## Prompt para el chat de implementación (copiar/pegar)

"""
Necesito corregir el Home Único para que muestre la **numeración global** de partidos igual al fixture.

Requerimiento:
- El número del partido debe ser **único global** (1..N para todo el torneo) y debe ser el mismo que muestra `fixture.html` en la vista de cola.
- NO renumerar por jugador.
- Ordenar “Mis partidos pendientes” por ese número global.

Fuente de verdad existente:
- `src/fixture.js`: `calcularColaSugerida(...)` y el `posicion: i + 1` que se muestra en la cola.

Acción:
Reutilizar esa lógica (ideal: extraer a util compartido) y en el Home mapear `partido.id -> posicionGlobal`.
Si un partido no tiene posición calculable, mostrar ‘—’ (no inventar).

Entrega:
- Cambios implementados.
- Validación: comparar un partido en fixture vs home y confirmar que el número coincide.
"""

