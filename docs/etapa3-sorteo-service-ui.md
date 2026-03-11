# Etapa 3: Sorteo — Service + integración + UI en Tab Grupos

## Objetivo

Reemplazar `posiciones_manual` por `sorteos` como mecanismo de desempate. Crear un service de CRUD para sorteos, actualizar todos los consumers que leen/escriben `posiciones_manual`, y ajustar la UI del Tab Grupos para reflejar el concepto de "sorteo".

**El flujo UX es el mismo** (reordenar con ▲/▼ y guardar), pero el concepto cambia: ya no es "orden manual" sino "resultado de sorteo físico".

## Spec funcional de referencia

`docs/spec-copa-approval-v2.md` — Secciones:
- "El sorteo como mecanismo de desempate"
- "UX del sorteo"
- "Dónde se resuelve cada tipo"

## Criterios de aceptación (de la spec)

- [ ] Cuando hay empate intra-grupo, el Tab Grupos muestra la opción de cargar sorteo
- [ ] El admin puede asignar orden manualmente (1°, 2°, 3°...) a los equipos empatados
- [ ] El sorteo se guarda en BD (tabla `sorteos`) — si el admin cierra y vuelve, el resultado persiste
- [ ] Después de cargar un sorteo, la tabla se recalcula y el indicador ⚠️ desaparece
- [ ] El wizard de copas sigue funcionando igual (regresión)
- [ ] La vista del jugador (index.html) muestra posiciones correctamente

---

## Archivo a crear: `src/admin/copas/copaDecisionService.js`

Servicio CRUD para la tabla `sorteos`. Funciones simples de IO.

```js
/**
 * CRUD para tabla sorteos.
 * Maneja sorteos intra-grupo (desde Tab Grupos) e inter-grupo (desde Tab Copas).
 */
```

### Función 1: `cargarSorteos(supabase, torneoId)`

Carga todos los sorteos del torneo.

```js
export async function cargarSorteos(supabase, torneoId) {
  const { data, error } = await supabase
    .from('sorteos')
    .select('id, torneo_id, grupo_id, pareja_id, orden_sorteo, tipo')
    .eq('torneo_id', torneoId);

  if (error) {
    console.error('Error cargando sorteos:', error);
    return [];
  }
  return data || [];
}
```

### Función 2: `guardarSorteoIntraGrupo(supabase, torneoId, grupoId, ordenParejas)`

Guarda el resultado de un sorteo intra-grupo. `ordenParejas` es `[{ pareja_id, orden_sorteo }]`.

```js
export async function guardarSorteoIntraGrupo(supabase, torneoId, grupoId, ordenParejas) {
  const payload = ordenParejas.map(op => ({
    torneo_id: torneoId,
    grupo_id: grupoId,
    pareja_id: op.pareja_id,
    orden_sorteo: op.orden_sorteo,
    tipo: 'intra_grupo'
  }));

  const { error } = await supabase
    .from('sorteos')
    .upsert(payload, { onConflict: 'torneo_id,pareja_id' });

  if (error) {
    console.error('Error guardando sorteo intra-grupo:', error);
    return { ok: false, msg: error.message };
  }
  return { ok: true };
}
```

### Función 3: `guardarSorteoInterGrupo(supabase, torneoId, ordenParejas)`

Guarda el resultado de un sorteo inter-grupo. Igual que intra pero sin `grupo_id` y con `tipo: 'inter_grupo'`.

```js
export async function guardarSorteoInterGrupo(supabase, torneoId, ordenParejas) {
  const payload = ordenParejas.map(op => ({
    torneo_id: torneoId,
    grupo_id: null,
    pareja_id: op.pareja_id,
    orden_sorteo: op.orden_sorteo,
    tipo: 'inter_grupo'
  }));

  const { error } = await supabase
    .from('sorteos')
    .upsert(payload, { onConflict: 'torneo_id,pareja_id' });

  if (error) {
    console.error('Error guardando sorteo inter-grupo:', error);
    return { ok: false, msg: error.message };
  }
  return { ok: true };
}
```

### Función 4: `resetSorteo(supabase, torneoId, grupoId)`

Borra sorteos. Si `grupoId` se pasa, borra solo los de ese grupo. Si no, borra todos del torneo.

