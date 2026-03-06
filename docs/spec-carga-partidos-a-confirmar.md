# Spec: Carga.html — partidos pendientes de confirmación

**Estado**: 📋 PRIORIZADA
**Prioridad**: Bloque A — Score owner 5/5
**Backlog**: "Carga.html: partidos pendientes de confirmación"

---

## Contexto

### Pregunta del organizador que resuelve

> "¿Qué partidos están trabados? Algún jugador cargó resultado pero el rival no confirmó todavía — ¿cuáles son y puedo destrabarlos?"

Hoy en `carga.html` no hay forma de ver partidos en estado `a_confirmar` de forma aislada. Aparecen mezclados en el modo "Jugados" junto con los confirmados. El organizador no tiene visibilidad de qué partidos necesitan atención.

### Flujo real del organizador

```
Torneo en curso → organizador abre carga.html
→ "¿Qué partidos necesitan que alguien confirme?"
→ Ve 4 partidos esperando confirmación
→ Revisa el resultado cargado → parece correcto → confirma directamente
→ Un resultado parece incorrecto → edita el score → confirma
```

---

## Diseño funcional

### Nuevo modo: "A confirmar"

Agregar un **4to botón** en la barra de modos de `carga.html`:

```
[Pendientes]  [A confirmar (3)]  [Jugados]  [Disputas (1)]
```

Los botones "A confirmar" y "Disputas" muestran la cantidad de partidos como badge `(N)`. Si hay 0, el badge no se muestra (solo el texto). Esto permite al organizador ver de un vistazo si hay partidos que requieren atención.

### Qué muestra este modo

Filtra partidos (grupos + copas) con `estado = 'a_confirmar'`:
- Partidos donde **una pareja cargó el resultado** pero la otra aún no confirmó/disputó
- El campo `cargado_por_pareja_id` indica quién cargó primero

### Card de partido a confirmar

Cada partido se muestra como card con:

```
┌─────────────────────────────────────────────┐
│  Grupo A                    ⏳ A confirmar   │
│                                             │
│  Andy - Max      ★    6    ← ganador arriba │
│  Gaby Z - Uri         3                     │
│                                             │
│  Cargado por: Andy - Max                    │
│                                             │
│  [✅ Confirmar]          [✏️ Editar]         │
└─────────────────────────────────────────────┘
```

**Elementos de la card**:

1. **Header izq**: nombre del grupo (o "Copa Oro — Semi" para partidos de copa)
2. **Header der**: estado `⏳ A confirmar` (amarillo/naranja)
3. **Resultado**: games cargados, NO editables por defecto (texto, no inputs)
4. **Ganador siempre arriba**: la pareja ganadora se muestra primera (arriba), con clase `is-winner` (negrita). Si `sets_a > sets_b` → pareja_a arriba; si no → invertir el orden visual (sin cambiar la BD). Esto permite ver de un vistazo quién ganó.
5. **Quién cargó**: "Cargado por: [nombre pareja]" — info contextual útil para el organizador
7. **Botón Confirmar**: cambia estado a `confirmado`. Acción primaria, prominente. **Optimistic UI**: la card desaparece al instante con rollback si falla (misma técnica que presentismo).
8. **Botón Editar**: reemplaza la card de solo lectura por una `crearCardEditable` estándar (reutiliza el componente existente de `cardEditable.js`). Al guardar, el estado pasa a `confirmado`. Sin optimistic UI en este caso (espera respuesta del server).

### Flujo de "Editar" — reutilizar `crearCardEditable`

1. Organizador toca "Editar"
2. Se reemplaza la card de solo lectura por `crearCardEditable(partido, ...)` — **el mismo componente que ya se usa en modo Pendientes y Jugados**
3. Los inputs se pre-llenan con los games cargados (`set1_a`, `set1_b`)
4. **Mensaje en vivo de ganador**: debajo de los inputs, un mensaje que se actualiza en tiempo real al cambiar los games: **"🏆 Ganó Andy - Max"** (o el nombre de la pareja que va ganando). Similar al "¡Buena victoria!" que ve el jugador en `index.html` (ver captura). Se actualiza con cada cambio de input, no al guardar. Si los games son iguales o vacíos, no mostrar mensaje.
5. El `onSave` del card editable hace: actualiza `set1_a`, `set1_b` + `estado: 'confirmado'`
6. Después del save, la card desaparece (igual que "Confirmar")

