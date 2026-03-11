# Etapa 2: Motor de matchups — JS puro, sin IO

## Objetivo

Crear un módulo de funciones puras (`src/utils/copaMatchups.js`) que implementa el algoritmo de cruces v2: pool de clasificados, seeding Mejor-Peor para 2/4/8 equipos, y optimización de endógenos con swap secuencial. También actualizar los comparadores en `planService.js` para incluir `dg`.

**No cambia UI ni servicios. No se llaman estas funciones desde ningún lado todavía** — se integran en Etapa 4a.

## Spec funcional de referencia

`docs/spec-copa-approval-v2.md` — Secciones:
- "Algoritmo de cruces automáticos (Mejor-Peor + evitar endógenos)"
- "Equipos ya asignados (flag utilizado)"
- "Tabla general (cambio de criterio)"

## Criterios de aceptación (de la spec)

- [ ] Los cruces siguen la regla Mejor-Peor (1° vs último, 2° vs anteúltimo) para 2, 4 y 8 equipos
- [ ] Con 2 grupos, los cruces nunca enfrentan equipos del mismo grupo
- [ ] Con 4 grupos, los cruces evitan enfrentar equipos del mismo grupo (swap automático)
- [ ] Si un cruce endógeno no se puede evitar, se marca con flag `endogeno: true`
- [ ] Los equipos ya aprobados no aparecen disponibles para nuevos cruces

---

## Archivo a crear: `src/utils/copaMatchups.js`

### Estructura general

```
/**
 * Motor de matchups para copas v2.
 * Funciones puras, sin IO, sin dependencias de Supabase.
 *
 * Recibe standings enriquecidos (del RPC obtener_standings_torneo + enriquecimiento JS)
 * y reglas del esquema de copa.
 * Retorna pool de clasificados y cruces optimizados.
 */
```

El módulo exporta 5 funciones. No importa nada externo (es 100% puro).

---

### Función 1: `cmpStandings(a, b)`

Comparador para standings cross-grupo. Orden descendente por stats, ascendente por sorteo.

**Firma**:
```js
export function cmpStandings(a, b)
```

**Campos que compara** (en orden de prioridad):
1. `puntos` DESC
2. `ds` DESC
3. `dg` DESC
4. `gf` DESC
5. `sorteo_orden` ASC (null = 999999, va al final)
6. `nombre` ASC (desempate estable)

**Input**: Objetos de standings enriquecidos del RPC. Campos relevantes:
```js
{ puntos, ds, dg, gf, sorteo_orden, nombre }
```

**Nota**: Este comparador NO incluye H2H porque opera cross-grupo (equipos de distintos grupos no tienen H2H). Para intra-grupo, el RPC ya resuelve con `posicion_en_grupo` que tiene sorteo integrado.

---

### Función 2: `armarPoolParaCopa(standings, grupos, reglas, equiposYaUsadosIds)`

Construye la lista ordenada de clasificados para una copa, respetando las reglas del esquema.

**Firma**:
```js
export function armarPoolParaCopa(standings, grupos, reglas, equiposYaUsadosIds)
```

**Parámetros**:
- `standings`: Array de standings enriquecidos (del RPC). Cada elemento tiene: `{ pareja_id, grupo_id, puntos, ds, dg, gf, gc, posicion_en_grupo, grupo_completo, sorteo_orden, nombre, grupoNombre }`
- `grupos`: Array de grupos `{ id, nombre }`
- `reglas`: Array de reglas del esquema (campo `esquema.reglas`). Puede ser:
  - Modo global: `[{ modo: 'global', desde: 1, hasta: 4 }]`
  - Modo posición: `[{ posicion: 1 }, { posicion: 2 }]` o con criterio: `[{ posicion: 2, criterio: 'mejor', cantidad: 1 }]`
- `equiposYaUsadosIds`: `Set<string>` de `pareja_id` que ya tienen partidos de copa creados en BD. Se excluyen del pool. Pasar `new Set()` si no hay.

**Retorna**:
```js
{
  pool: [
    { ...standingEntry, seed: 1, grupoId, grupoNombre },
    { ...standingEntry, seed: 2, grupoId, grupoNombre },
    ...
  ],
  pendientes: [
    { grupoId, grupoNombre }  // grupos que no terminaron aún
  ]
}
```

