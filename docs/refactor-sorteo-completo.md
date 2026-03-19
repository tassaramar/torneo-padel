# Refactor Sorteo — Guardar solo empatados + Sorteo inter-grupo + Superíndices + RPC simplificado

## Resumen

Refactor completo del sistema de sorteo y ranking:
1. **Fase 1**: RPC simplificado — solo devuelve stats crudas, sin calcular posiciones
2. **Fase 2**: Cliente calcula `posicion_en_grupo` con el algoritmo completo (H2H + dominator chain + sorteo)
3. **Fase 3**: `guardarSorteo` graba solo equipos del cluster empatado (no todos)
4. **Fase 4**: UI de sorteo muestra flechas ▲▼ solo para equipos empatados
5. **Fase 5**: Superíndices muestran solo para equipos con sorteo, con label del cluster
6. **Fase 6**: Sorteo inter-grupo en tab General de Tab Grupos
7. **Fase 7**: `cmpStandings` usa sorteo inter-grupo para ranking cross-grupo
8. **Fase 8**: Tabla General en index.html muestra superíndices de sorteo inter-grupo

---

## Contexto actual

### Algoritmo de ordenamiento intra-grupo (`compararParejas` en tablaPosiciones.js)
```
P DESC → DS DESC → DG DESC → GF DESC → H2H → Nombre ASC
```
Empates circulares de H2H se resuelven con dominator chain en `ordenarConOverrides`.

### Algoritmo de ordenamiento cross-grupo (`cmpStandings` en copaMatchups.js)
```
posicion_en_grupo ASC → puntos DESC → ds DESC → dg DESC → gf DESC → sorteo_orden ASC (solo mismo grupo) → nombre ASC
```

### Problema 1 — RPC calcula `posicion_en_grupo` sin H2H
El RPC `obtener_standings_torneo` usa `ROW_NUMBER()` para calcular `posicion_en_grupo`, pero el ORDER BY no incluye H2H (enfrentamiento directo). Esto significa que cuando dos equipos tienen stats idénticas pero uno le ganó al otro, el RPC puede asignarles posiciones invertidas. El cliente (JS) SÍ tiene H2H via `compararParejas` + dominator chain.

**Solución**: El RPC pasa a devolver solo stats crudas. El cliente calcula `posicion_en_grupo` con el algoritmo completo.

### Problema 2 — Sorteo guarda todas las posiciones
`guardarOrdenGrupo` (service.js:289-295) graba `orden_sorteo = 1..N` para TODOS los equipos del grupo. Esto:
- Muestra superíndice para todos, incluso los que no empataron
- Los valores de sorteo intra-grupo "se filtran" al ranking cross-grupo
- No escala para grupos grandes con múltiples clusters de empate independientes

### Tabla `sorteos` (ya existe)
```sql
CREATE TABLE sorteos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id     UUID NOT NULL REFERENCES torneos(id),
  grupo_id      UUID REFERENCES grupos(id),  -- NULL para inter_grupo
  pareja_id     UUID NOT NULL REFERENCES parejas(id),
  orden_sorteo  INTEGER NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('intra_grupo', 'inter_grupo')),
  UNIQUE (torneo_id, pareja_id)  -- ← CAMBIAR a (torneo_id, pareja_id, tipo)
);
```

---

## Cambio 0 — Migración SQL

**Archivo**: `supabase/migrations/YYYYMMDDHHMMSS_refactor_sorteo.sql`

### 0a. Cambiar UNIQUE constraint

```sql
-- Permitir que una pareja tenga sorteo intra_grupo E inter_grupo
ALTER TABLE public.sorteos DROP CONSTRAINT IF EXISTS sorteos_torneo_id_pareja_id_key;
ALTER TABLE public.sorteos ADD CONSTRAINT sorteos_torneo_pareja_tipo_key
  UNIQUE (torneo_id, pareja_id, tipo);
```

### 0b. Limpiar sorteos existentes (datos inconsistentes del modelo viejo)

```sql
-- Borrar todos los sorteos existentes — el admin los re-creará con el nuevo modelo
DELETE FROM public.sorteos;
```

### 0c. Simplificar RPC `obtener_standings_torneo`

El RPC deja de calcular `posicion_en_grupo`. Solo devuelve stats crudas + sorteos + grupo_completo. El cliente calcula las posiciones con su propio algoritmo (que incluye H2H, dominator chain, sorteo).