**Ventaja**: no se duplica código de inputs, validación, ni pintado de ganador. `cardEditable.js` ya maneja todo eso.

### Comportamiento post-acción

Después de confirmar o guardar:
- La card desaparece del listado (ya no es `a_confirmar`)
- El counter del badge se actualiza: `[A confirmar (2)]`
- Si quedan 0, mostrar mensaje "No hay partidos pendientes de confirmación"
- Toast de feedback: "Resultado confirmado ✅" (breve, no intrusivo)

### Orden de los partidos

Misma lógica que en otros modos:
- Partidos de grupo primero, agrupados por grupo (Grupo A, Grupo B...)
- Partidos de copa después, con label de copa + ronda

---

## Implementación técnica

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/carga/layout.js` | Agregar 4to botón `btn-confirmar`. Retornarlo en el objeto DOM. Wire en `wireModoToggle`. Pintarlo en `pintarModoToggle`. |
| `src/carga/partidosGrupos.js` | Agregar filtro `estado = 'a_confirmar'` para el nuevo modo. Crear función de render para cards de confirmación. |
| `src/carga/copas.js` | Agregar filtro `estado = 'a_confirmar'` para el nuevo modo. Reutilizar misma card de confirmación. |
| `src/style.css` | Estilos para card de confirmación (estado amarillo, botones). |

### Queries por modo

```javascript
// Modo actual: pendientes
if (state.modo === 'pendientes') {
  q = q.is('sets_a', null);
}

// NUEVO modo: a_confirmar
if (state.modo === 'confirmar') {
  q = q.eq('estado', 'a_confirmar');
}

// Modo actual: jugados
if (state.modo === 'jugados') {
  q = q.not('sets_a', 'is', null);
}

// Modo actual: disputas
if (state.modo === 'disputas') {
  q = q.eq('estado', 'en_revision');
}
```

### Card de confirmación — nueva función

Crear `crearCardConfirmacion(partido, supabase, onUpdate)` en `partidosGrupos.js` (o en un módulo compartido):

```javascript
function crearCardConfirmacion(partido, supabase, onUpdate) {
  const nombreA = partido.pareja_a?.nombre || '?';
  const nombreB = partido.pareja_b?.nombre || '?';
  const grupo = partido.grupos?.nombre || '';
  const cargadoPor = partido.cargado_por_pareja_id === partido.pareja_a?.id
    ? nombreA
    : partido.cargado_por_pareja_id === partido.pareja_b?.id
      ? nombreB
      : '?';

  // 1. Header: grupo/copa + estado "⏳ A confirmar"
  // 2. Scores en modo solo lectura (spans, no inputs)
  // 3. Clase is-winner en la pareja ganadora (sets_a > sets_b → A gana, etc.)
  // 4. "Cargado por: ..."
  // 5. Botón Confirmar → update estado='confirmado', llamar onUpdate()
  // 6. Botón Editar → reemplazar esta card por crearCardEditable(partido, ...)
  //    El onSave de cardEditable debe setear estado='confirmado' además de los scores
}
```

### Acción "Confirmar"

```javascript
await supabase
  .from('partidos')
  .update({ estado: 'confirmado' })
  .eq('id', partido.id);