**Lógica** (muy similar a `calcularClasificadosConWarnings` en `planService.js:404-518`, pero simplificada):

1. Calcular `gruposCompletosIds` = standings donde `grupo_completo === true`
2. Calcular `gruposIncompletos` = grupos no en gruposCompletosIds
3. Filtrar standings excluyendo `equiposYaUsadosIds`

4. **Si hay regla global** (`reglas.some(r => r.modo === 'global')`):
   - Tomar `desde` y `hasta` de la regla
   - Ordenar TODOS los standings de grupos completos con `cmpStandings`
   - Slice `[desde-1, hasta]` → pool
   - Agregar seed incremental

5. **Si reglas por posición**:
   - Para cada regla:
     - Filtrar standings por `posicion_en_grupo === regla.posicion` y `grupo_completo`
     - Ordenar con `cmpStandings`
     - Si `regla.criterio === 'peor'`: invertir el orden
     - Si `regla.cantidad`: tomar solo esa cantidad
     - Si no hay criterio: tomar todos (uno por grupo)
     - Agregar al pool con seed incremental
   - Agregar grupos incompletos a `pendientes`

6. Retornar `{ pool, pendientes }`

**Diferencias con `calcularClasificadosConWarnings` existente**:
- No retorna `zonaGris` ni `warnings` (eso lo hacen funciones separadas)
- No recibe `propuestasAprobadas` — recibe `equiposYaUsadosIds` (más simple)
- Usa `cmpStandings` que incluye `dg` y `sorteo_orden`
- No calcula empates internamente (función aparte)

---

### Función 3: `seedingMejorPeor(pool)`

Aplica seeding Mejor-Peor al pool: el mejor vs el peor, el segundo vs el anteúltimo, etc.

**Firma**:
```js
export function seedingMejorPeor(pool)
```

**Parámetro**: Array ordenado de mejor a peor. Puede contener `null` (slots pendientes de grupos incompletos).

**Retorna**: Array de cruces:
```js
[
  { ronda, orden, parejaA, parejaB, endogeno: false },
  ...
]
```

**Lógica**:

1. Separar nulls al final: `const real = pool.filter(e => e != null); const nulls = pool.filter(e => e == null); const sorted = [...real, ...nulls];`
2. Según `sorted.length`:
   - **2 equipos**: `[{ ronda: 'direct', orden: 1, parejaA: sorted[0], parejaB: sorted[1] }]`
   - **3 equipos**: `[{ ronda: 'SF', orden: 1, parejaA: sorted[1], parejaB: sorted[2] }]` (bye al mejor, sorted[0])
   - **4 equipos**:
     ```
     { ronda: 'SF', orden: 1, parejaA: sorted[0], parejaB: sorted[3] }
     { ronda: 'SF', orden: 2, parejaA: sorted[1], parejaB: sorted[2] }
     ```
   - **8 equipos**:
     ```
     { ronda: 'QF', orden: 1, parejaA: sorted[0], parejaB: sorted[7] }
     { ronda: 'QF', orden: 2, parejaA: sorted[1], parejaB: sorted[6] }
     { ronda: 'QF', orden: 3, parejaA: sorted[2], parejaB: sorted[5] }
     { ronda: 'QF', orden: 4, parejaA: sorted[3], parejaB: sorted[4] }
     ```

3. Para cada cruce, calcular `endogeno`: `parejaA && parejaB && parejaA.grupoId === parejaB.grupoId`

**Nota**: La función existente `seedingBombo` en `bracketLogic.js:44-65` solo maneja hasta 4 equipos. Esta nueva función la reemplaza para el flujo v2. `seedingBombo` NO se modifica ni se borra (sigue usándose en el flujo v1 hasta cleanup).

---

### Función 4: `optimizarEndogenos(cruces, equiposProtegidosIds)`

Recorre cruces secuencialmente y swappea para evitar que dos equipos del mismo grupo se enfrenten.

**Firma**:
```js
export function optimizarEndogenos(cruces, equiposProtegidosIds)
```

