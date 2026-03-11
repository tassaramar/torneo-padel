# Copa Approval v2 — Spec funcional

## Problema

Cuando los grupos terminan, el admin necesita aprobar las copas. La v1 tiene bugs porque la lógica vive en dos lugares (servidor y cliente). La v2 simplifica radicalmente: los standings son la fuente de verdad, los empates se resuelven con sorteo, y los cruces se calculan automáticamente.

## Principios

1. **La tabla de posiciones es la fuente de verdad** — todo se deriva de ella
2. **El sorteo es el único punto de decisión del admin** — resuelve empates, se guarda en BD
3. **Los cruces son automáticos** — Mejor-Peor + optimización silenciosa de endógenos
4. **Guiar, no bloquear** — el sistema alerta sobre empates pero no impide aprobar
5. **Admin todo poderoso** — en modo edición, el admin puede armar cruces con cualquier equipo

---

## Tabla general (cambio de criterio)

La tabla general ordena primero por posición en grupo, luego por stats, luego por sorteo:

```
Posición en grupo (ASC) → P → DS → DG → GF → Sorteo (ASC)
```

Se agrega la columna **DG** (Diferencia de Games) que hoy no se muestra.

Esto significa que un 1° de grupo con pocos puntos queda arriba de un 2° con muchos puntos. La posición interna es el logro principal:

```
  #  Pareja          Pts  DS  DG  GF  Grupo
  1. Andy - Max       6   +3  +5  18  A 1°
  2. Lean - Leo       6   +3  +4  17  B 1°
  3. Tincho - Diego   4   +3  +3  15  C 1°  ← menos puntos que el 4°
  ────────────────────────────────────────── (todos los 1°)
  4. Gaby Z - Uri     5   +1  +2  14  A 2°
  5. Gus - Dudi       4   +1  +2  14  B 2°  🎲 Sorteo
  6. Marian - Sebi    4   +1  +2  14  C 2°  🎲 Sorteo
  ────────────────────────────────────────── (todos los 2°)
  ...
```

El sorteo se almacena en BD (single source of truth).

---

## El sorteo como mecanismo de desempate

### Cuándo se usa

- **Intra-grupo**: Dos o más equipos dentro de un grupo empatan en P, DS, DG, GF y no hay H2H que desempate. Se resuelve desde el **Tab Grupos**.
- **Inter-grupo (mismo tier)**: Dos o más equipos de distintos grupos, en la misma posición (ej: todos 2° de su grupo), empatan en stats. Se resuelve desde el **Tab Copas**.

### UX del sorteo

El admin hace un sorteo físico (dados, papelitos, etc.) e ingresa el resultado:

```
⚠️ Empate entre 3 equipos (2° de cada grupo, mismos Pts/DS/DG/GF)

  Asignar orden del sorteo:
  [1°] Gaby Z - Uri    (A 2°)
  [2°] Gus - Dudi      (B 2°)
  [3°] Marian - Sebi   (C 2°)

  [💾 Guardar sorteo]    [↩ Cancelar]
```

El admin puede cambiar los números o hacer drag-and-drop para reordenar. El resultado se guarda en BD.

### Dónde se resuelve cada tipo

| Tipo de empate | Dónde se resuelve | Desde dónde se alerta |
|---|---|---|
| Intra-grupo (ej: A2° y A3° empatan) | Tab Grupos → Grupo A | Tab Copas muestra alerta con link |
| Inter-grupo (ej: A2° y B2° empatan) | Tab Copas (inline) | Tab Copas muestra alerta inline |

---

## Algoritmo de cruces automáticos (Mejor-Peor + evitar endógenos)

### Paso 1: Mejor-Peor (seeding estándar)

Una vez definida la lista de clasificados (ordenada de mejor a peor), se aplica el seeding clásico:

- **4 equipos**: 1° vs 4°, 2° vs 3°
- **8 equipos**: 1° vs 8°, 2° vs 7°, 3° vs 6°, 4° vs 5°
- **2 equipos**: cruce directo