```js
export async function resetSorteo(supabase, torneoId, grupoId) {
  let query = supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', torneoId);

  if (grupoId) {
    query = query.eq('grupo_id', grupoId);
  }

  const { error } = await query;

  if (error) {
    console.error('Error reseteando sorteo:', error);
    return { ok: false, msg: error.message };
  }
  return { ok: true };
}
```

**Nota**: `guardarSorteoInterGrupo` y `resetSorteo` sin grupoId se usan en Etapa 4c. Se crean ahora para no tocar este archivo después.

---

## Archivos a modificar

### 1. `src/utils/tablaPosiciones.js` — `cargarOverrides` (línea 260)

Cambiar la query de `posiciones_manual` a `sorteos`.

**Antes** (líneas 260-280):
```js
export async function cargarOverrides(supabase, torneoId, grupoId) {
  const { data, error } = await supabase
    .from('posiciones_manual')
    .select('pareja_id, orden_manual')
    .eq('torneo_id', torneoId)
    .eq('grupo_id', grupoId);

  if (error) {
    console.error('Error cargando overrides:', error);
    return {};
  }

  const overridesMap = {};
  (data || []).forEach(ov => {
    if (ov.orden_manual !== null) {
      overridesMap[ov.pareja_id] = ov.orden_manual;
    }
  });

  return overridesMap;
}
```

**Después**:
```js
export async function cargarOverrides(supabase, torneoId, grupoId) {
  const { data, error } = await supabase
    .from('sorteos')
    .select('pareja_id, orden_sorteo')
    .eq('torneo_id', torneoId)
    .eq('grupo_id', grupoId);

  if (error) {
    console.error('Error cargando overrides:', error);
    return {};
  }

  const overridesMap = {};
  (data || []).forEach(ov => {
    if (ov.orden_sorteo !== null) {
      overridesMap[ov.pareja_id] = ov.orden_sorteo;
    }
  });

  return overridesMap;
}
```

**Cambios**:
- `.from('posiciones_manual')` → `.from('sorteos')`
- `.select('pareja_id, orden_manual')` → `.select('pareja_id, orden_sorteo')`
- `ov.orden_manual` → `ov.orden_sorteo` (2 ocurrencias)

**Impacto**: Todos los consumers de `cargarOverrides` se actualizan automáticamente:
- `src/general.js:176`
- `src/viewer.js:355`
- `src/viewer/vistaPersonal.js:357, 459`
- `src/viewer/modalConsulta.js:308`

---

### 2. `src/admin/groups/service.js` — 3 cambios

#### Cambio A: `cargarGrupoCierre` (líneas 247-258)

Cambiar la query directa de `posiciones_manual` a `sorteos`.

**Antes** (líneas 247-258):
```js
  const { data: ov, error: errOv } = await supabase
    .from('posiciones_manual')
    .select('pareja_id, orden_manual')
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupo.id);

  if (errOv) console.error(errOv);

  const ovMap = {};
  (ov || []).forEach(x => {
    if (x.orden_manual !== null) ovMap[x.pareja_id] = x.orden_manual;
  });
```

**Después**:
```js
  const { data: ov, error: errOv } = await supabase
    .from('sorteos')
    .select('pareja_id, orden_sorteo')
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupo.id);

  if (errOv) console.error(errOv);

  const ovMap = {};
  (ov || []).forEach(x => {
    if (x.orden_sorteo !== null) ovMap[x.pareja_id] = x.orden_sorteo;
  });
```

**Cambios**:
- `.from('posiciones_manual')` → `.from('sorteos')`
- `.select('pareja_id, orden_manual')` → `.select('pareja_id, orden_sorteo')`
- `x.orden_manual` → `x.orden_sorteo`

#### Cambio B: `guardarOrdenGrupo` (líneas 284-308)

Cambiar para escribir a `sorteos` con el formato correcto.

**Antes** (líneas 288-297):
```js
  const payload = g.rows.map((r, i) => ({
    torneo_id: TORNEO_ID,
    grupo_id: groupId,
    pareja_id: r.pareja_id,
    orden_manual: i + 1
  }));

  const { error } = await supabase
    .from('posiciones_manual')
    .upsert(payload, { onConflict: 'torneo_id,grupo_id,pareja_id' });
```