**Parámetros**:
- `cruces`: Array de cruces (output de `seedingMejorPeor`)
- `equiposProtegidosIds`: `Set<string>` de `pareja_id` que NO se deben mover (ya fueron optimizados o ya aprobados). Pasar `new Set()` si no hay.

**Retorna**: Nuevo array de cruces (misma forma, no muta el input). Cada cruce tiene `endogeno: boolean` y `optimizado: boolean` actualizados.

**Algoritmo** (de la spec, sección "Paso 2: Evitar endógenos"):

```
Para cada cruce i (de arriba a abajo):
  Si cruces[i] es endógeno (parejaA.grupoId === parejaB.grupoId):
    peorDelCruce = parejaB (el de peor seed)

    Si peorDelCruce.pareja_id está en equiposProtegidosIds:
      Marcar endogeno=true, continuar (no se puede tocar)

    Buscar swap válido (de abajo hacia arriba):
      Para cada cruce j (desde el último hasta i+1):
        Para cada equipo candidato en cruces[j] (preferir parejaB primero, luego parejaA):
          Si candidato es null: skip
          Si candidato.pareja_id está en equiposProtegidosIds: skip
          Si candidato.grupoId === peorDelCruce.grupoId: skip (mismo grupo, no sirve)

          // Verificar que el swap no crea nuevo endógeno en cruce j
          otroEquipoCruceJ = el otro equipo del cruce j (el que NO se swappea)
          Si otroEquipoCruceJ && otroEquipoCruceJ.grupoId === peorDelCruce.grupoId: skip

          // Swap válido encontrado
          Intercambiar peorDelCruce ↔ candidato
          Agregar ambos pareja_ids a equiposProtegidosIds (no re-tocarlos)
          Marcar ambos cruces como optimizado=true, recalcular endogeno
          Break (pasar al siguiente cruce i)

    Si no se encontró swap válido:
      Marcar endogeno=true (warning para el admin)
```

**Casos especiales**:
- **1 solo grupo**: Todo es endógeno, no hay swap posible. Todos los cruces quedan con `endogeno: true`.
- **2 grupos**: Mejor-Peor con posición ya produce cruces cross-grupo naturalmente. Pero si hay seeding global, puede haber endógenos. El swap los resuelve.
- **Cruces con null** (equipos pendientes): Los nulls no tienen grupoId, así que no se consideran endógenos. Se skipean en el swap.

**Nota sobre inmutabilidad**: La función debe clonar el array de cruces y los objetos individuales antes de modificar. No mutar el input.

---

### Función 5: `detectarEmpates(pool, allStandings, reglas)`

Detecta empates que afectan la composición del pool: frontera (último clasificado vs primer excluido) e inter-grupo (mismo tier, distintos grupos).

**Firma**:
```js
export function detectarEmpates(pool, allStandings, reglas)
```

**Parámetros**:
- `pool`: Array de clasificados (output de `armarPoolParaCopa`)
- `allStandings`: Todos los standings del torneo (no solo clasificados)
- `reglas`: Reglas del esquema (para saber el modo y los cortes)

**Retorna**:
```js
{
  warnings: [
    {
      tipo: 'empate_frontera',
      equipos: [{ nombre, grupoNombre, pareja_id, puntos, ds, dg, gf }],
      detalle: '5 pts, DS +1, DG +2'
    },
    {
      tipo: 'empate_inter_grupo',
      posicion: 2,  // todos son 2° de su grupo
      equipos: [{ nombre, grupoNombre, pareja_id, puntos, ds, dg, gf, sorteo_orden }],
      resueltoPorSorteo: false  // true si todos tienen sorteo_orden definido
    },
    {
      tipo: 'empate_intra_grupo',
      grupoId: 'uuid',
      grupoNombre: 'A',
      posiciones: '2°-3°',
      equipos: [{ nombre, pareja_id }]
    }
  ]
}
```

**Lógica**:

**A) Empates frontera** (afectan quién clasifica):

Para cada regla del esquema:
1. Determinar cuántos equipos toma esta regla (su "corte")
2. Tomar el último clasificado de esta regla y el primer excluido
3. Comparar con `esEmpateStats(a, b)`: `puntos === ds === dg === gf`
4. Si hay empate, buscar TODOS los equipos con las mismas stats (incluyendo excluidos y clasificados)
5. Emitir warning `empate_frontera` con todos los involucrados