```sql
CREATE OR REPLACE FUNCTION public.obtener_standings_torneo(p_torneo_id UUID)
RETURNS TABLE (
  grupo_id          UUID,
  pareja_id         UUID,
  puntos            INTEGER,
  ds                INTEGER,
  gf                INTEGER,
  gc                INTEGER,
  dg                INTEGER,
  grupo_completo    BOOLEAN,
  sorteo_orden      INTEGER,          -- intra-grupo
  sorteo_inter      INTEGER           -- inter-grupo
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH partidos_torneo AS (
    SELECT p.*
    FROM partidos p
    JOIN grupos g ON p.grupo_id = g.id
    WHERE g.torneo_id = p_torneo_id
      AND p.copa_id IS NULL
  ),
  stats AS (
    SELECT
      g.id AS grupo_id,
      par.id AS pareja_id,
      COALESCE(SUM(
        CASE
          WHEN (par.id = p.pareja_a_id AND p.sets_a > p.sets_b)
            OR (par.id = p.pareja_b_id AND p.sets_b > p.sets_a)
          THEN 2
          WHEN p.sets_a IS NOT NULL THEN 1
          ELSE 0
        END
      ), 0)::integer AS puntos,
      COALESCE(SUM(
        CASE WHEN par.id = p.pareja_a_id THEN p.sets_a - p.sets_b
             WHEN par.id = p.pareja_b_id THEN p.sets_b - p.sets_a
             ELSE 0 END
      ), 0)::integer AS ds,
      COALESCE(SUM(
        CASE WHEN par.id = p.pareja_a_id
             THEN COALESCE(p.games_a1,0)+COALESCE(p.games_a2,0)+COALESCE(p.games_a3,0)
             WHEN par.id = p.pareja_b_id
             THEN COALESCE(p.games_b1,0)+COALESCE(p.games_b2,0)+COALESCE(p.games_b3,0)
             ELSE 0 END
      ), 0)::integer AS gf,
      COALESCE(SUM(
        CASE WHEN par.id = p.pareja_a_id
             THEN COALESCE(p.games_b1,0)+COALESCE(p.games_b2,0)+COALESCE(p.games_b3,0)
             WHEN par.id = p.pareja_b_id
             THEN COALESCE(p.games_a1,0)+COALESCE(p.games_a2,0)+COALESCE(p.games_a3,0)
             ELSE 0 END
      ), 0)::integer AS gc
    FROM grupos g
    JOIN parejas par ON par.grupo_id = g.id
    LEFT JOIN partidos_torneo p
      ON (par.id = p.pareja_a_id OR par.id = p.pareja_b_id)
      AND p.sets_a IS NOT NULL
    WHERE g.torneo_id = p_torneo_id
    GROUP BY g.id, par.id
  ),
  gcomp AS (
    SELECT g.id AS grupo_id
    FROM grupos g
    WHERE g.torneo_id = p_torneo_id
      AND NOT EXISTS (
        SELECT 1 FROM partidos pp
        WHERE pp.grupo_id = g.id
          AND pp.copa_id IS NULL
          AND pp.sets_a IS NULL
      )
  )
  SELECT
    s.grupo_id,
    s.pareja_id,
    s.puntos,
    s.ds,
    s.gf,
    s.gc,
    (s.gf - s.gc)::integer AS dg,
    (gcomp.grupo_id IS NOT NULL) AS grupo_completo,
    so_intra.orden_sorteo AS sorteo_orden,
    so_inter.orden_sorteo AS sorteo_inter
  FROM stats s
  LEFT JOIN gcomp ON gcomp.grupo_id = s.grupo_id
  LEFT JOIN sorteos so_intra
    ON so_intra.torneo_id = p_torneo_id
    AND so_intra.pareja_id = s.pareja_id
    AND so_intra.tipo = 'intra_grupo'
  LEFT JOIN sorteos so_inter
    ON so_inter.torneo_id = p_torneo_id
    AND so_inter.pareja_id = s.pareja_id
    AND so_inter.tipo = 'inter_grupo';
$$;
```

**Cambios clave respecto al RPC actual**:
- **Eliminado**: CTE `ranked` con `ROW_NUMBER()` — ya no calcula `posicion_en_grupo`
- **Eliminado**: `posicion_en_grupo` del RETURNS TABLE
- Dos LEFT JOINs: `so_intra` (tipo='intra_grupo') y `so_inter` (tipo='inter_grupo')
- Retorna `sorteo_inter` como columna nueva
- El ORDER BY del resultado es irrelevante — el cliente ordena

---

## Cambio 0d — Cálculo client-side de `posicion_en_grupo`

El campo `posicion_en_grupo` ya no viene del RPC. Los callers que lo necesitan deben calcularlo.

### Nueva función utilitaria

**Archivo**: `src/utils/tablaPosiciones.js` — agregar función exportada al final del archivo:

```js
/**
 * Calcula posicion_en_grupo para standings crudos del RPC.
 * Agrupa por grupo_id, ordena con compararParejas (P → DS → DG → GF → H2H → sorteo → nombre),
 * y asigna posicion_en_grupo = 1, 2, 3... a cada equipo.
 *
 * @param {Array} standings  - Array de standings crudos del RPC (sin posicion_en_grupo)
 * @param {Array} partidos   - Array de TODOS los partidos de grupo del torneo (para H2H)
 * @param {Object} overridesMap - Map de pareja_id → orden_sorteo (intra-grupo, todos los grupos juntos)
 * @returns {Array} standings enriquecidos con posicion_en_grupo
 */
export function enriquecerConPosiciones(standings, partidos, overridesMap = {}) {
  // Agrupar por grupo_id
  const porGrupo = {};
  for (const s of standings) {
    if (!porGrupo[s.grupo_id]) porGrupo[s.grupo_id] = [];
    porGrupo[s.grupo_id].push(s);
  }

  const resultado = [];

  for (const [grupoId, equipos] of Object.entries(porGrupo)) {
    // Mapear standings a formato compatible con compararParejas
    // (compararParejas espera campos en MAYÚSCULAS: P, DS, DG, GF, etc.)
    const partidosDelGrupo = partidos.filter(p => p.grupo_id === grupoId);

    const tabla = equipos.map(s => ({
      ...s,
      pareja_id: s.pareja_id,
      P: s.puntos,
      DS: s.ds,
      DG: s.dg || (s.gf - (s.gc || 0)),
      GF: s.gf,
      GC: s.gc || 0,
      nombre: s.nombre || ''
    }));

    // Ordenar con overrides (dominator chain + H2H + sorteo intra-grupo)
    const ovMapGrupo = {};
    equipos.forEach(s => {
      if (s.sorteo_orden != null) ovMapGrupo[s.pareja_id] = s.sorteo_orden;
      if (overridesMap[s.pareja_id] != null) ovMapGrupo[s.pareja_id] = overridesMap[s.pareja_id];
    });

    const ordenada = ordenarConOverrides(tabla, ovMapGrupo, partidosDelGrupo);

    // Asignar posicion_en_grupo
    ordenada.forEach((row, idx) => {
      // Encontrar el standing original y enriquecerlo
      const orig = equipos.find(s => s.pareja_id === row.pareja_id);
      if (orig) {
        orig.posicion_en_grupo = idx + 1;
        resultado.push(orig);
      }
    });
  }

  return resultado;
}
```

**Nota sobre `partidos`**: esta función necesita los partidos de grupo para calcular H2H. Los callers deben cargar los partidos.

### Callers que deben adaptarse

#### Caller 1: `cargarStandingsParaCopas` (planService.js:252)

Actualmente llama al RPC y usa `posicion_en_grupo` directamente. Ahora debe:
1. Cargar partidos de grupo del torneo (query adicional)
2. Llamar `enriquecerConPosiciones(standings, partidos)` después de recibir los standings

