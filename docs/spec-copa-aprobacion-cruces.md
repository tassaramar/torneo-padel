# Requerimiento Funcional: Aprobación de copas con visibilidad y control de cruces

**Estado**: APROBADA POR OWNER (2026-03-09)
**Spec técnica**: `docs/spec-copa-aprobacion-cruces-tecnico.md`
**Fecha**: 2026-03-09
**Ítems del backlog que resuelve**:
- [BUG] Swap (⇄) — no permite mover equipos entre matches
- [MEJORA] Seeding global — evitar cruces entre equipos del mismo grupo
- [MEJORA] Admin copas — tabla general visible antes de aprobar (modo global)
- Propuestas progresivas de copas (sin esperar todos los grupos)

**Fuera de scope (v2 / backlog separado)**:
- Forzar equipo manualmente antes de que termine un grupo
- Cambiar cantidad de equipos por copa
- Copas con cantidad de equipos no potencia de 2 (byes)
- Resolución detallada de empates dentro de grupos (ítem separado en backlog)

---

## Problema

Cuando los grupos terminan y el sistema genera las propuestas de copa, el admin tiene que aprobarlas o rechazarlas "a ciegas":

- No ve si hay empates que afectan quién clasificó
- No ve si los cruces enfrentan equipos que ya jugaron entre sí en el grupo
- No puede cambiar qué equipo juega contra quién
- Tiene que esperar a que terminen todos los grupos, aunque ya tenga equipos suficientes para arrancar un partido

En un torneo rápido entre amigos (2-3 horas, formato definido el mismo día), el admin necesita tomar decisiones rápidas basadas en contexto que la app no conoce: cansancio de los jugadores, horarios, ánimo general. La app tiene que darle la información para decidir y las herramientas para ejecutar su decisión.

---

## Solución

Rediseñar el flujo de aprobación de copas con tres capacidades nuevas:
1. **Visibilidad** — el admin ve quiénes clasificaron, con empates y contexto
2. **Control** — el admin puede editar cruces libremente
3. **Propuestas progresivas** — el sistema va armando propuestas a medida que los grupos terminan

---

## Decisión 1 — "¿Quiénes entran a cada copa?"

### Qué ve el admin

Cuando las propuestas están listas, el admin ve para cada copa una lista de equipos clasificados con contexto:

```
Copa Oro — 4 equipos

  ✅ 1°  Tincho-Max    6 pts  DS +4   (Grupo A, 1°)
  ✅ 2°  Nico-Fede     6 pts  DS +3   (Grupo B, 1°)
  ✅ 3°  Ana-Lu        4 pts  DS +1   (Grupo A, 2°)
  ✅ 4°  Sofi-Caro     4 pts  DS +1   (Grupo B, 2°)  ⚠️ empate con 5°
  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
  ❌ 5°  Pedro-Juan    4 pts  DS +1   (Grupo A, 3°)  ⚠️ empate con 4°
```

### Reglas de visualización

- Siempre mostrar los equipos clasificados (✅) con: posición, nombre, puntos, diferencia de sets, grupo de origen y posición en el grupo
- Mostrar equipos en "zona gris" (❌) solo cuando hay empate con el último clasificado. La zona gris incluye a todos los equipos empatados con el último que entró
- Marcar empates con ⚠️ indicando con quién empatan
- Si no hay empates en la frontera, no se muestra zona gris — el admin ve solo los clasificados y confirma rápido

### Qué puede hacer el admin

- **Confirmar clasificados**: si está de acuerdo, avanza a Decisión 2
- **Intercambiar**: puede sacar un equipo clasificado y meter uno de la zona gris. El intercambio es 1:1 — la cantidad de equipos por copa no cambia

### Empates dentro de grupos

Si el seeding es "por posición de grupo" y el sistema detecta empates relevantes dentro de un grupo (empate a 3 que afecta quién clasifica a qué copa), se muestra un aviso:

```
⚠️ Empate a 3 en Grupo A (posiciones 1°-3°) — revisá la tabla en el tab Grupos antes de confirmar
```

