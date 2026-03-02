# Spec: Integración de partidos de copa en vistas públicas

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 1
**Ítems del backlog**: "Partidos de copa no aparecen en fixture.html" + "Modal index.html no muestra partidos de copa"

---

## Principio de diseño

> El usuario no debería tener que hacer un "click mental" para encontrar partidos de copa en un lugar separado. La información debe fluir naturalmente: si hay partidos por jugar, aparecen en la cola — sean de grupo o de copa.

---

## Cambio 1 — fixture.html: Cola unificada

### Qué ve el organizador hoy

Vista Cola (la principal): los partidos de copa están en una sección separada "🏆 Copas pendientes" al final. El organizador tiene que scrollear pasando los de grupo y buscar la sección de copas para ver si hay algo.

### Qué debería ver

**Una sola cola** donde los partidos de copa aparecen al final (después de todos los de grupo), **integrados en la misma lista**, con un badge 🏆 que los distingue. No hay sección separada.

```
Cola de partidos (orden sugerido):

#5   Grupo A R3       Tincho-Max vs Pedro-Lucho      ⚡ En juego
#6   Grupo B R3       Nico-Fede vs Gaby-Santi        ⏳ Pendiente
#7   Grupo C R3       Rafa-Javi vs Lucas-Mati         ⏳ Pendiente
#8   🏆 Copa Oro SF   Tincho-Max vs Rafa-Javi         ⏳ Pendiente
#9   🏆 Copa Plata SF Pedro-Lucho vs Gaby-Santi      ⏳ Pendiente
```

### Comportamiento específico