**Código actual** (planService.js:252-272):
```js
export async function cargarStandingsParaCopas(supabase, torneoId) {
  const [standingsRes, gruposRes, parejasRes] = await Promise.all([
    supabase.rpc('obtener_standings_torneo', { p_torneo_id: torneoId }),
    supabase.from('grupos').select('id, nombre').eq('torneo_id', torneoId),
    supabase.from('parejas').select('id, nombre').eq('torneo_id', torneoId)
  ]);
  // ... enriquecer con nombres ...
}
```

**Código nuevo**:
```js
export async function cargarStandingsParaCopas(supabase, torneoId) {
  const [standingsRes, gruposRes, parejasRes, partidosRes] = await Promise.all([
    supabase.rpc('obtener_standings_torneo', { p_torneo_id: torneoId }),
    supabase.from('grupos').select('id, nombre').eq('torneo_id', torneoId),
    supabase.from('parejas').select('id, nombre').eq('torneo_id', torneoId),
    supabase.from('partidos')
      .select('id, grupo_id, pareja_a_id, pareja_b_id, sets_a, sets_b, games_a1, games_b1, games_a2, games_b2, games_a3, games_b3')
      .eq('torneo_id', torneoId)
      .is('copa_id', null)
      .not('sets_a', 'is', null)
  ]);

  const grupos = gruposRes.data || [];
  const parejasMap = Object.fromEntries((parejasRes.data || []).map(p => [p.id, p.nombre]));
  const gruposMap = Object.fromEntries(grupos.map(g => [g.id, g.nombre]));
  const partidos = partidosRes.data || [];

  // Enriquecer con nombres ANTES de calcular posiciones (para H2H necesita poder identificar equipos)
  let standings = (standingsRes.data || []).map(s => ({
    ...s,
    nombre:      parejasMap[s.pareja_id] || '?',
    grupoNombre: gruposMap[s.grupo_id]   || '?'
  }));

  // Calcular posicion_en_grupo client-side (con H2H + dominator chain + sorteo)
  standings = enriquecerConPosiciones(standings, partidos);

  const gruposCompletosIds = new Set(standings.filter(s => s.grupo_completo).map(s => s.grupo_id));
  const todosCompletos = grupos.length > 0 && grupos.every(g => gruposCompletosIds.has(g.id));

  return { standings, grupos, todosCompletos };
}
```

**Import nuevo** en planService.js:
```js
import { enriquecerConPosiciones } from '../utils/tablaPosiciones.js';
```

**Nota**: la query de partidos filtra `copa_id IS NULL` (solo partidos de grupo) y `sets_a IS NOT NULL` (solo con resultado). Esto es lo mismo que hacía el RPC internamente.

#### Caller 2: `renderTablaGeneral` (modalConsulta.js:384)

Actualmente llama al RPC y ordena por `posicion_en_grupo`. Ahora debe calcular posiciones client-side.

**Código actual** (modalConsulta.js:384-424):
```js
async function renderTablaGeneral(container) {
  // ... carga lazy de standings via RPC ...
  // ... enriched.sort por posicion_en_grupo ...
}
```

**Código nuevo**: después de cargar standings del RPC, debe:
1. Cargar partidos de grupo (puede reusar del cache si están disponibles)
2. Llamar `enriquecerConPosiciones(standings, partidos)`
3. Ordenar por `posicion_en_grupo` (ahora calculado client-side)

```js
async function renderTablaGeneral(container) {
  const { cache, identidad, supabase, torneoId } = modalState;

  if (cache && !cache.standings) {
    container.innerHTML = '<p class="modal-empty">Cargando tabla general...</p>';
    try {
      const [standingsRes, partidosGrupo] = await Promise.all([
        supabase.rpc('obtener_standings_torneo', { p_torneo_id: torneoId }),
        // Partidos de grupo ya están en cache.partidos, pero filtrar solo grupo
        Promise.resolve(cache.partidos?.filter(p => !p.copa_id && p.sets_a != null) || [])
      ]);
      if (standingsRes.error) throw standingsRes.error;

      // Enriquecer con nombres
      const parejasMap = Object.fromEntries((cache.parejas || []).map(p => [p.id, p.nombre]));
      const gruposMap = Object.fromEntries((cache.grupos || []).map(g => [g.id, g.nombre]));
      let standings = (standingsRes.data || []).map(s => ({
        ...s,
        parejaNombre: parejasMap[s.pareja_id] || '—',
        nombre: parejasMap[s.pareja_id] || '—',
        grupoNombre: gruposMap[s.grupo_id] || '—'
      }));

      // Calcular posicion_en_grupo client-side
      standings = enriquecerConPosiciones(standings, partidosGrupo);

      cache.standings = standings;
    } catch (e) {
      console.error('Error cargando standings:', e);
      container.innerHTML = '<p class="modal-empty">Error cargando tabla general</p>';
      return;
    }
  }

  // ... resto del render igual, usando posicion_en_grupo calculado client-side ...
}
```

**Import nuevo** en modalConsulta.js (agregar al import existente de tablaPosiciones.js):
```js
import {
  calcularTablaGrupo as calcularTablaGrupoCentral,
  ordenarConOverrides,
  detectarEmpatesReales,
  cargarOverrides,
  agregarMetadataOverrides,
  enriquecerConPosiciones    // NUEVO
} from '../utils/tablaPosiciones.js';
```

**Nota**: `cache.partidos` ya contiene todos los partidos (incluidos grupo y copa). Se filtra por `!p.copa_id` para obtener solo partidos de grupo. Si `cache.partidos` no tiene `grupo_id` directamente, usar `p.grupos?.id` según el formato de la query existente en el cache.

### Callers que NO necesitan adaptarse

- `cmpStandings` (copaMatchups.js) — recibe standings ya enriquecidos con `posicion_en_grupo`
- `armarPoolParaCopa` (copaMatchups.js) — idem
- `detectarEmpates` (copaMatchups.js) — idem
- `_renderTablaGeneral` (statusView.js) — recibe standings ya enriquecidos

