# Formato de Sets por Torneo — Spec Funcional

> **Estado**: Aprobado por el owner
> **Objetivo principal**: Que el jugador sepa exactamente qué tiene que cargar, sin confusión.
> **Objetivo secundario**: Que el admin pueda configurar el formato de forma simple.

---

## El problema hoy

Cuando un jugador entra a cargar el resultado de su partido, ve un input para el Set 1 y un botón "Agregar Set 2". Esto genera confusión:

- "¿Tengo que agregar el Set 2 o no?"
- "¿Se juega a 1 set o a 3?"
- "¿Qué pasa si pongo solo 1 set y el torneo era a 3?"

El torneo no tiene configurado si es a 1 set o al mejor de 3, entonces la UI intenta adivinar y termina siendo ambigua.

---

## La solución

### Para el admin: un selector simple

En **Admin → Tab Setup**, un selector con dos opciones:

- **1 Set** — Cada partido se define en un solo set
- **Al mejor de 3 sets** — Gana el primero en ganar 2 sets

Valor por defecto: **1 Set** (el formato más común en torneos sociales).

Se configura una vez al crear el torneo. Se puede cambiar en cualquier momento (los partidos ya cargados no se modifican).

---

### Para el jugador: una experiencia clara según el formato

#### Formato "1 Set"

El jugador ve **un solo bloque de carga**:

```
Set 1
[  Nosotros  ] - [  Ellos  ]
```

Al completar los games:
- Si ganó → Mensaje de victoria: "¡Bien que ganaste! ¡A celebrar!" (mensajes actuales)
- Si perdió → Mensaje de derrota: "¡La próxima es tuya!" (mensajes actuales)
- Si empató → Mensaje de error: "No se puede empatar" (mensajes actuales)

No hay botón "Agregar Set 2". No hay ambigüedad.

#### Formato "Al mejor de 3 sets"

El jugador ve **dos bloques de carga** desde el inicio:

```
Set 1
[  Nosotros  ] - [  Ellos  ]

Set 2
[  Nosotros  ] - [  Ellos  ]
```

La experiencia es guiada con mensajes paso a paso:

**Paso 1 — Completa el Set 1:**
- Si ganó el set 1 → "¡Bien! Ganaste el primer set. ¿Lo cerraste en el segundo?"
- Si perdió el set 1 → "Uff, arrancaron abajo. ¿Pudieron remontar en el segundo?"
- Si empató → "No se puede empatar un set, revisá los números"

**Paso 2 — Completa el Set 2:**
- Si ganó 2-0 → "¡Felicitaciones! Partido cerrado en 2 sets" (mensaje final, se puede guardar)
- Si perdió 0-2 → "Buen partido, la próxima será" (mensaje final, se puede guardar)
- Si quedó 1-1 → "¡Tremendo! Se define en el Super Tiebreak. Contame cómo fue"

**Paso 3 — Super Tiebreak (solo si 1-1):**

Aparece automáticamente un tercer bloque:

```
Super Tiebreak
[  Nosotros  ] - [  Ellos  ]
```

- Si ganó → "¡Partido ganado en el Super Tiebreak!"
- Si perdió → "Buen partido, se definió en el Super Tiebreak"

**Nota**: El Set 3 (Super Tiebreak) solo aparece cuando los dos primeros sets están completos y empatados 1-1. No hay botón manual para agregarlo.

---

### Flujo de confirmación (segunda pareja)

Cuando la segunda pareja entra a confirmar el resultado, ve el resumen de lo que cargó la primera pareja:

- **1 Set**: "6-3" → botón Confirmar / Disputar
- **3 Sets**: "6-3, 4-6, 10-8 (STB)" → botón Confirmar / Disputar

El formato de visualización ya funciona correctamente hoy — no cambia.

---

### Flujo de disputa

Si la segunda pareja no está de acuerdo y carga su versión:

- **1 Set**: Carga su versión del set 1
- **3 Sets**: Carga su versión de los 2 o 3 sets

La UI de carga de la disputa sigue las mismas reglas que la carga original (1 input vs 2-3 inputs según formato del torneo).

---

### Carga desde carga.html (admin/organizador)

El organizador ve la misma cantidad de inputs según el formato del torneo:

- **1 Set**: Un input por equipo (como hoy)
- **3 Sets**: Dos inputs por equipo, con el tercero apareciendo si hay empate en los primeros dos

El admin siempre pone estado `confirmado` al guardar (no necesita doble confirmación).

---

## Resumen de cambios

| Quién | Qué cambia |
|-------|------------|
| **Admin** | Nuevo selector en Tab Setup: "1 Set" / "Al mejor de 3 sets" |
| **Jugador (carga)** | Si 1 set: solo 1 input. Si 3 sets: 2 inputs + STB condicional. Sin botón "Agregar Set 2" |
| **Jugador (mensajes)** | Mensajes adaptativos: por set intermedio o por partido final |
| **Jugador (confirmar)** | Sin cambios — ya muestra el resultado completo |
| **Organizador (carga.html)** | Inputs adaptados al formato del torneo |

---

## Qué NO cambia

- La tabla de posiciones (ya calcula bien con 1 o 3 sets)
- El formato de visualización de resultados (ya soporta multi-set)
- El fixture (muestra el resultado como viene)
- Los estados del partido (pendiente → a_confirmar → confirmado)
- Las reglas de desempate