- Los partidos de copa se **numeran** como parte de la cola global (#8, #9...), continuando la numeración de los de grupo
- Los partidos de copa van **siempre al final** de la cola, después de todos los de grupo. Esto es coherente porque las copas se generan cuando los grupos terminan (o están por terminar)
- Dentro de los de copa: ordenar por nombre de copa, luego por ronda (SF antes de F)
- Badge visible: "🏆 Copa Oro — Semi", "🏆 Copa Plata — Final"
- Los botones de acción del organizador ("Marcar en juego", etc.) funcionan igual que para partidos de grupo

### Vista Tabla

La vista Tabla (grid por grupos) puede opcionalmente mostrar una sección "🏆 Copas" al final del grid, o no mostrar copas y dejar que el organizador use la Cola para gestionarlas. **Decisión**: dejarlo como mejora menor — la Cola es la vista principal del organizador y es donde importa.

---

## Cambio 2 — index.html modal: Reestructuración de tabs

### Qué ve el jugador hoy

El modal tiene 3 tabs: "Mi grupo" | "Otros grupos" | "Fixture".

### Qué debería ver

**3 tabs principales** (caben en cualquier celular):

```
[Grupos]         [Copas]         [Fixture]
```

**Tab "Grupos"** — Unifica "Mi grupo", "Otros grupos" y la tabla general (Doc 4) en sub-tabs:

```
[Grupos]
  ┌──────────────────────────────────────────┐
  │ [Grupo A] [Grupo B] [Grupo C] [General]  │  ← sub-tabs
  │                                           │
  │   Tabla de posiciones                     │
  │   Partidos jugados...                     │
  └───────────────────────────────────────────┘
```

- "Mi grupo" aparece primero y seleccionado por defecto (se identifica por la identidad del jugador)
- Los sub-tabs usan la letra/nombre del grupo
- "General" al final muestra la tabla cross-grupos (Doc 4)
- Si hay muchos grupos, los sub-tabs tienen scroll horizontal

**Tab "Copas"** — Solo visible si hay copas con partidos creados. Si no hay copas activas, el tab no aparece (quedan 2 tabs: Grupos + Fixture).

Responde a las preguntas del jugador curioso:
- ¿Quién juega contra quién en las copas?
- ¿Qué cruces ya se jugaron y con qué resultado?
- ¿En cuántas copas se dividió el torneo?

Contenido: una sección por copa, con lista secuencial de partidos:

```
🏆 Copa Oro (4 equipos)

  Semifinal 1
    Tincho-Max  6-4 6-2  Pedro-Lucho    ✅ Confirmado

  Semifinal 2
    Nico-Fede  vs  Gaby-Santi           ⏳ Pendiente

  Final
    Tincho-Max  vs  ?                    ⏳ Esperando semifinal 2

  3er Puesto
    Pedro-Lucho  vs  ?                   ⏳ Esperando semifinal 2

────────────────────────────

🏆 Copa Plata (2 equipos)

  Cruce
    Lucas-Mati  vs  Rafa-Javi            ⏳ Pendiente
```

**Tab "Fixture"** — Todos los partidos (grupos + copas) en orden cronológico/operacional. El jugador que va a Fixture quiere ver "¿qué se juega próximo?", sin importar si es grupo o copa. Misma lógica de cola unificada que fixture.html.

### Comportamiento específico del tab Copas

- Cada copa tiene su sección con nombre y cantidad de equipos
- Partidos ordenados por jerarquía de ronda: SF → F → 3P → direct
- Si un partido tiene resultado confirmado: mostrar score
- Si un partido tiene resultado pendiente/en revisión: mostrar estado
- Si un partido depende de otro que no se jugó: "Esperando [ronda]"
- **Resaltado**: Si la pareja del jugador identificado participa en un partido de copa, resaltarla (verde, como en las tablas de grupo)
- **Mejora futura**: Reemplazar la lista secuencial por un mini-bracket visual (llave de torneo) — no incluir en esta iteración

### Diferencia entre Fixture y Copas

- **Fixture** = "¿Qué se juega próximo?" — vista cronológica/operacional, todos los partidos mezclados
- **Copas** = "¿Cómo están las llaves?" — vista de estructura de cada copa

---

## Campos de BD relevantes

| Campo | Tabla | Significado |
|-------|-------|-------------|
| `copa_id` | `partidos` | UUID de la copa. NULL = grupo, NOT NULL = copa |
| `ronda_copa` | `partidos` | `'SF'`, `'F'`, `'3P'`, `'direct'` |
| `orden_copa` | `partidos` | Orden dentro de la ronda (1, 2...) |
| `copas.nombre` | `copas` | Nombre legible: "Copa Oro", "Copa Plata" |

---

## Criterios de aceptación

### fixture.html
- [ ] La cola muestra partidos de grupo Y copa en una sola lista
- [ ] Los partidos de copa aparecen al final de la cola, después de todos los de grupo
- [ ] Los partidos de copa tienen numeración global continua (#8, #9...)
- [ ] Cada partido de copa muestra badge "🏆 [Copa] — [Ronda]"
- [ ] Los botones de acción ("Marcar en juego", etc.) funcionan para partidos de copa
- [ ] Si no hay partidos de copa, la cola se ve exactamente como hoy (sin regresión)

### index.html modal — Reestructuración de tabs
- [ ] Los tabs principales son: "Grupos", "Copas" (condicional), "Fixture"
- [ ] Tab "Grupos" tiene sub-tabs: uno por grupo + "General" al final
- [ ] El sub-tab del grupo del jugador está seleccionado por defecto
- [ ] Sub-tab "General" muestra la tabla cross-grupos (Doc 4)
- [ ] Tab "Copas" solo aparece si hay copas con partidos creados en BD
- [ ] Tab "Copas" muestra cada copa con sus partidos en lista secuencial
- [ ] Los partidos de copa muestran: equipos, resultado (si hay), estado, ronda
- [ ] La pareja del jugador aparece resaltada si participa en una copa
- [ ] Tab "Fixture" muestra todos los partidos (grupos + copas) en orden cronológico

---

## Archivos a modificar

- `src/fixture.js` — integrar `partidosCopa` en la cola sugerida (función `calcularColaSugerida` o post-append)
- `src/viewer/modalConsulta.js` — agregar tab "Copas", cargar datos de copas, crear `renderCopas()`, sacar copas de `renderFixture()`