---

## Cambio 1 — `guardarOrdenGrupo` (solo empatados)

**Archivo**: `src/admin/groups/service.js` — función `guardarOrdenGrupo` (línea 285)

### Código actual (reemplazar COMPLETO):

```js
export async function guardarOrdenGrupo(groupId) {
  const g = state.groups[groupId];
  if (!g) return false;

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
  // ...
}
```

### Código nuevo (reemplazar COMPLETO):

```js
export async function guardarOrdenGrupo(groupId) {
  const g = state.groups[groupId];
  if (!g) return false;

  // Solo guardar equipos que pertenecen a un cluster de empate.
  // g.tieGroups contiene los clusters detectados por detectarEmpatesReales.
  // Cada cluster tiene parejaIds: [id1, id2, ...].
  const tiedIds = new Set();
  if (g.tieGroups) {
    g.tieGroups.forEach(tg => tg.parejaIds.forEach(id => tiedIds.add(id)));
  }

  // También incluir equipos que YA tenían sorteo guardado (ovMap),
  // por si el admin está re-ordenando un cluster ya sorteado.
  if (g.ovMap) {
    Object.keys(g.ovMap).forEach(id => tiedIds.add(id));
  }

  if (tiedIds.size === 0) {
    logMsg('⚠️ No hay empates que requieran sorteo');
    return false;
  }

  // Determinar orden relativo dentro de cada cluster.
  // Recorrer g.rows en orden de la UI; asignar orden_sorteo 1, 2, 3...
  // solo a los que están en tiedIds. El orden es por cluster:
  // identificar clusters contiguos en g.rows.
  const payload = [];
  let currentClusterOrder = 0;
  let prevWasTied = false;

  g.rows.forEach(r => {
    if (tiedIds.has(r.pareja_id)) {
      if (!prevWasTied) currentClusterOrder = 0; // nuevo cluster
      currentClusterOrder++;
      payload.push({
        torneo_id: TORNEO_ID,
        grupo_id: groupId,
        pareja_id: r.pareja_id,
        orden_sorteo: currentClusterOrder,
        tipo: 'intra_grupo'
      });
      prevWasTied = true;
    } else {
      prevWasTied = false;
    }
  });

  // Primero borrar sorteos intra_grupo existentes de este grupo
  const { error: errDel } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', groupId)
    .eq('tipo', 'intra_grupo');

  if (errDel) {
    console.error(errDel);
    logMsg('❌ Error limpiando sorteos previos');
    return false;
  }

  // Luego insertar los nuevos
  const { error } = await supabase
    .from('sorteos')
    .insert(payload);

  if (error) {
    console.error(error);
    logMsg('❌ Error guardando sorteo');
    return false;
  }

  logMsg(`✅ Sorteo guardado para grupo ${g.grupo.nombre}`);
  state.groups[groupId].hasSavedOverride = true;
  return true;
}
```

**Nota**: ya no usa `upsert` con `onConflict: 'torneo_id,pareja_id'` porque la UNIQUE constraint cambió. Usa delete + insert.

---

## Cambio 2 — `resetOrdenGrupo` (agregar filtro por tipo)

**Archivo**: `src/admin/groups/service.js` — función `resetOrdenGrupo` (línea 312)

### Código actual:
```js
const { error } = await supabase
  .from('sorteos')
  .delete()
  .eq('torneo_id', TORNEO_ID)
  .eq('grupo_id', groupId);
```

### Código nuevo (agregar `.eq('tipo', 'intra_grupo')`):
```js
const { error } = await supabase
  .from('sorteos')
  .delete()
  .eq('torneo_id', TORNEO_ID)
  .eq('grupo_id', groupId)
  .eq('tipo', 'intra_grupo');
```

Esto evita que resetear un grupo borre accidentalmente sorteos inter-grupo.

---

## Cambio 3 — `cargarOverrides` (agregar filtro por tipo)

**Archivo**: `src/utils/tablaPosiciones.js` — función `cargarOverrides` (línea 260)

### Agregar parámetro `tipo` con default:

```js
export async function cargarOverrides(supabase, torneoId, grupoId, tipo = 'intra_grupo') {
  const query = supabase
    .from('sorteos')
    .select('pareja_id, orden_sorteo')
    .eq('torneo_id', torneoId)
    .eq('tipo', tipo);

  // grupo_id puede ser NULL para inter_grupo
  if (grupoId) {
    query.eq('grupo_id', grupoId);
  } else {
    query.is('grupo_id', null);
  }

  const { data, error } = await query;

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

**Callers existentes** (`service.js:247`, `modalConsulta.js:308`, `vistaPersonal.js`, `carga/posiciones.js`, `general.js`): todos pasan `(supabase, torneoId, grupoId)` → el default `tipo = 'intra_grupo'` mantiene compatibilidad. **No requieren cambios.**

---

## Cambio 4 — UI de sorteo: flechas ▲▼ solo para empatados

**Archivo**: `src/admin/groups/ui.js` — función `updateTablaBody` (línea 133)

### 4a. Flechas ▲▼ solo para equipos empatados

Actualmente (líneas 180-190), los botones ▲▼ se muestran para todos y se deshabilitan solo si `!editable` o están en los bordes. Cambiar para que solo se muestren para equipos en `tieSet`:

Reemplazar las líneas 180-190:

```js
// ACTUAL:
<td style="white-space:nowrap;">
  <button type="button" data-move="up" style="margin-right:6px;">▲</button>
  <button type="button" data-move="down">▼</button>
</td>
```

Con:

```js
<td style="white-space:nowrap;">
  ${tieColorMap[r.pareja_id] || (g.ovMap && g.ovMap[r.pareja_id] !== undefined)
    ? `<button type="button" data-move="up" style="margin-right:6px;">▲</button>
       <button type="button" data-move="down">▼</button>`
    : ''}
