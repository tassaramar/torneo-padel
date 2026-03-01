# Spec: Partidos de copa no visibles en vistas públicas

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 1 — Bug
**Ítems del backlog**: "Partidos de copa no aparecen en fixture.html" + "Modal index.html no muestra partidos de copa"

---

## Contexto

El sistema de copas está implementado y funciona correctamente. Sin embargo, hay dos vistas públicas donde los partidos de copa son invisibles para los usuarios:

1. **fixture.html** — La vista "Tabla" no renderiza partidos de copa en absoluto
2. **index.html modal** — El tab "Fixture completo" los excluye explícitamente de la query

Ambos bugs tienen la misma causa conceptual: las funciones de renderizado de fixture no fueron actualizadas cuando se implementó el sistema de copas.

---

## Bug 1 — fixture.html: sección "Todos los resultados" no muestra copas

### Causa raíz

En `src/fixture.js` (línea ~91-94), los partidos se separan en dos arrays:

```javascript
const partidos = todosPartidos.filter(p => !p.copa_id);           // grupos
const partidosCopa = todosPartidos
  .filter(p => p.copa_id)
  .map(p => ({ ...p, copa_nombre: copaNombrePorId[p.copa_id] || 'Copa' }));
```

`partidosCopa` existe y está cargado, pero **`renderFixtureGrid()` (línea ~241) solo recibe `partidos`** — el array de grupos. Nunca se le pasan los partidos de copa.

La vista "Cola" (sugerida) SÍ muestra copas en su propia sección. El bug es específico a la vista "Tabla".

### Fix

En `renderFixtureGrid()`, después del grid de grupos, agregar una sección "Copas" que renderice `partidosCopa`:

**Enfoque recomendado**: Pasar `partidosCopa` como segundo parámetro a `renderFixtureGrid()` y, si hay partidos de copa, agregar al final del HTML una sección separada similar a la de "Copas pendientes" en la vista Cola.

```javascript
// Cambiar firma de:
function renderFixtureGrid(partidos, grupos, stats)
// A:
function renderFixtureGrid(partidos, grupos, stats, partidosCopa = [])
```

Al final del HTML generado por `renderFixtureGrid()`, si `partidosCopa.length > 0`:

```html
<section class="copa-section">
  <h3>🏆 Copas</h3>
  <!-- por cada copa distinta: nombre + partidos agrupados por ronda -->
</section>
```

El formato de cada partido de copa puede reutilizar el template de `renderCopaItem()` que ya existe en `fixture.js` (línea ~738-769).

**Caller a actualizar**: La llamada a `renderFixtureGrid()` en `init()` o en la función de refresh debe pasar `partidosCopa`.

---

## Bug 2 — modal index.html: tab "Fixture completo" excluye copas

### Causa raíz

En `src/viewer/modalConsulta.js` (línea ~112-126), la query de Supabase filtra explícitamente los partidos de copa:

```javascript
supabase
  .from('partidos')
  .select(`...`)
  .eq('torneo_id', torneoId)
  .is('copa_id', null)   // ← filtro explícito que excluye toda copa
```

`modalState.cache.partidos` nunca contiene partidos de copa. La función `renderFixture()` (línea ~409) solo puede mostrar lo que está en caché.

### Fix

**Paso 1 — Cargar partidos de copa en paralelo**

En `cargarDatosModal()` (línea ~112), agregar una segunda query para partidos de copa y una query para los nombres de copas:

```javascript
const [gruposRes, partidosRes, parejasRes, copasRes, partidosCopaRes] = await Promise.all([
  // ... queries existentes ...
  supabase.from('copas').select('id, nombre').eq('torneo_id', torneoId),
  supabase
    .from('partidos')
    .select('id, copa_id, ronda_copa, estado, pareja1_id, pareja2_id, set1_p1, set1_p2, set2_p1, set2_p2, pareja1:parejas!pareja1_id(nombre), pareja2:parejas!pareja2_id(nombre)')
    .eq('torneo_id', torneoId)
    .not('copa_id', 'is', null)
]);

modalState.cache = {
  grupos: gruposRes.data || [],
  partidos: partidosRes.data || [],      // solo grupos (mantener filtro actual)
  parejas: parejasRes.data || [],
  copas: copasRes.data || [],
  partidosCopa: partidosCopaRes.data || []
};
```

**Paso 2 — Actualizar `renderFixture()`**

Al final de la función, si `cache.partidosCopa.length > 0`, agregar una sección de copas:

```javascript
function renderFixture(container) {
  const { cache } = modalState;
  // ... renderizado actual de grupos ...

  if (cache.partidosCopa && cache.partidosCopa.length > 0) {
    const copaMap = Object.fromEntries((cache.copas || []).map(c => [c.id, c.nombre]));
    // Agrupar por copa y ronda, renderizar sección separada
    container.insertAdjacentHTML('beforeend', renderCopasEnModal(cache.partidosCopa, copaMap));
  }
}
```

**Scope**: Solo cambia el tab "Fixture completo". Los tabs "Mi grupo" y "Otros grupos" no se tocan.

---

## Campos de BD relevantes

| Campo | Tabla | Significado |
|-------|-------|-------------|
| `copa_id` | `partidos` | UUID de la copa. NULL si es partido de grupos |
| `ronda_copa` | `partidos` | `'SF'`, `'F'`, `'3P'`, `'direct'` |
| `copas.nombre` | `copas` | Nombre legible: "Copa Oro", "Copa Plata", etc. |

El campo `copa_id` es la única forma de distinguir si un partido es de copa o de grupos.

---

## Criterios de aceptación

- [ ] **fixture.html, vista "Tabla"**: Aparece sección "🏆 Copas" después del grid de grupos. Muestra los partidos de copa con estado y resultado.
- [ ] **index.html modal, tab "Fixture completo"**: Aparece sección de copas al final del tab. Cada partido muestra "🏆 [Copa Nombre] — [Ronda]".
- [ ] Los partidos de copa se distinguen visualmente de los de grupos (badge de copa y nombre).
- [ ] La vista de grupos existente no se rompe (mis grupos, otros grupos, cola de fixture).
- [ ] Si no hay partidos de copa, las secciones de copa no aparecen (cero ruido visual).

---

## Archivos a modificar

- `src/fixture.js` — `renderFixtureGrid()`: firma + sección de copas al final
- `src/viewer/modalConsulta.js` — `cargarDatosModal()`: agregar queries de copa; `renderFixture()`: sección de copas