Esto hace que los mejores se enfrenten a los peores, evitando que los favoritos se crucen temprano.

### Paso 2: Evitar endógenos (swap secuencial)

Después de armar los cruces con Mejor-Peor, el sistema recorre los cruces en orden buscando **endógenos** (ambos equipos del mismo grupo). Cuando encuentra uno:

1. Toma al equipo peor seeded del cruce endógeno
2. Busca otro cruce (de abajo hacia arriba) donde pueda intercambiarlo por un equipo de **otro grupo**
3. Verifica que el intercambio no cree un nuevo endógeno en el otro cruce
4. Si encuentra un swap válido, lo hace y marca ambos equipos como "ya optimizados" para no tocarlos de nuevo
5. Si no encuentra swap válido, deja el cruce endógeno con warning

**Ejemplo con 4 grupos (A, B, C, D), 2 por grupo:**

```
Lista: A1°, B1°, C1°, D1°, D2°, C2°, B2°, A2°

Mejor-Peor inicial:
  QF1: A1° vs A2°  ← endógeno!
  QF2: B1° vs B2°  ← endógeno!
  QF3: C1° vs C2°  ← endógeno!
  QF4: D1° vs D2°  ← endógeno!

Scan secuencial:
  QF1: A1° vs A2° → endógeno. Busco swap para A2°.
    → Intercambio A2° con B2° (de QF2). Verifico: QF2 queda B1° vs A2° (cross). OK.
    → QF1: A1° vs B2° ✅, QF2: B1° vs A2° ✅

  QF2: ya resuelto ✅

  QF3: C1° vs C2° → endógeno. Busco swap para C2°.
    → Intercambio C2° con D2° (de QF4). Verifico: QF4 queda D1° vs C2° (cross). OK.
    → QF3: C1° vs D2° ✅, QF4: D1° vs C2° ✅

Resultado final (todo cross-grupo):
  QF1: A1° vs B2°
  QF2: B1° vs A2°
  QF3: C1° vs D2°
  QF4: D1° vs C2°
```

**Casos especiales:**
- **2 grupos**: Mejor-Peor con seeding por posición ya produce cruces cross-grupo naturalmente (no necesita swap)
- **1 grupo**: Todo es endógeno por definición, no hay swap posible. Se acepta con info al admin
- **Endógenos irresolvables**: Si no hay swap válido (ej: un grupo tiene muchos más equipos que los demás), el cruce queda endógeno con warning. El admin puede usar "Editar cruces" para resolverlo manualmente

### Equipos ya asignados (flag "utilizado")

Cuando el admin aprueba un cruce parcial (caso 1.5), esos equipos quedan marcados como **utilizados**. El algoritmo los excluye al calcular los cruces restantes:

- Los equipos aprobados no aparecen como candidatos para swap
- Los equipos aprobados no se incluyen en el pool de clasificados para cruces nuevos
- Cuando un nuevo grupo termina, el sistema recalcula solo los cruces pendientes respetando los ya aprobados

**Pitfall importante**: Al finalizar los grupos C y D (caso 1.5), el sistema necesita saber que A1°, A2°, B1°, B2° ya no son opciones válidas para los nuevos cruces. Esto requiere un flag en BD (ej: los partidos ya creados) o una exclusión explícita en el algoritmo que filtre equipos que ya tienen partidos de copa creados.

---

## Pantalla de copas — Lo que ve el admin

### Caso 1: Grupos jugando, sin equipos disponibles

```
Copa Oro (8 equipos) — Cuartos de Final

⏳ Esperando...          ─┐
                         ├─ QF1
⏳ Esperando...          ─┘
                                ...
Grupos completos: 0 de 4
```

### Caso 1.5: Parcial — hay cruces aprobables

Algunos grupos terminaron. El sistema coloca los equipos disponibles en el bracket evitando endógenos y permite aprobar cruces completos sin esperar al resto.