</td>
```

Y la lógica de disabled de los botones (líneas 186-190) debe ajustarse:
- `btnUp` disabled si `idx === 0` O si la fila de arriba NO es del mismo cluster
- `btnDown` disabled si `idx === g.rows.length - 1` O si la fila de abajo NO es del mismo cluster

Reemplazar la lógica de disabled (después de crear los botones):

```js
const btnUp = tr.querySelector('button[data-move="up"]');
const btnDown = tr.querySelector('button[data-move="down"]');

if (btnUp) {
  // Disabled si no es editable, o si es la primera fila del cluster
  const prevIsSameCluster = idx > 0 && isSameCluster(g, idx - 1, idx);
  btnUp.disabled = !editable || !prevIsSameCluster;
}
if (btnDown) {
  const nextIsSameCluster = idx < g.rows.length - 1 && isSameCluster(g, idx, idx + 1);
  btnDown.disabled = !editable || !nextIsSameCluster;
}
```

### 4b. Helper `isSameCluster`

Agregar función helper en `ui.js` (antes de `updateTablaBody`):

```js
/**
 * Determina si dos filas adyacentes pertenecen al mismo cluster de empate.
 * Dos filas son del mismo cluster si ambas están en tieSet O ambas tienen override.
 */
function isSameCluster(g, idxA, idxB) {
  const a = g.rows[idxA];
  const b = g.rows[idxB];
  if (!a || !b) return false;

  const aIsTied = g.tieSet?.has(a.pareja_id) || (g.ovMap && g.ovMap[a.pareja_id] !== undefined);
  const bIsTied = g.tieSet?.has(b.pareja_id) || (g.ovMap && g.ovMap[b.pareja_id] !== undefined);
  if (!aIsTied || !bIsTied) return false;

  // Además, deben tener las mismas stats base (mismo bucket de empate)
  return a.P === b.P && a.DS === b.DS && a.DG === b.DG && a.GF === b.GF;
}
```

### 4c. Botones "Guardar sorteo" y "Reset sorteo"

Actualmente se muestran siempre. Cambiar visibilidad:
- **"Guardar sorteo"**: visible solo si `g.tieSet?.size > 0` (hay empates sin resolver) O `g.hasSavedOverride` (hay sorteo guardado que se puede re-guardar)
- **"Reset sorteo"**: visible solo si `g.hasSavedOverride`

En `renderOrUpdateGrupoCard` (después de línea 100, donde están `btnSave` y `btnReset`):

```js
const btnSave = card.querySelector('button[data-action="save"]');
const btnReset = card.querySelector('button[data-action="reset"]');

const showSave = (g.tieSet?.size > 0 || g.hasSavedOverride) && isEditable(groupId);
const showReset = g.hasSavedOverride;

btnSave.style.display = showSave ? '' : 'none';
btnReset.style.display = showReset ? '' : 'none';
btnSave.disabled = !isEditable(groupId);
```

---

## Cambio 5 — Superíndices solo para empatados, con label de cluster

**Archivo**: `src/admin/groups/ui.js` — función `updateTablaBody` (línea 153)

### Código actual (líneas 156-159):
```js
let sup = '';
if (g.hasSavedOverride) {
  sup = ` <sup style="font-size:11px; color:#0b7285; font-weight:700; margin-left:3px;">${posActual}°</sup>`;
}
```

### Código nuevo:

El superíndice solo se muestra si el equipo tiene sorteo guardado (`ovMap`). El label indica el orden dentro del sorteo, no la posición global.

```js
let sup = '';
if (g.ovMap && g.ovMap[r.pareja_id] !== undefined) {
  const ordenSorteo = g.ovMap[r.pareja_id];
  sup = ` <sup style="font-size:11px; color:#0b7285; font-weight:700; margin-left:3px;">${ordenSorteo}°</sup>`;
}
```

**Nota**: `ordenSorteo` es 1, 2, 3 dentro del cluster. No es la posición global.

---

## Cambio 6 — Superíndices en vista del jugador (index.html)

### 6a. Tabla intra-grupo en `modalConsulta.js`

**Archivo**: `src/viewer/modalConsulta.js` — función `renderGrupoDetalle` (línea 293)

Actualmente la tabla del grupo NO muestra superíndices. Agregar superíndice para equipos con sorteo:

En la línea 356, donde se renderiza el nombre:
```js
<td class="nombre-col">${escapeHtml(row.nombre)}</td>
```

Cambiar a:
```js
<td class="nombre-col">${escapeHtml(row.nombre)}${
  row.tieneOverrideAplicado
    ? `<sup style="font-size:10px; color:#0b7285; font-weight:700; margin-left:2px;">${row.ordenManual}°</sup>`
    : ''
}</td>
```

`row.tieneOverrideAplicado` y `row.ordenManual` ya están disponibles gracias a `agregarMetadataOverrides` (línea 311).

### 6b. Tabla General en `modalConsulta.js`

**Archivo**: `src/viewer/modalConsulta.js` — función `renderTablaGeneral` (línea 384)

La tabla General usa el RPC `obtener_standings_torneo` que ahora retorna `sorteo_inter`. Mostrar superíndice cuando hay sorteo inter-grupo:

En la línea 461, donde se renderiza el nombre:
```js
<td class="nombre-col">${escapeHtml(row.parejaNombre)}</td>
```

Cambiar a:
```js
<td class="nombre-col">${escapeHtml(row.parejaNombre)}${
  row.sorteo_inter
    ? `<sup style="font-size:10px; color:#8b5cf6; font-weight:700; margin-left:2px;">${row.sorteo_inter}°</sup>`
    : ''
}${
  row.sorteo_orden
    ? `<sup style="font-size:10px; color:#0b7285; font-weight:700; margin-left:2px;">${row.sorteo_orden}°</sup>`
    : ''
}</td>
```

**Colores distintos**: intra-grupo = `#0b7285` (teal), inter-grupo = `#8b5cf6` (violeta). Esto diferencia visualmente ambos tipos de sorteo.

### 6c. Ordenamiento de tabla General