```

Solo cambia el estado. No toca los scores.

### Acción "Editar"

Al tocar "Editar", reemplazar el DOM de la card por una `crearCardEditable` estándar (de `cardEditable.js`), pasando un `onSave` custom que además de guardar los scores setee `estado: 'confirmado'`:

```javascript
// Pseudocódigo del onSave para modo "A confirmar"
async function onSave(partidoId, gamesA, gamesB) {
  await supabase.from('partidos').update({
    set1_a: gamesA,
    set1_b: gamesB,
    estado: 'confirmado'
  }).eq('id', partidoId);
}
```

Reutiliza toda la lógica de inputs, validación y `is-winner` de `cardEditable.js`.

### Fire-and-forget para copas

Después de confirmar un partido de copa, disparar los RPCs existentes (misma lógica que en otros flujos):

```javascript
if (partido.copa_id) {
  supabase.rpc('avanzar_ronda_copa', { p_copa_id: partido.copa_id });
}
```

Esto permite que al confirmar la segunda semi, la final se genere automáticamente.

### Badges con counter (A confirmar + Disputas)

En `layout.js`, crear función `actualizarCounters()` que consulte ambos conteos en paralelo:

```javascript
async function actualizarCounters(supabase, dom) {
  const [confirmar, disputas] = await Promise.all([
    supabase.from('partidos').select('id', { count: 'exact', head: true })
      .eq('torneo_id', TORNEO_ID).eq('estado', 'a_confirmar'),
    supabase.from('partidos').select('id', { count: 'exact', head: true })
      .eq('torneo_id', TORNEO_ID).eq('estado', 'en_revision'),
  ]);

  dom.btnConfirmar.textContent = confirmar.count > 0
    ? `A confirmar (${confirmar.count})` : 'A confirmar';
  dom.btnDisputas.textContent = disputas.count > 0
    ? `Disputas (${disputas.count})` : 'Disputas';
}
```

Llamar `actualizarCounters()`:
- Al inicializar la página
- Después de cada acción de confirmación o resolución de disputa

---

## Nomenclatura de campos (referencia rápida)

| Campo | Significado |
|-------|-------------|
| `pareja_a_id` / `pareja_b_id` | IDs de las parejas |
| `set1_a` / `set1_b` | Games del set 1 (pareja A / pareja B) |
| `sets_a` / `sets_b` | Sets ganados (calculados por trigger) |
| `estado` | `'pendiente'`, `'a_confirmar'`, `'confirmado'`, `'en_revision'`, `'en_juego'`, `'terminado'` |
| `cargado_por_pareja_id` | UUID de la pareja que cargó el resultado primero |
| `copa_id` | FK a tabla `copas` (NULL = partido de grupo) |
| `ronda_copa` | `'SF'`, `'F'`, `'3P'`, `'direct'`, `'QF'` |

---

## Consideraciones de mobile

- Botones de modo: con 4 botones, verificar que no se rompan en pantallas angostas. Usar `overflow-x: auto` o reducir texto a "Confirmar" en vez de "A confirmar" si es necesario.
- Botones de acción en la card: full-width en mobile, uno debajo del otro si no entran lado a lado.
- Área de toque: `min-height: 44px` para todos los botones.

---

## Criterios de aceptación

**Modo "A confirmar"**:
- [ ] Nuevo botón "A confirmar" en la barra de modos, entre Pendientes y Jugados
- [ ] El botón "A confirmar" muestra counter `(N)` cuando hay partidos pendientes
- [ ] El botón "Disputas" también muestra counter `(N)` cuando hay disputas
- [ ] Al seleccionar el modo, se listan solo partidos con `estado = 'a_confirmar'`
- [ ] Se muestran tanto partidos de grupo como de copa

**Card de confirmación**:
- [ ] Muestra el resultado cargado en modo solo lectura (no editable por defecto)
- [ ] La pareja ganadora se muestra siempre arriba, con `is-winner` (negrita)
- [ ] En modo "Editar", mensaje en vivo "🏆 Ganó [nombre pareja]" que se actualiza al cambiar los games (antes de guardar)
- [ ] Muestra "Cargado por: [nombre pareja]"
- [ ] Para partidos de copa: muestra nombre de copa + ronda en el header
- [ ] Botón "Confirmar" → optimistic UI: card desaparece al instante, rollback si falla
- [ ] Botón "Editar" → reemplaza la card por `crearCardEditable` (reutiliza componente existente)
- [ ] "Guardar" después de editar → actualiza scores + estado `confirmado` (espera response)

**Post-acción**:
- [ ] Counter del badge se actualiza
- [ ] Si quedan 0 → mensaje "No hay partidos pendientes de confirmación"
- [ ] Para partidos de copa → fire-and-forget `avanzar_ronda_copa`

**General**:
- [ ] 4 botones de modo caben bien en mobile (320px+)
- [ ] `npm run build` sin errores nuevos
- [ ] No duplicar código — reutilizar `cardEditable.js` donde tenga sentido