```
Copa Oro (8 equipos) — Cuartos de Final

Andy - Max (A 1°)       ─┐
                         ├─ QF1 ─┐
Gus - Dudi (B 2°)       ─┘      │
                                 ├─ SF1
⏳ Esperando...          ─┐      │
                         ├─ QF2 ─┘
⏳ Esperando...          ─┘
                                        ├─→ Final → Campeón
Tincho - Diego (B 1°)   ─┐
                         ├─ QF3 ─┐
Gaby Z - Uri (A 2°)     ─┘      │
                                 ├─ SF2
⏳ Esperando...          ─┐      │
                         ├─ QF4 ─┘
⏳ Esperando...          ─┘

Grupos completos: 2 de 4

QF1: Andy - Max (A) vs Gus - Dudi (B)       [✅ Aprobar]
QF3: Tincho - Diego (B) vs Gaby Z - Uri (A) [✅ Aprobar]
QF2: ⏳ Esperando Grupo C y D
QF4: ⏳ Esperando Grupo C y D

<ver clasificados>
```

Los mejores de cada grupo van en mitades opuestas del bracket (no se cruzan hasta la final). Al aprobar QF1 y QF3, los equipos quedan marcados como utilizados. Cuando C y D terminen, QF2 y QF4 se calculan con los nuevos equipos.

### Caso 2: Todo listo, sin empates (caso feliz)

```
Copa Oro (4 equipos)
Bracket 4

Andy - Max (A 1°)      ─┐
                        ├─ Semi 1 ─┐
Gus - Dudi (B 2°)      ─┘          │
                                    ├─→ Final → Campeón
Tincho - Diego (B 1°)  ─┐          │
                        ├─ Semi 2 ─┘
Gaby Z - Uri (A 2°)    ─┘

<ver clasificados>

  [✅ Aprobar copa]    [✏️ Editar cruces]
```

Clasificados en acordeón desplegable:
```
  1. Andy - Max      6pts DS+3 DG+5  (A 1°)
  2. Tincho - Diego  6pts DS+3 DG+3  (B 1°)
  3. Gaby Z - Uri    5pts DS+1 DG+2  (A 2°)
  4. Gus - Dudi      5pts DS+1 DG+1  (B 2°)
```

El bracket muestra los nombres y grupos directamente. Un click para aprobar. Los cruces ya evitan rivales del mismo grupo.

### Caso 3: Hay empates sin resolver

Los empates pueden afectar a más equipos que los clasificados. La alerta muestra **todos** los empatados, incluyendo los que quedan afuera del corte:

```
Copa Oro (4 equipos)

⚠️ Empate sin resolver en Grupo A (posiciones 2°-3°)
   Afecta quién clasifica a Copa Oro.
   [Ir a Grupo A →]

⚠️ Empate sin resolver entre 3 equipos (todos 2° de grupo)
   Gaby Z - Uri (A 2°), Gus - Dudi (B 2°), Marian - Sebi (C 2°)
   Todos con 5pts DS+1 DG+2 — el sorteo define el orden.
   [🎲 Resolver sorteo]

Andy - Max (A 1°)       ─┐
                         ├─ Semi 1 ─┐
⚠️ Gaby Z - Uri (A 2°) ─┘          │
                                    ├─→ Final → Campeón
Tincho - Diego (B 1°)   ─┐         │
                         ├─ Semi 2 ─┘
⚠️ Gus - Dudi (B 2°)   ─┘

<ver clasificados>  (muestra todos, incluyendo #5 Marian-Sebi afuera con ⚠️ empate a 3)

  ⚠️ Los cruces pueden cambiar si se resuelven los empates

  [✅ Aprobar copa]    [✏️ Editar cruces]
```

Los empates **no bloquean** la aprobación (Guiar, No Bloquear). El warning es informativo.

### Caso 4: Cruces con endógenos (warning informativo)

Si el algoritmo no pudo evitar todos los cruces entre equipos del mismo grupo:

```
Andy - Max (A 1°)       ─┐
                         ├─ Semi 1 ─┐
⚠️ Gaby Z - Uri (A 2°) ─┘          │  ⚠️ mismo grupo
                                    ├─→ Final → Campeón
Tincho - Diego (B 1°)   ─┐         │
                         ├─ Semi 2 ─┘
Gus - Dudi (B 2°)       ─┘

  ℹ️ No se pudieron evitar cruces entre equipos del mismo grupo.
     Podés editar los cruces manualmente.

  [✅ Aprobar copa]    [✏️ Editar cruces]
```

---

## Editar cruces — Admin todo poderoso

Cuando el admin toca "Editar cruces", puede elegir **cualquier equipo del torneo**, no solo los clasificados.

### Interfaz

```
CRUCES (editando)

  Semi 1: [🔍 Andy - Max (A 1°)      ▼]  vs  [🔍 Gus - Dudi (B 2°)      ▼]
  Semi 2: [🔍 Tincho - Diego (B 1°)  ▼]  vs  [🔍 Gaby Z - Uri (A 2°)    ▼]

  [✅ Aprobar con estos cruces]    [↩ Volver a sugeridos]
```

Cada selector despliega todos los equipos del torneo, agrupados:

```
  ── Clasificados (sugeridos) ──────
  ✅ Andy - Max        (A 1°, 6pts)
  ✅ Tincho - Diego    (B 1°, 6pts)
  ✅ Gaby Z - Uri      (A 2°, 5pts)
  ✅ Gus - Dudi        (B 2°, 5pts)
  ── Otros equipos ─────────────────
     Marian - Sebi     (C 2°, 4pts)
     Diego S - Alan    (A 3°, 3pts)
     Santi - Pedro     (B 3°, 2pts)
     ...
```

### Reglas

- **Auto-dedup**: Si un equipo se asigna a un slot, se saca automáticamente de cualquier otro slot
- **Warnings no bloqueantes**:
  - ⚠️ "Equipo no clasificado" si elige uno fuera de los sugeridos
  - ⚠️ "Mismo grupo" si ambos equipos de un cruce son del mismo grupo
  - ⚠️ "Equipo asignado a otra copa" si ya tiene partidos en otra copa

### Persistencia

Los cruces editados son **efímeros** — viven en pantalla hasta que el admin aprueba o cierra. Al aprobar, los **partidos** se crean en BD (eso sí persiste). Si cierra sin aprobar y vuelve, ve los cruces automáticos de nuevo. Lo que persiste es el resultado (los partidos), no el camino (los cruces editados).

---

## Resumen de interacciones del admin

| Situación | Qué ve | Qué hace |
|---|---|---|
| Grupos jugando, sin equipos | Bracket vacío con "Esperando..." | Espera |
| Algunos grupos terminados | Bracket parcial con cruces aprobables | Aprueba cruces individuales |
| Todo listo, sin empates | Bracket con nombres + cruces optimizados | Aprobar (1 click) |
| Empate intra-grupo | Alerta con link a Tab Grupos | Va a Grupos → sorteo → vuelve |
| Empate inter-grupo | Alerta inline con todos los empatados | Sorteo inline → se recalcula |
| Cruces endógenos | Warning en bracket | Aprobar o Editar cruces |
| Quiere cambiar cruces | Selectores con todos los equipos del torneo | Editar → Aprobar |

---

## Qué se mantiene igual

- El wizard de copas (configuración del plan) no cambia
- Una vez aprobada la copa, el flujo de juego es el mismo (carga de resultado, avance de ronda)
- Reset de copas sigue funcionando
- La vista del jugador (index.html) no cambia

## Qué cambia respecto a la v1

| v1 | v2 |
|---|---|
| RPC genera propuestas en BD → UI las modifica | Cruces se derivan de standings client-side |
| Zona gris + frontier swap | Sorteo como criterio de desempate |
| Fire-and-forget al confirmar resultado | Eliminado — standings se re-leen al abrir Copas |
| Tabla general por stats puros | Tabla general por posición interna → stats → sorteo |
| Falta columna DG | Se agrega DG |
| Dual source of truth | Single source of truth (standings + sorteos en BD) |
| Edit cruces solo entre clasificados | Edit cruces con cualquier equipo del torneo |
| No optimiza endógenos | Swap automático silencioso + warning si no se puede resolver |