Actualmente (líneas 418-424) ordena por:
```js
enriched.sort((a, b) =>
  a.posicion_en_grupo - b.posicion_en_grupo ||
  b.puntos - a.puntos ||
  b.ds - a.ds ||
  b.gf - a.gf ||
  a.parejaNombre.localeCompare(b.parejaNombre)
);
```

Agregar `sorteo_inter` como tiebreaker (antes de nombre):
```js
enriched.sort((a, b) =>
  a.posicion_en_grupo - b.posicion_en_grupo ||
  b.puntos - a.puntos ||
  b.ds - a.ds ||
  (b.dg || 0) - (a.dg || 0) ||
  b.gf - a.gf ||
  (a.sorteo_inter || 0) - (b.sorteo_inter || 0) ||
  a.parejaNombre.localeCompare(b.parejaNombre)
);
```

**Nota**: también se agrega `dg` que faltaba en el sort original.

---

## Cambio 7 — Sorteo inter-grupo (Tab General en Tab Grupos de admin.html)

### Contexto

En `admin.html`, Tab Grupos muestra cada grupo como una card con tabla + flechas + sorteo. Necesitamos agregar una card "General" que muestre el ranking cross-grupo con la misma mecánica de sorteo para empates inter-grupo.

### 7a. Detectar empates inter-grupo

**Archivo**: `src/admin/groups/service.js`

Agregar nueva función exportada `cargarTablaGeneral`:

```js
export async function cargarTablaGeneral() {
  const { data, error } = await supabase.rpc('obtener_standings_torneo', {
    p_torneo_id: TORNEO_ID
  });

  if (error) {
    console.error(error);
    return { ok: false, msg: 'Error cargando tabla general' };
  }

  const standings = data || [];
  if (standings.length === 0) return { ok: false, msg: 'Sin datos' };

  // Enriquecer con nombres
  const gruposMap = {};
  Object.values(state.groups).forEach(g => {
    gruposMap[g.grupo.id] = g.grupo.nombre;
    g.rows.forEach(r => {
      const match = standings.find(s => s.pareja_id === r.pareja_id);
      if (match) match.nombre = r.nombre;
    });
  });

  // Ordenar: posicion_en_grupo ASC → stats → sorteo_inter ASC → nombre
  standings.sort((a, b) =>
    (a.posicion_en_grupo ?? 999) - (b.posicion_en_grupo ?? 999) ||
    (b.puntos - a.puntos) ||
    (b.ds - a.ds) ||
    ((b.dg || 0) - (a.dg || 0)) ||
    (b.gf - a.gf) ||
    ((a.sorteo_inter || 0) - (b.sorteo_inter || 0)) ||
    String(a.nombre || '').localeCompare(String(b.nombre || ''))
  );

  // Detectar clusters inter-grupo empatados.
  // Dos equipos están en empate inter-grupo si:
  //   - distinto grupo_id
  //   - misma posicion_en_grupo
  //   - mismos puntos, ds, dg, gf
  //   - ambos de grupo_completo
  const tiers = new Map(); // key: "pos|pts|ds|dg|gf" → [standing]
  standings.filter(s => s.grupo_completo).forEach(s => {
    const key = `${s.posicion_en_grupo}|${s.puntos}|${s.ds}|${s.dg || 0}|${s.gf}`;
    if (!tiers.has(key)) tiers.set(key, []);
    tiers.get(key).push(s);
  });

  const tieGroupsInter = [];
  const tieSetInter = new Set();

  for (const arr of tiers.values()) {
    // Solo es empate inter-grupo si hay equipos de >1 grupo
    const gruposDistintos = new Set(arr.map(s => s.grupo_id));
    if (gruposDistintos.size < 2) continue;
    if (arr.length < 2) continue;

    // Filtrar los que NO tienen sorteo inter-grupo
    const sinSorteo = arr.filter(s => !s.sorteo_inter);
    if (sinSorteo.length < 2) continue; // ya resuelto

    tieGroupsInter.push({
      parejaIds: arr.map(s => s.pareja_id),
      posicion: arr[0].posicion_en_grupo,
      stats: `${arr[0].puntos} pts, DS ${arr[0].ds}, DG ${arr[0].dg || 0}`
    });
    arr.forEach(s => tieSetInter.add(s.pareja_id));
  }

  // Cargar overrides inter-grupo existentes
  const { data: interSorteos, error: errInter } = await supabase
    .from('sorteos')
    .select('pareja_id, orden_sorteo')
    .eq('torneo_id', TORNEO_ID)
    .eq('tipo', 'inter_grupo');

  const interOvMap = {};
  (interSorteos || []).forEach(s => {
    if (s.orden_sorteo !== null) interOvMap[s.pareja_id] = s.orden_sorteo;
  });

  const hasSavedInterOverride = Object.keys(interOvMap).length > 0;

  state.general = {
    standings,
    gruposMap,
    tieGroupsInter,
    tieSetInter,
    interOvMap,
    hasSavedInterOverride
  };

  return { ok: true };
}
```

### 7b. Guardar / Reset sorteo inter-grupo

**Archivo**: `src/admin/groups/service.js`

```js
export async function guardarSorteoInterGrupo() {
  const gen = state.general;
  if (!gen) return false;

  const tiedIds = new Set();
  gen.tieGroupsInter.forEach(tg => tg.parejaIds.forEach(id => tiedIds.add(id)));
  if (gen.interOvMap) {
    Object.keys(gen.interOvMap).forEach(id => tiedIds.add(id));
  }

  if (tiedIds.size === 0) {
    logMsg('⚠️ No hay empates inter-grupo que requieran sorteo');
    return false;
  }

  // Recorrer standings en orden de la UI, asignar orden 1, 2, 3...
  // solo a los que están en tiedIds, reiniciando por cluster.
  const payload = [];
  let currentClusterOrder = 0;
  let prevWasTied = false;

  gen.standings.forEach(s => {
    if (tiedIds.has(s.pareja_id)) {
      if (!prevWasTied) currentClusterOrder = 0;
      currentClusterOrder++;
      payload.push({
        torneo_id: TORNEO_ID,
        grupo_id: null,
        pareja_id: s.pareja_id,
        orden_sorteo: currentClusterOrder,
        tipo: 'inter_grupo'
      });
      prevWasTied = true;
    } else {
      prevWasTied = false;
    }
  });

  // Borrar + insertar
  const { error: errDel } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('tipo', 'inter_grupo');

  if (errDel) {
    console.error(errDel);
    logMsg('❌ Error limpiando sorteos inter-grupo previos');
    return false;
  }

  const { error } = await supabase
    .from('sorteos')
    .insert(payload);

  if (error) {
    console.error(error);
    logMsg('❌ Error guardando sorteo inter-grupo');
    return false;
  }

  logMsg('✅ Sorteo inter-grupo guardado');
  return true;
}

export async function resetSorteoInterGrupo() {
  const { error } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('tipo', 'inter_grupo');

  if (error) {
    console.error(error);
    logMsg('❌ Error reseteando sorteo inter-grupo');
    return false;
  }

  logMsg('🧽 Sorteo inter-grupo reseteado');
  return true;
}
```