El admin puede ir al tab Grupos, reordenar manualmente si lo necesita, y volver. La resolución detallada de empates de grupo queda fuera de scope (ítem separado en el backlog).

---

## Decisión 2 — "¿Contra quién juegan?"

### Qué ve el admin

Una vez confirmados los clasificados, ve los cruces sugeridos por el algoritmo con contexto:

```
Copa Oro — Cruces

  Semi 1:  Tincho-Max (Gr.A)  vs  Sofi-Caro (Gr.B)
  Semi 2:  Nico-Fede  (Gr.B)  vs  Ana-Lu    (Gr.A)  ⚠️ ya jugaron en grupo

  [Editar cruces]   [Aprobar]
```

### Warnings automáticos

- **Mismo grupo**: si dos equipos del mismo grupo se enfrentan, mostrar "⚠️ ya jugaron en grupo"
- Los warnings son informativos — no bloquean. El admin puede aprobar igual si decide que está bien

### Editar cruces

Si el admin toca "Editar cruces", cada slot se convierte en un selector:

```
Semi 1:  [Tincho-Max ▼]  vs  [Sofi-Caro ▼]
Semi 2:  [Nico-Fede  ▼]  vs  [Ana-Lu     ▼]

  [Guardar cruces]   [Volver a sugeridos]
```

- Cada selector muestra los equipos clasificados para esa copa
- Al asignar un equipo a un slot, se remueve automáticamente del slot donde estaba (no puede estar en dos partidos)
- Los warnings se recalculan en tiempo real al mover equipos
- "Volver a sugeridos" descarta los cambios y restaura la propuesta original del algoritmo

### Decisión 1 como contexto (sin click extra)

Cuando no hay empates ni zona gris, la Decisión 1 (clasificados) se muestra siempre como información contextual arriba de los cruces, pero sin requerir un click de "Confirmar". El admin ve de un vistazo quiénes entraron y pasa directo a evaluar los cruces. Solo cuando hay empates o zona gris aparece la acción de intercambiar.

### Aprobar

Al aprobar, se crean los partidos de copa. Esto es irreversible desde esta pantalla (el admin puede usar Reset como workaround si se equivoca).

---

## Propuestas progresivas — "El sistema va armando a medida que los grupos terminan"

### Principio fundamental

Las propuestas de copa no esperan a que terminen todos los grupos. **Cada vez que un grupo finaliza, el sistema recalcula los cruces óptimos con la información disponible en ese momento.** La propuesta siempre refleja el mejor seeding posible dado lo que se sabe. Solo los partidos ya aprobados por el admin son firmes y se respetan en los recálculos siguientes.

### Seeding "por posición de grupo"

Cada grupo aporta equipos de forma independiente, por lo que las propuestas se van completando progresivamente.

**Momento 1 — Solo Grupo A terminó:**

```
Copa Oro (4 equipos — 1 definido)

  ✅ Tincho-Max   (Gr.A 1°)
  ⏳ Esperando Grupo B...
  ⏳ Esperando Grupo C...

  No hay partidos armables todavía.
```

**Momento 2 — Grupos A y B terminaron, C jugando:**

```
Copa Oro (4 equipos — 3 definidos)

  ✅ Tincho-Max   (Gr.A 1°)
  ✅ Nico-Fede    (Gr.B 1°)
  ✅ Ana-Lu       (Gr.A 2°)
  ⏳ Esperando Grupo C...

  Semi 1:  Tincho-Max  vs  [⏳ pendiente]
  Semi 2:  Nico-Fede   vs  Ana-Lu              [Aprobar Semi 2]
```

El admin puede aprobar la Semi 2 si quiere arrancar, o esperar.

**Momento 3 — Todos los grupos terminaron (admin NO aprobó nada antes):**

El sistema recalcula los cruces con los 4 equipos definidos. Ahora que tiene la información completa, genera el seeding óptimo (mejor 1° vs peor 1°). Los cruces pueden ser distintos a los del Momento 2 porque el sistema ahora tiene más información:

```
Copa Oro (4 equipos — todos definidos)

  ✅ Tincho-Max   (Gr.A 1°)
  ✅ Nico-Fede    (Gr.B 1°)
  ✅ Ana-Lu       (Gr.A 2°)
  ✅ Sofi-Caro    (Gr.C 1°)

  Semi 1:  Tincho-Max  vs  Ana-Lu        ← seeding óptimo con info completa
  Semi 2:  Nico-Fede   vs  Sofi-Caro

  [Editar cruces]   [Aprobar]
```

**Momento 3 alternativo — Todos los grupos terminaron (admin YA aprobó Semi 2 antes):**

El sistema recalcula solo los cruces no aprobados. El partido aprobado es firme:

```
Copa Oro

  Semi 1:  Tincho-Max  vs  Sofi-Caro     [Aprobar]  ← recalculado con el equipo restante
  Semi 2:  Nico-Fede   vs  Ana-Lu        (aprobada)  ← firme, no se toca
```

### Seeding "modo global" (tabla general)

El ranking global requiere que **todos** los grupos estén completos para calcularse. En este modo no hay propuestas progresivas — el sistema muestra progreso pero espera:

```
Copa Oro (modo global — esperando tabla general)

  Grupos completos: 2 de 3
  ⏳ Falta: Grupo C (2 partidos pendientes)

  Los cruces se generan cuando todos los grupos terminen.
```

Cuando todos terminan, se genera la propuesta completa de una vez (con Decisión 1 + Decisión 2 como se describieron arriba).

### Warnings en TODAS las propuestas

Los warnings de visibilidad (empates en frontera, empates en grupo, rivales del mismo grupo) aplican siempre, tanto en propuestas progresivas (parciales) como en la propuesta con información completa. El admin siempre tiene el mismo nivel de contexto independientemente de cuántos grupos hayan terminado.

### Reglas del recálculo

| Situación | Qué hace el sistema |
|-----------|-------------------|
| Grupo termina, no hay aprobaciones previas | Recalcula cruces con el mejor seeding posible dada la información disponible |
| Grupo termina, hay partidos ya aprobados | Recalcula cruces no aprobados con la información nueva, respetando los aprobados |
| Admin aprueba un partido individual | Ese partido queda firme — el próximo recálculo lo respeta |
| Admin edita cruces y aprueba | Los cruces editados quedan firmes |

---

## Principio de arquitectura para el developer

**Una sola función de cálculo de propuestas.** El cálculo progresivo (parcial) y el cálculo completo (todos los grupos terminados) deben ser el mismo código. La función recibe los equipos disponibles y los partidos ya aprobados, y devuelve la mejor propuesta posible. No debe haber dos caminos de código separados para "parcial" vs "completo" — la diferencia es solo la cantidad de equipos que entran como input.

Esto implica:
- **Un único punto de entrada** para generar/recalcular propuestas (se llama cada vez que un grupo termina)
- **Un único punto de salida** que produce la propuesta con clasificados, cruces y warnings
- **Warnings calculados dentro de esa misma función** — no en un paso separado
- Si hay triggers asociados a la generación de propuestas, deben dispararse desde ese único lugar

---

## Lo que NO cambia

- El wizard de copas (Paso 1 del breadcrumb — definir plan) queda igual
- El mecanismo de propuestas automáticas sigue funcionando — el sistema sigue generando la propuesta inicial
- Una vez aprobados los partidos, el flujo de juego es el mismo de siempre
- Reset sigue funcionando como hoy

---

## Resumen de interacciones

| Situación | Acción del admin |
|-----------|-----------------|
| Todo bien, sin empates, todos los grupos terminaron | Confirmar clasificados → Aprobar cruces (2 clicks) |
| Empate en la frontera | Ver zona gris → intercambiar si quiere → Confirmar → Aprobar |
| Cruces con rivales del mismo grupo | Ver warning → Editar cruces → Aprobar |
| Quiere arrancar antes (seeding por grupo) | Aprobar partido individual → cuando terminen todos, aprobar el resto (recalculado) |
| No aprueba nada, espera que terminen todos | Sistema recalcula cruces óptimos → Aprobar todo junto |
| Empate en grupo | Ver aviso → Ir a tab Grupos → Reordenar → Volver → Confirmar |