**Después**:
```js
  const payload = g.rows.map((r, i) => ({
    torneo_id: TORNEO_ID,
    grupo_id: groupId,
    pareja_id: r.pareja_id,
    orden_sorteo: i + 1,
    tipo: 'intra_grupo'
  }));

  const { error } = await supabase
    .from('sorteos')
    .upsert(payload, { onConflict: 'torneo_id,pareja_id' });
```

**Cambios**:
- `orden_manual: i + 1` → `orden_sorteo: i + 1, tipo: 'intra_grupo'`
- `.from('posiciones_manual')` → `.from('sorteos')`
- `onConflict: 'torneo_id,grupo_id,pareja_id'` → `onConflict: 'torneo_id,pareja_id'` (la tabla `sorteos` tiene UNIQUE en `torneo_id, pareja_id`, no incluye `grupo_id`)

También cambiar el logMsg (línea 305):
- `logMsg('✅ Orden manual guardado para grupo ...')` → `logMsg('✅ Sorteo guardado para grupo ...')`

#### Cambio C: `resetOrdenGrupo` (líneas 310-328)

**Antes** (líneas 314-318):
```js
  const { error } = await supabase
    .from('posiciones_manual')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', groupId);
```

**Después**:
```js
  const { error } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', groupId);
```

También cambiar el logMsg (línea 326):
- `logMsg('🧽 Orden manual reseteado para grupo ...')` → `logMsg('🧽 Sorteo reseteado para grupo ...')`

---

### 3. `src/carga/posiciones.js` — `cargarOverridesPosiciones` (líneas 9-28)

Esta función carga overrides de TODOS los grupos a la vez (no por grupo individual).

**Antes** (líneas 9-28):
```js
async function cargarOverridesPosiciones(supabase, torneoId) {
  const { data, error } = await supabase
    .from('posiciones_manual')
    .select('grupo_id, pareja_id, orden_manual')
    .eq('torneo_id', torneoId);

  if (error) {
    console.error('Error cargando posiciones_manual', error);
    return {};
  }

  const map = {}; // grupoId -> { parejaId -> orden }
  (data || []).forEach(r => {
    if (r.orden_manual == null) return;
    if (!map[r.grupo_id]) map[r.grupo_id] = {};
    map[r.grupo_id][r.pareja_id] = r.orden_manual;
  });

  return map;
}
```

**Después**:
```js
async function cargarOverridesPosiciones(supabase, torneoId) {
  const { data, error } = await supabase
    .from('sorteos')
    .select('grupo_id, pareja_id, orden_sorteo')
    .eq('torneo_id', torneoId);

  if (error) {
    console.error('Error cargando sorteos', error);
    return {};
  }

  const map = {}; // grupoId -> { parejaId -> orden }
  (data || []).forEach(r => {
    if (r.orden_sorteo == null) return;
    if (!map[r.grupo_id]) map[r.grupo_id] = {};
    map[r.grupo_id][r.pareja_id] = r.orden_sorteo;
  });

  return map;
}
```

**Cambios**:
- `.from('posiciones_manual')` → `.from('sorteos')`
- `.select('grupo_id, pareja_id, orden_manual')` → `.select('grupo_id, pareja_id, orden_sorteo')`
- `'Error cargando posiciones_manual'` → `'Error cargando sorteos'`
- `r.orden_manual` → `r.orden_sorteo` (2 ocurrencias)

---

### 4. `src/admin.js` — Cleanup en reset (línea 117-129)

Agregar limpieza de `sorteos` ADEMÁS de `posiciones_manual` (ambas se limpian durante la transición).

**Antes** (líneas 117-129):
```js
  // Limpiar posiciones manuales (opcional pero recomendado)
  const { error: errorPos, count: countPos } = await supabase
    .from('posiciones_manual')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .select('id', { count: 'exact', head: false });

  if (errorPos) {
    console.error(errorPos);
    logMsg('⚠️ Error limpiando posiciones manuales (ver consola)');
  } else {
    logMsg(`✅ Posiciones manuales limpiadas: ${countPos || 0}`);
  }
```