### 7c. UI — Card "Tabla General" en Tab Grupos

**Archivo**: `src/admin/groups/ui.js`

Agregar nueva función exportada `renderTablaGeneralCard`:

```js
export function renderTablaGeneralCard() {
  const gen = state.general;
  if (!gen || !gen.standings.length) return;

  let card = dom.contGrupos.querySelector('.admin-grupo[data-grupo-id="general"]');
  if (!card) {
    card = el('div', { class: 'admin-grupo', 'data-grupo-id': 'general' });
    dom.contGrupos.appendChild(card);
  }

  const { standings, gruposMap, tieGroupsInter, tieSetInter, interOvMap, hasSavedInterOverride } = gen;

  // Flags
  let flagsHtml = '';
  if (tieGroupsInter.length > 0 && !hasSavedInterOverride) {
    const labels = tieGroupsInter.map(tg =>
      `${tg.parejaIds.length} equipos en posición ${tg.posicion}°`
    ).join(', ');
    flagsHtml += `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #7c3aed; background:#ede9fe;">⚠️ Empate inter-grupo: ${labels}</span>`;
    flagsHtml += `<p style="margin:6px 0 0; font-size:13px; color:#6d28d9;">🎲 Realizá un sorteo físico, ordená los empatados con ▲▼ y guardá el resultado.</p>`;
  }
  if (hasSavedInterOverride) {
    flagsHtml += `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #7c3aed; background:#ede9fe; margin-left:8px;">🎲 Sorteo inter-grupo guardado</span>`;
  }

  // Construir rows
  let prevPos = null;
  let rowsHtml = '';
  standings.forEach((s, idx) => {
    if (prevPos !== null && s.posicion_en_grupo !== prevPos) {
      rowsHtml += `<tr><td colspan="8" style="border:none; height:4px; background:#e5e7eb;"></td></tr>`;
    }

    const isTied = tieSetInter.has(s.pareja_id) || (interOvMap[s.pareja_id] !== undefined);

    // Superíndice: sorteo inter-grupo
    let sup = '';
    if (interOvMap[s.pareja_id] !== undefined) {
      sup = ` <sup style="font-size:11px; color:#7c3aed; font-weight:700; margin-left:3px;">${interOvMap[s.pareja_id]}°</sup>`;
    }

    // Superíndice: sorteo intra-grupo
    if (s.sorteo_orden) {
      sup += ` <sup style="font-size:11px; color:#0b7285; font-weight:700; margin-left:3px;">${s.sorteo_orden}°</sup>`;
    }

    const grupoNombre = gruposMap[s.grupo_id] || '?';
    const dsStr = s.ds > 0 ? `+${s.ds}` : `${s.ds}`;

    rowsHtml += `<tr>
      <td>${idx + 1}</td>
      <td>${s.nombre || '—'}${sup}</td>
      <td style="text-align:center;">${grupoNombre}</td>
      <td style="text-align:center;">${s.posicion_en_grupo}°</td>
      <td style="text-align:center;"><strong>${s.puntos}</strong></td>
      <td style="text-align:center;">${dsStr}</td>
      <td style="text-align:center;">${s.gf}</td>
      <td style="white-space:nowrap;">
        ${isTied
          ? `<button type="button" data-move-inter="up" data-pareja="${s.pareja_id}" style="margin-right:4px;">▲</button>
             <button type="button" data-move-inter="down" data-pareja="${s.pareja_id}">▼</button>`
          : ''}
      </td>
    </tr>`;

    prevPos = s.posicion_en_grupo;
  });

  const showSave = tieGroupsInter.length > 0 || hasSavedInterOverride;
  const showReset = hasSavedInterOverride;

  card.innerHTML = `
    <div class="admin-grupo-header">
      <div>
        <h3 style="margin:0;">Tabla General</h3>
        <div class="admin-grupo-flags" style="margin-top:6px;">${flagsHtml}</div>
      </div>
    </div>
    <table class="tabla-posiciones" style="width:100%; margin-top:10px;">
      <thead>
        <tr>
          <th>#</th>
          <th>Pareja</th>
          <th>Grupo</th>
          <th>Pos.</th>
          <th>P</th>
          <th>DS</th>
          <th>GF</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="admin-actions" style="margin-top:10px;">
      <button type="button" data-action="save-inter" style="display:${showSave ? '' : 'none'}">💾 Guardar sorteo inter-grupo</button>
      <button type="button" data-action="reset-inter" style="display:${showReset ? '' : 'none'}">🧽 Reset sorteo inter-grupo</button>
    </div>
  `;

  // Event handlers — flechas ▲▼
  card.querySelectorAll('button[data-move-inter]').forEach(btn => {
    btn.onclick = () => {
      const parejaId = btn.dataset.pareja;
      const dir = btn.dataset.moveInter === 'up' ? -1 : 1;
      moverInterGrupo(parejaId, dir);
    };
  });

  // Guardar
  const btnSave = card.querySelector('button[data-action="save-inter"]');
  if (btnSave) {
    btnSave.onclick = async () => {
      btnSave.disabled = true;
      btnSave.textContent = 'Guardando…';
      await guardarSorteoInterGrupo();
      await cargarTablaGeneral();
      renderTablaGeneralCard();
      btnSave.textContent = '💾 Guardar sorteo inter-grupo';
      btnSave.disabled = false;
    };
  }

  // Reset
  const btnReset = card.querySelector('button[data-action="reset-inter"]');
  if (btnReset) {
    btnReset.onclick = async () => {
      btnReset.disabled = true;
      btnReset.textContent = 'Reseteando…';
      await resetSorteoInterGrupo();
      await cargarTablaGeneral();
      renderTablaGeneralCard();
      btnReset.textContent = '🧽 Reset sorteo inter-grupo';
      btnReset.disabled = false;
    };
  }
}
```

### 7d. Helper `moverInterGrupo`

```js
function moverInterGrupo(parejaId, delta) {
  const gen = state.general;
  if (!gen) return;

  const idx = gen.standings.findIndex(s => s.pareja_id === parejaId);
  if (idx < 0) return;

  const nuevo = idx + delta;
  if (nuevo < 0 || nuevo >= gen.standings.length) return;

  // Solo permitir mover dentro del mismo cluster de empate (misma posicion + mismas stats)
  const a = gen.standings[idx];
  const b = gen.standings[nuevo];
  if (a.posicion_en_grupo !== b.posicion_en_grupo) return;
  if (a.puntos !== b.puntos || a.ds !== b.ds || (a.dg || 0) !== (b.dg || 0) || a.gf !== b.gf) return;

  [gen.standings[idx], gen.standings[nuevo]] = [gen.standings[nuevo], gen.standings[idx]];
  renderTablaGeneralCard();
}
```

### 7e. Imports y llamada

**Archivo**: `src/admin/groups/ui.js` — agregar imports al top:
```js
import { guardarSorteoInterGrupo, resetSorteoInterGrupo, cargarTablaGeneral } from './service.js';
```

**Archivo que orquesta la carga de Tab Grupos** (probablemente el entry point del tab):
Después de cargar todos los grupos, llamar:
```js
await cargarTablaGeneral();
renderTablaGeneralCard();
```

La card General debe aparecer **después** de todas las cards de grupos individuales.

---

## Cambio 8 — `cmpStandings` usa sorteo inter-grupo

**Archivo**: `src/utils/copaMatchups.js` — función `cmpStandings` (línea 39)

### Código actual (líneas 51-56):
```js
// 3. sorteo_orden solo para equipos del mismo grupo
if (a.grupo_id && a.grupo_id === b.grupo_id) {
  const sA = a.sorteo_orden ?? 999999;
  const sB = b.sorteo_orden ?? 999999;
  if (sA !== sB) return sA - sB;
}
```

### Código nuevo:
```js
// 3. sorteo inter-grupo (aplica a equipos de DISTINTO grupo)
const siA = a.sorteo_inter || 0;
const siB = b.sorteo_inter || 0;
if (siA !== siB) return siA - siB;