**B) Empates inter-grupo** (mismo tier, distintos grupos, afectan seeding):

1. Agrupar pool por `posicion_en_grupo`
2. Dentro de cada tier, buscar equipos con stats idénticas (`esEmpateStats`)
3. Si hay 2+ empatados Y no todos tienen `sorteo_orden` definido:
   - Emitir warning `empate_inter_grupo`
   - `resueltoPorSorteo: false`
4. Si todos tienen `sorteo_orden`: `resueltoPorSorteo: true` (no mostrar warning)

**C) Empates intra-grupo** (afectan posición → copa destino):

1. Para cada grupo completo en standings:
   - Agrupar equipos por stats key `${puntos}_${ds}_${dg}_${gf}`
   - Si hay 3+ empatados en el mismo grupo:
     - Emitir warning `empate_intra_grupo`

**Nota**: Los empates NO bloquean nada (filosofía "Guiar, No Bloquear"). Son informativos.

### Función helper interna: `esEmpateStats(a, b)`

```js
function esEmpateStats(a, b) {
  return a.puntos === b.puntos && a.ds === b.ds && a.dg === b.dg && a.gf === b.gf;
}
```

No se exporta. Incluye `dg` (diferencia con `_empate` actual en planService.js que no lo incluye).

---

## Archivo a modificar: `src/admin/copas/planService.js`

### Cambio 1: `_cmpDesc` (línea 572)

**Antes**:
```js
function _cmpDesc(a, b) {
  if (b.puntos !== a.puntos) return b.puntos - a.puntos;
  if (b.ds     !== a.ds)     return b.ds     - a.ds;
  if (b.gf     !== a.gf)     return b.gf     - a.gf;
  return String(a.nombre).localeCompare(String(b.nombre));
}
```

**Después**:
```js
function _cmpDesc(a, b) {
  if (b.puntos !== a.puntos) return b.puntos - a.puntos;
  if (b.ds     !== a.ds)     return b.ds     - a.ds;
  if ((b.dg || 0) !== (a.dg || 0)) return (b.dg || 0) - (a.dg || 0);
  if (b.gf     !== a.gf)     return b.gf     - a.gf;
  return String(a.nombre).localeCompare(String(b.nombre));
}
```

**Nota**: Se usa `|| 0` para backwards compatibility — standings cargados antes de la Etapa 1 no tienen `dg`. Una vez aplicada la migración, `dg` siempre viene del RPC.

### Cambio 2: `_empate` (línea 578)

**Antes**:
```js
function _empate(a, b) {
  return a.puntos === b.puntos && a.ds === b.ds && a.gf === b.gf;
}
```

**Después**:
```js
function _empate(a, b) {
  return a.puntos === b.puntos && a.ds === b.ds && (a.dg || 0) === (b.dg || 0) && a.gf === b.gf;
}
```

### Cambio 3: key de empate en detección de empates 3+ (línea 504)

**Antes**:
```js
const key = `${t.puntos}_${t.ds}_${t.gf}`;
```

**Después**:
```js
const key = `${t.puntos}_${t.ds}_${t.dg || 0}_${t.gf}`;
```

---

## Verificación

### 1. Build
```bash
npm run build
```
Debe compilar sin errores. `copaMatchups.js` no se importa desde ningún lado aún, pero Vite lo incluye si está en `src/`.

### 2. Tests manuales en consola del navegador

Abrir `npm run dev`, ir a cualquier página, abrir la consola del navegador. Importar el módulo dinámicamente:

```js
const m = await import('/src/utils/copaMatchups.js');
```

#### Test seedingMejorPeor — 4 equipos:
```js
const pool4 = [
  { nombre: 'A1', grupoId: 'gA' },
  { nombre: 'B1', grupoId: 'gB' },
  { nombre: 'B2', grupoId: 'gB' },
  { nombre: 'A2', grupoId: 'gA' }
];
console.log(m.seedingMejorPeor(pool4));
// Esperado: SF1: A1 vs A2, SF2: B1 vs B2 (endógenos, se resuelven luego)
```