**Después** (agregar DESPUÉS del bloque existente, no reemplazar):
```js
  // Limpiar sorteos
  const { error: errorSorteos } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', TORNEO_ID);

  if (errorSorteos) {
    console.error(errorSorteos);
    logMsg('⚠️ Error limpiando sorteos (ver consola)');
  } else {
    logMsg('✅ Sorteos limpiados');
  }
```

**Nota**: Se mantiene el bloque de `posiciones_manual` por seguridad. En Etapa 5 (cleanup) se puede remover.

---

### 5. `src/admin/parejas/parejasImport.js` — Cleanup en import (línea 224)

Agregar `sorteos` a la lista de tablas a borrar.

**Antes** (líneas 220-227):
```js
  const steps = [
    { table: 'partidos', msg: '🧹 Eliminando partidos…' },
    { table: 'copas', msg: '🧹 Eliminando copas…' },
    { table: 'esquemas_copa', msg: '🧹 Eliminando esquemas de copa…' },
    { table: 'posiciones_manual', msg: '🧹 Eliminando overrides…' },
    { table: 'parejas', msg: '🧹 Eliminando parejas…' },
    { table: 'grupos', msg: '🧹 Eliminando grupos…' }
  ];
```

**Después**:
```js
  const steps = [
    { table: 'partidos', msg: '🧹 Eliminando partidos…' },
    { table: 'copas', msg: '🧹 Eliminando copas…' },
    { table: 'esquemas_copa', msg: '🧹 Eliminando esquemas de copa…' },
    { table: 'sorteos', msg: '🧹 Eliminando sorteos…' },
    { table: 'posiciones_manual', msg: '🧹 Eliminando overrides…' },
    { table: 'parejas', msg: '🧹 Eliminando parejas…' },
    { table: 'grupos', msg: '🧹 Eliminando grupos…' }
  ];
```

**Cambio**: Agregar `{ table: 'sorteos', msg: '🧹 Eliminando sorteos…' }` ANTES de `posiciones_manual` (por si hubiera FKs).

---

### 6. `src/admin/groups/ui.js` — Cambios de UI

#### Cambio A: Badge de override (líneas 72-76)

**Antes**:
```js
  if (g.hasSavedOverride) {
    flags.appendChild(
      el('span', { style: 'margin-left:8px;' }, `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #0b7285; background:#e6fcff;">📌 Orden manual</span>`)
    );
  }
```

**Después**:
```js
  if (g.hasSavedOverride) {
    flags.appendChild(
      el('span', { style: 'margin-left:8px;' }, `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #0b7285; background:#e6fcff;">🎲 Sorteo guardado</span>`)
    );
  }
```

#### Cambio B: Texto de botones (líneas 51-52)

**Antes**:
```html
        <button type="button" data-action="save">Guardar orden final</button>
        <button type="button" data-action="reset">Reset orden manual</button>
```

**Después**:
```html
        <button type="button" data-action="save">💾 Guardar sorteo</button>
        <button type="button" data-action="reset">🧽 Reset sorteo</button>
```

#### Cambio C: Mensaje guía cuando hay empates (líneas 66-70)

Cuando hay empates, agregar un mensaje de guía debajo del badge existente.

**Antes** (líneas 66-70):
```js
  if (g.tieLabel) {
    flags.appendChild(
      el('span', {}, `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #d39e00; background:#fff3cd;">⚠️ ${g.tieLabel}</span>`)
    );
  }
```

**Después**:
```js
  if (g.tieLabel) {
    flags.appendChild(
      el('span', {}, `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #d39e00; background:#fff3cd;">⚠️ ${g.tieLabel}</span>`)
    );
    if (g.editableBase && !g.hasSavedOverride) {
      flags.appendChild(
        el('p', { style: 'margin:6px 0 0; font-size:13px; color:#856404;' },
          '🎲 Realizá un sorteo físico, ordená los empatados con ▲▼ y guardá el resultado.')
      );
    }
  }