// 4. sorteo intra-grupo (solo para equipos del MISMO grupo)
if (a.grupo_id && a.grupo_id === b.grupo_id) {
  const sA = a.sorteo_orden || 0;
  const sB = b.sorteo_orden || 0;
  if (sA !== sB) return sA - sB;
}
```

**Nota**: se usa `|| 0` (no `?? 999999`) consistente con el diseño del usuario.

---

## Cambio 9 — `detectarEmpates` en copaMatchups.js

### 9a. Sección B (empate_inter_grupo)

El `detectarEmpates` ya detecta `empate_inter_grupo`. Verificar que chequee `sorteo_inter` (no solo `sorteo_orden`):

En la sección B, donde dice:
```js
const resueltoPorSorteo = grupo.every(t => t.sorteo_orden != null);
```

Cambiar a:
```js
const resueltoPorSorteo = grupo.every(t => t.sorteo_inter != null);
```

### 9b. Sección C (empate_intra_grupo)

Agregar check de `sorteo_orden` para que el warning desaparezca cuando el sorteo intra-grupo fue guardado:

Donde hay `if (tied.length >= 3)` y genera el warning, agregar:
```js
// Verificar si el sorteo ya resolvió este empate
const resueltoPorSorteo = tied.every(t => t.sorteo_orden != null);
if (resueltoPorSorteo) continue;
```

---

## Cambio 10 — Reset copas limpia sorteos

**Archivo**: `src/admin/copas/statusView.js` — handler de reset "Todo (partidos + plan)"

Cuando el admin hace reset completo desde Tab Copas, también limpiar sorteos inter-grupo:

Agregar en el handler del botón `dlg-todo-copas`, después de las operaciones de reset existentes:

```js
await supabase.from('sorteos').delete()
  .eq('torneo_id', torneoId)
  .eq('tipo', 'inter_grupo');
```

**NO** borrar sorteos intra-grupo — esos son independientes del sistema de copas.

---

## Orden de implementación recomendado

1. **Migración SQL** (Cambio 0a, 0b, 0c) — UNIQUE constraint + limpiar datos + RPC simplificado
2. **`enriquecerConPosiciones`** (Cambio 0d) — nueva función en tablaPosiciones.js
3. **Adaptar callers del RPC** (Cambio 0d callers) — planService.js y modalConsulta.js
4. **cargarOverrides** (Cambio 3) — agregar parámetro tipo
5. **guardarOrdenGrupo + resetOrdenGrupo** (Cambios 1, 2) — refactor de save
6. **UI flechas + botones** (Cambio 4) — flechas solo para empatados
7. **Superíndices admin** (Cambio 5) — solo para empatados
8. **Superíndices index.html** (Cambio 6) — vista jugador
9. **Sorteo inter-grupo** (Cambio 7) — card General en Tab Grupos
10. **cmpStandings + detectarEmpates** (Cambios 8, 9) — ranking cross-grupo
11. **Reset copas** (Cambio 10) — cleanup
12. **`npm run build`** — verificar compilación

---

## Verificación final

1. `npm run build` — sin errores
2. NO hacer `npm version patch` ni commit — eso lo hace el owner