#### Test seedingMejorPeor — 8 equipos:
```js
const pool8 = [
  { nombre: 'A1', grupoId: 'gA' },
  { nombre: 'B1', grupoId: 'gB' },
  { nombre: 'C1', grupoId: 'gC' },
  { nombre: 'D1', grupoId: 'gD' },
  { nombre: 'D2', grupoId: 'gD' },
  { nombre: 'C2', grupoId: 'gC' },
  { nombre: 'B2', grupoId: 'gB' },
  { nombre: 'A2', grupoId: 'gA' }
];
const cruces = m.seedingMejorPeor(pool8);
console.log(cruces.map(c => `${c.parejaA.nombre} vs ${c.parejaB.nombre} (endogeno: ${c.endogeno})`));
// Esperado: QF1: A1 vs A2 (endogeno), QF2: B1 vs B2 (endogeno), QF3: C1 vs C2 (endogeno), QF4: D1 vs D2 (endogeno)
```

#### Test optimizarEndogenos — 4 grupos:
```js
const crucesOpt = m.optimizarEndogenos(cruces, new Set());
console.log(crucesOpt.map(c => `${c.parejaA.nombre} vs ${c.parejaB.nombre} (endogeno: ${c.endogeno})`));
// Esperado: QF1: A1 vs B2 (false), QF2: B1 vs A2 (false), QF3: C1 vs D2 (false), QF4: D1 vs C2 (false)
```

#### Test optimizarEndogenos — 1 grupo (irresolvable):
```js
const pool1g = [
  { nombre: 'E1', grupoId: 'g1' },
  { nombre: 'E2', grupoId: 'g1' },
  { nombre: 'E3', grupoId: 'g1' },
  { nombre: 'E4', grupoId: 'g1' }
];
const cruces1g = m.seedingMejorPeor(pool1g);
const opt1g = m.optimizarEndogenos(cruces1g, new Set());
console.log(opt1g.every(c => c.endogeno === true));
// Esperado: true (todos endógenos, no hay swap posible)
```

### 3. Verificar cambios en planService.js

Abrir admin.html → Tab Copas. Si hay un plan vigente con propuestas, verificar que la vista sigue funcionando normalmente (los cambios en `_cmpDesc` y `_empate` son backwards compatible).

### 4. npm run build final
```bash
npm run build
```
Sin errores ni warnings nuevos.

---

## Notas para el implementador

1. **`copaMatchups.js` es 100% puro** — no importa supabase, no hace fetch, no toca el DOM. Solo recibe datos y retorna datos.
2. **No importar `copaMatchups.js` desde ningún otro archivo todavía**. Se integra en Etapa 4a.
3. **No modificar `bracketLogic.js`**. `seedingBombo` sigue existiendo para el flujo v1. La nueva `seedingMejorPeor` es la versión v2 en el módulo nuevo.
4. **Los cambios en `planService.js` son backwards compatible** — el `|| 0` maneja el caso de standings sin `dg`.
5. **Inmutabilidad**: `optimizarEndogenos` debe clonar cruces antes de modificar. Usar `cruces.map(c => ({...c}))` al inicio y clonar `parejaA`/`parejaB` cuando se swappean.
6. **`equiposProtegidosIds` se muta internamente** (se le agregan IDs de equipos swappeados). Clonar el Set al inicio para no mutar el input: `const protegidos = new Set(equiposProtegidosIds)`.

---

## Modelo recomendado

**Sonnet**. Hay lógica algorítmica (swap de endógenos) que requiere razonamiento, no es copiar SQL.

---

## Prompt de implementación

```
Implementá el módulo descrito en docs/etapa2-motor-matchups.md

El documento especifica 5 funciones puras a crear en src/utils/copaMatchups.js
y 3 cambios menores en src/admin/copas/planService.js.

Seguí las instrucciones al pie de la letra:
- Las 5 funciones exportadas con las firmas exactas del doc
- El algoritmo de optimizarEndogenos paso a paso como está descrito
- Los cambios en _cmpDesc, _empate, y la key de empate en planService.js
- NO importar copaMatchups.js desde ningún otro archivo
- NO modificar bracketLogic.js

Después de implementar, corré npm run build para verificar.

Al finalizar:
- Actualizá docs/brainstorming-proximas-mejoras.md (mover ítems completados al historial)
- Ejecutá npm version patch y hacé push a git
```