```

La guía solo se muestra si:
- `editableBase` es true (todos los partidos del grupo jugados)
- `hasSavedOverride` es false (no hay sorteo guardado aún)

---

## Verificación

### 1. Build
```bash
npm run build
```
Sin errores.

### 2. Test funcional — Tab Grupos

**Precondición**: Tener un torneo con grupos donde haya empates reales (mismos P, DS, DG, GF, sin H2H que desempate).

1. Abrir admin.html → Tab Grupos
2. Verificar que los grupos con empates muestran:
   - Badge "⚠️ Empate real: N"
   - Mensaje "🎲 Realizá un sorteo físico..."
   - Botones "💾 Guardar sorteo" y "🧽 Reset sorteo"
3. Reordenar parejas empatadas con ▲/▼
4. Click "💾 Guardar sorteo"
   - Verificar en BD: `SELECT * FROM sorteos WHERE torneo_id = 'ad58a855-...'`
   - Debe haber filas con `tipo = 'intra_grupo'`
5. Recargar la página → el orden se mantiene
6. Verificar que el badge dice "🎲 Sorteo guardado"
7. Verificar que el mensaje guía desapareció
8. Click "🧽 Reset sorteo" → vuelve al orden automático, badge desaparece

### 3. Test funcional — Vista del jugador

1. Abrir index.html → buscar un jugador del grupo con sorteo
2. Verificar que la tabla de posiciones del grupo refleja el orden del sorteo
3. Abrir modal "Tablas/Grupos/Fixture" → Tab Grupos → verificar posiciones

### 4. Test funcional — Carga de resultados

1. Abrir carga.html → verificar que las posiciones se muestran correctamente con sorteo aplicado

### 5. Test de regresión

1. Admin → Tab Copas → verificar que el wizard y el flujo de copas siguen funcionando
2. Si hay copas en curso, verificar que se muestran correctamente
3. Reset de torneo desde admin → verificar que se limpian sorteos

### 6. Build final
```bash
npm run build
```
Sin errores ni warnings nuevos.

---

## Notas para el implementador

1. **No borrar ni modificar la tabla `posiciones_manual`** en BD. Queda como legacy.
2. **No borrar el código que limpia `posiciones_manual`** en admin.js y parejasImport.js. Solo agregar la limpieza de `sorteos` adicionalmente.
3. La tabla `sorteos` tiene `UNIQUE (torneo_id, pareja_id)`, no `UNIQUE (torneo_id, grupo_id, pareja_id)`. El `onConflict` en los upserts debe ser `'torneo_id,pareja_id'`.
4. El archivo `copaDecisionService.js` se crea con las 4 funciones, aunque `guardarSorteoInterGrupo` no se usa hasta Etapa 4c. Se crea ahora para no tocar el archivo después.
5. Los imports del nuevo `copaDecisionService.js` NO se agregan en ningún archivo aún — las funciones de `service.js` siguen haciendo las queries directamente. `copaDecisionService.js` se usa desde `statusView.js` en Etapa 4c.
6. **El flujo UX no cambia**: sigue siendo ▲/▼ para reordenar + botón para guardar. Lo que cambia es la tabla destino y la terminología ("sorteo" en vez de "orden manual").

---

## Modelo recomendado

**Sonnet**. Los cambios son mecánicos pero hay muchos archivos involucrados y necesita cuidado con los field names (`orden_manual` → `orden_sorteo`, `onConflict` keys).

---

## Prompt de implementación

```
Implementá los cambios descritos en docs/etapa3-sorteo-service-ui.md

Son cambios en 7 archivos: 1 nuevo (copaDecisionService.js) y 6 modificaciones.
El documento lista cada cambio con el código antes/después exacto.

Seguí las instrucciones al pie de la letra:
- Crear copaDecisionService.js con las 4 funciones exportadas
- En tablaPosiciones.js: cambiar cargarOverrides de posiciones_manual a sorteos
- En groups/service.js: cambiar los 3 puntos (cargarGrupoCierre, guardarOrdenGrupo, resetOrdenGrupo)
- En carga/posiciones.js: cambiar cargarOverridesPosiciones
- En admin.js: AGREGAR limpieza de sorteos (no reemplazar posiciones_manual)
- En parejasImport.js: AGREGAR sorteos al array de steps
- En groups/ui.js: cambiar textos de badges y botones, agregar mensaje guía

NO borrar código de posiciones_manual, solo agregar sorteos donde corresponda.

Después de implementar, corré npm run build para verificar.

Al finalizar:
- Actualizá docs/brainstorming-proximas-mejoras.md (mover ítems completados al historial)
- Ejecutá npm version patch y hacé push a git
```