---

## Criterios de aceptación

### Tabla general

- [ ] La tabla general muestra la columna DG (Diferencia de Games)
- [ ] Todos los 1° de grupo aparecen antes que todos los 2°, independientemente de los puntos
- [ ] Dentro de un mismo tier (ej: todos los 2°), el orden es por P → DS → DG → GF
- [ ] Si dos equipos del mismo tier tienen stats idénticos y hay sorteo cargado, el sorteo define el orden
- [ ] Si no hay sorteo cargado, los empatados se muestran con indicador ⚠️

### Sorteo

- [ ] Cuando hay empate intra-grupo, el Tab Grupos muestra la opción de cargar sorteo
- [ ] Cuando hay empate inter-grupo (mismo tier), el Tab Copas muestra la opción de cargar sorteo
- [ ] El admin puede asignar orden manualmente (1°, 2°, 3°...) a los equipos empatados
- [ ] El sorteo se guarda en BD — si el admin cierra y vuelve, el resultado persiste
- [ ] Después de cargar un sorteo, la tabla general se recalcula y el indicador ⚠️ desaparece

### Bracket y cruces automáticos

- [ ] El bracket muestra los nombres de los equipos y su grupo (no "Tabla N°")
- [ ] Los cruces siguen la regla Mejor-Peor (1° vs último, 2° vs anteúltimo)
- [ ] Con 2 grupos, los cruces nunca enfrentan equipos del mismo grupo
- [ ] Con 4 grupos, los cruces evitan enfrentar equipos del mismo grupo (swap automático)
- [ ] Si un cruce endógeno no se puede evitar, se muestra warning ⚠️ "mismo grupo"
- [ ] Los clasificados están disponibles en un acordeón desplegable debajo del bracket

### Aprobación parcial (caso 1.5)

- [ ] Si algunos grupos terminaron, los equipos disponibles aparecen en el bracket
- [ ] Los cruces parciales entre equipos de distintos grupos se pueden aprobar individualmente
- [ ] Al aprobar un cruce, se crean los partidos en BD
- [ ] Cuando un nuevo grupo termina, los cruces pendientes se recalculan sin afectar los ya aprobados
- [ ] Los equipos ya aprobados no aparecen disponibles para nuevos cruces

### Empates y warnings

- [ ] Si hay empate intra-grupo que afecta una copa, el Tab Copas muestra alerta con link al Tab Grupos
- [ ] Si hay empate inter-grupo, el Tab Copas muestra alerta con opción de sorteo inline
- [ ] La alerta muestra TODOS los equipos involucrados en el empate (incluyendo los que quedan afuera del corte)
- [ ] Los empates no bloquean la aprobación — el admin puede aprobar igual con warning visible

### Editar cruces (admin todo poderoso)

- [ ] El botón "Editar cruces" abre selectores en cada slot del bracket
- [ ] Los selectores muestran todos los equipos del torneo, con los clasificados primero
- [ ] Un equipo no puede estar en dos slots a la vez (auto-dedup)
- [ ] Si el admin elige un equipo no clasificado, aparece warning ⚠️
- [ ] Si el admin arma un cruce entre equipos del mismo grupo, aparece warning ⚠️
- [ ] "Volver a sugeridos" restaura los cruces calculados por el algoritmo
- [ ] Al aprobar con cruces editados, se crean los partidos en BD con esos cruces

### Regresión (lo que no debe romperse)

- [ ] El wizard de copas (configuración del plan) sigue funcionando igual
- [ ] Una copa aprobada se juega normalmente (carga de resultado, avance de ronda automático)
- [ ] Reset de copas borra partidos y permite empezar de nuevo
- [ ] La vista del jugador (index.html) muestra las copas correctamente
