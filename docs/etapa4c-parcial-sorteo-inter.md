# Etapa 4c — Aprobación parcial + Filtro de quiebre

> **Corrección post-testing (2026-03-17)**: Se eliminó la UI de sorteo inter-grupo inline del Tab Copas.
> Los empates inter-grupo se resuelven desde Tab Grupos (mecanismo existente).
> Se agregó filtro de "posiciones de quiebre" para solo alertar empates que afectan la asignación entre copas.
> El reset ahora también limpia la tabla `sorteos`.

## Objetivo

Capacidades en `statusView.js`:

1. **Aprobación parcial (caso 1.5)**: cuando solo algunos grupos terminaron, mostrar un bracket con los equipos disponibles y permitir aprobar cruces individuales sin esperar a que terminen todos los grupos.
2. **Filtro de posiciones de quiebre**: solo mostrar warnings de empate inter-grupo cuando el empate afecta la asignación entre copas (posiciones frontera). Empates dentro de la misma copa se ignoran.

**Lo que NO incluye**: cambios al wizard (`planEditor.js`), cambios al RPC (`crear_partidos_copa` ya soporta aprobación parcial), cambios al bracket renderer (`_renderBracket` ya maneja teams null).

---

## Diseño general — Aprobación parcial

### Nuevo árbol de decisión en `renderStatusView`

El árbol actual es:

```
partidos.length > 0        → _renderEsquemaEnCurso
allGroupsComplete           → _renderEsquemaPorAprobar  (calcular matchups)
!allGroupsComplete          → _renderEsquemaEsperando
```

Se reemplaza por:

```
1. partidos.length > 0 Y bracket completo  → _renderEsquemaEnCurso  (sin cambios)
2. partidos.length > 0 Y bracket incompleto → _renderEsquemaParcial (NUEVO)
3. algún grupo completo, sin partidos       → calcular pool parcial:
   3a. pool.length >= 2                     → _renderEsquemaParcial (NUEVO)
   3b. pool.length < 2                      → _renderEsquemaEsperando (sin cambios)
4. ningún grupo completo                    → _renderEsquemaEsperando (sin cambios)
```

Los estados 2 y 3a comparten la misma función de render (`_renderEsquemaParcial`), que muestra:
- Partidos existentes (de BD) con resultado si lo tienen
- Cruces nuevos calculados (approvable individualmente)
- Slots pendientes (⏳) para equipos no conocidos todavía

### Cómo se determina "bracket completo"

```js
function _bracketCompleto(partidos, formato) {
  const esperados = formato === 'direct' ? 1 : formato === 'bracket' ? /* según reglas */ : 0;
  // Contar partidos de primera ronda
  const primeraRonda = partidos.filter(p =>
    p.ronda_copa === 'QF' || p.ronda_copa === 'SF' || p.ronda_copa === 'direct'
  );
  // Bracket completo = todos los slots de primera ronda tienen partido creado
  return primeraRonda.length >= esperados;
}
```

En la práctica: para bracket de 8 equipos necesitamos 4 QFs. Si hay 2 QFs creados y 2 pendientes, es "bracket incompleto" → estado 2.

**Simplificación**: contar partidos de primera ronda vs tamaño esperado del bracket (derivable de `esq.reglas`). El tamaño del bracket es el total de slots que las reglas definen — la suma de cantidades o la cantidad de grupos × posiciones pedidas.

### Equipos ya usados

Cuando hay partidos existentes, extraer los equipos ya asignados:

```js
const equiposYaUsadosIds = new Set();
for (const p of partidos) {
  if (p.pareja_a?.id) equiposYaUsadosIds.add(p.pareja_a.id);
  if (p.pareja_b?.id) equiposYaUsadosIds.add(p.pareja_b.id);
}
```

Se pasan a `armarPoolParaCopa(standings, grupos, reglas, equiposYaUsadosIds)` que ya los excluye.

---

## Cambio 1: `seedingParcial` en `copaMatchups.js`

Nueva función exportada. Recibe el pool parcial (solo equipos disponibles) y el tamaño total del bracket, retorna un array de cruces de primera ronda con la estructura completa (tanto cruces reales como slots pendientes).

### Firma

```js
export function seedingParcial(pool, tamañoBracket)
```

### Algoritmo

```
1. Si pool.length >= tamañoBracket:
   → Retornar seedingMejorPeor(pool) directamente (bracket completo)

2. Si pool.length < 2:
   → Retornar solo cruces pendientes (null/null) para toda la primera ronda

3. Parear equipos disponibles con mejor-peor ENTRE ELLOS:
   - Ordenar pool por seed (ya viene ordenado de armarPoolParaCopa)
   - Para i de 0 a floor(pool.length/2) - 1:
       cruce[i] = pool[i] vs pool[pool.length - 1 - i]

4. Correr optimizarEndogenos sobre estos cruces

5. Determinar ronda de primera fase según tamañoBracket:
   - 8 → 'QF', 4 → 'SF', 2 → 'direct'

6. Distribuir cruces en posiciones del bracket alternando mitades:
   - totalSlots = tamañoBracket / 2  (matches de primera ronda)
   - mitad = totalSlots / 2
   - Para cada cruce i:
       Si i < ceil(cruces.length / 2):
         orden = i + 1  (mitad superior: posiciones 1, 2, ...)
       Sino:
         orden = mitad + (i - ceil(cruces.length / 2)) + 1  (mitad inferior)

7. Rellenar posiciones vacías con cruces { parejaA: null, parejaB: null }

8. Retornar todos los cruces ordenados por orden
```

### Ejemplo: 4 disponibles en bracket de 8

```
Pool: [A1°(seed 1), B1°(seed 2), A2°(seed 3), B2°(seed 4)]

Paso 3: Mejor-peor → A1° vs B2°, B1° vs A2°
Paso 4: optimizarEndogenos → sin cambios (ya son cross-grupo)
Paso 5: ronda = 'QF'
Paso 6: totalSlots=4, mitad=2
  cruce 0 → orden 1 (QF1, mitad superior)
  cruce 1 → orden 3 (QF3, mitad inferior)
Paso 7: QF2 → null/null, QF4 → null/null

Resultado:
  QF1: A1° vs B2°     [✅ Aprobar]
  QF2: ⏳ vs ⏳
  QF3: B1° vs A2°     [✅ Aprobar]
  QF4: ⏳ vs ⏳
```

### Ejemplo: 6 disponibles en bracket de 8

```
Pool: [A1°, B1°, C1°, C2°, B2°, A2°]  (6 equipos de 3 grupos)

Paso 3: Mejor-peor entre 6 → A1° vs A2°, B1° vs B2°, C1° vs C2° (todos endógenos)
Paso 4: optimizarEndogenos resuelve → A1° vs B2°, B1° vs C2°, C1° vs A2° (u otra combinación)
Paso 6: totalSlots=4, mitad=2
  cruce 0 → QF1
  cruce 1 → QF3
  cruce 2 → QF2
Paso 7: QF4 → null/null

Resultado:
  QF1: A1° vs B2°     [✅ Aprobar]
  QF2: C1° vs A2°     [✅ Aprobar]
  QF3: B1° vs C2°     [✅ Aprobar]
  QF4: ⏳ vs ⏳
```

### Nota sobre `seedingMejorPeor` actual

`seedingMejorPeor` solo soporta 2, 3, 4 y 8 equipos. `seedingParcial` implementa la lógica genérica de pareo (i vs N-1-i) para cualquier cantidad par, sin depender de `seedingMejorPeor`. Para cantidad impar (raro pero posible si una regla pide "el mejor 2°"), el equipo sobrante del medio queda sin emparejar y se coloca como bye (parejaB: null) — se resuelve cuando más grupos terminen.

---

## Cambio 2: Nuevo render `_renderEsquemaParcial` en `statusView.js`

### Qué recibe

```js
function _renderEsquemaParcial(esq, copa, partidosExistentes, standingsData, equiposYaUsadosIds)
```

### Qué hace

1. **Calcula pool parcial**: `armarPoolParaCopa(standings, grupos, reglas, equiposYaUsadosIds)`
2. **Calcula cruces parciales**: `seedingParcial(pool, tamañoBracket)`
3. **Detecta warnings**: `detectarEmpates(pool, allStandings, reglas)`
4. **Merge para bracket**: combina `partidosExistentes` (ya en BD) con `crucesParciales` (nuevos):
   - Si un slot de primera ronda ya tiene partido en BD → usar el partido existente (con resultado)
   - Si no → usar el cruce parcial calculado
   - Esto produce un array unificado que `_renderBracket` puede consumir
5. **Render**: bracket + warnings + info de progreso + botones por cruce

### HTML generado

```html
<div class="copa-seccion" data-esquema-id="...">
  <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
    <strong>Copa Oro</strong>
    <span style="font-size:12px; color:#f59e0b;">🏗️ Parcial (2 de 4 grupos)</span>
  </div>

  [warnings de empates]

  <div class="cruces-container" data-esquema-id="...">
    [bracket gráfico — mezcla de partidos existentes + cruces nuevos + pendientes]

    <div style="font-size:12px; color:var(--muted); margin:8px 0;">
      ⏳ Esperando Grupo C, D para completar el cuadro
    </div>

    [lista de cruces approvables con botón individual]

    <details> [tabla de clasificados parcial] </details>
  </div>
</div>
```

### Lista de cruces approvables

Debajo del bracket, una lista flat de los cruces que se pueden aprobar individualmente:

```html
<div class="cruces-approvables" data-esquema-id="...">
  <div style="font-size:12px; font-weight:600; margin-bottom:6px;">CRUCES LISTOS</div>

  <div class="cruce-approvable" data-ronda="QF" data-orden="1"
       style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:...">
    <span style="font-size:12px; color:var(--muted); min-width:40px;">QF 1</span>
    <span style="flex:1;">A1° vs B2°</span>
    <button class="btn-aprobar-cruce btn-primary btn-sm"
            data-esquema-id="..." data-ronda="QF" data-orden="1">
      ✅ Aprobar
    </button>
  </div>

  <div class="cruce-approvable" data-ronda="QF" data-orden="3" ...>
    <span>QF 3</span>
    <span>B1° vs A2°</span>
    <button class="btn-aprobar-cruce ...">✅ Aprobar</button>
  </div>
</div>
```

Solo se muestran los cruces donde **ambos** equipos están definidos (no null) y que **no** tienen ya un partido creado en BD.

### Guardar cruces parciales para los handlers

```js
// En _renderEsquemaParcial, antes de retornar:
_crucesCalculados[esq.id] = crucesParciales;  // todos los cruces (con nulls incluidos)
```

---

## Cambio 3: Merge de partidos + cruces para bracket

Nueva helper interna en `statusView.js`:

```js
function _mergeBracketData(partidosExistentes, crucesParciales)
```

**Lógica**:
1. Los partidos existentes se normalizan con `_normalizarPartidosParaBracket()`
2. Los cruces parciales se normalizan con `_normalizarCrucesParaBracket()`
3. Para cada cruce parcial, si ya existe un partido con la misma `ronda` + `orden` → usar el partido
4. Si no existe → usar el cruce parcial (puede tener teams o nulls)
5. Agregar placeholders para rondas futuras (SF, F) como ya hace `_renderBracket`

El resultado es un array unificado que `_renderBracket` consume sin cambios.

---

## Cambio 4: Handler de aprobación por cruce individual

En `_wireStatusEvents`, agregar handler para `.btn-aprobar-cruce`:

```js
if (btn.classList.contains('btn-aprobar-cruce')) {
  const esquemaId = btn.dataset.esquemaId;
  const ronda     = btn.dataset.ronda;
  const orden     = Number(btn.dataset.orden);

  // Buscar el cruce en _crucesCalculados
  const cruces = _crucesCalculados[esquemaId] || [];
  const cruce  = cruces.find(c => c.ronda === ronda && c.orden === orden);

  if (!cruce?.parejaA?.pareja_id || !cruce?.parejaB?.pareja_id) {
    logMsg('❌ Cruce incompleto, no se puede aprobar');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳…';

  const { ok, msg } = await crearPartidosCopa(supabase, esquemaId, [cruce]);

  if (ok) {
    logMsg(`✅ Cruce aprobado: ${cruce.parejaA.nombre} vs ${cruce.parejaB.nombre}`);
    onRefresh?.();
  } else {
    logMsg(`❌ Error: ${msg}`);
    btn.disabled = false;
    btn.textContent = '✅ Aprobar';
  }
}
```

**Nota**: `crearPartidosCopa` recibe un array de cruces. Con un solo cruce, el RPC:
- Crea la copa si no existe (primera aprobación parcial)
- Reutiliza la copa existente (siguientes aprobaciones)
- Salta cruces con null (no aplica aquí, ambos definidos)
- Evita duplicados automáticamente

---

## Cambio 5: Lógica en `renderStatusView` — nuevo decision tree

Reescribir la sección "4. Render por esquema" en `renderStatusView`:

```js
// 4. Render por esquema
const seccionesHtml = esquemas.map(esq => {
  const copa     = copaPorEsquema[esq.id];
  const partidos = copa ? (partidosPorCopa[copa.id] || []) : [];

  // Extraer equipos ya usados (de partidos existentes)
  const equiposYaUsadosIds = new Set();
  for (const p of partidos) {
    if (p.pareja_a?.id) equiposYaUsadosIds.add(p.pareja_a.id);
    if (p.pareja_b?.id) equiposYaUsadosIds.add(p.pareja_b.id);
  }

  // Calcular tamaño esperado del bracket
  const tamañoBracket = _calcularTamañoBracket(esq.reglas, standingsData.grupos);
  const primeraRondaEsperada = tamañoBracket / 2;
  const primeraRondaLabel = tamañoBracket >= 8 ? 'QF' : tamañoBracket >= 4 ? 'SF' : 'direct';
  const partidosPrimeraRonda = partidos.filter(p => p.ronda_copa === primeraRondaLabel);

  // Estado 1: bracket completo → en curso (sin cambios)
  if (partidosPrimeraRonda.length >= primeraRondaEsperada && primeraRondaEsperada > 0) {
    return _renderEsquemaEnCurso(esq, copa, partidos);
  }

  // Calcular pool parcial
  const { pool, pendientes } = armarPoolParaCopa(
    standingsData.standings, standingsData.grupos, esq.reglas, equiposYaUsadosIds
  );

  // Estado 2: hay algo (partidos o pool) → parcial
  if (partidos.length > 0 || pool.length >= 2) {
    const cruces = seedingParcial(pool, tamañoBracket);
    const crucesOpt = optimizarEndogenos(cruces, equiposYaUsadosIds);
    const { warnings } = detectarEmpates(pool, standingsData.standings, esq.reglas);

    _crucesCalculados[esq.id] = crucesOpt;

    return _renderEsquemaParcial(esq, copa, partidos, crucesOpt, warnings,
                                  standingsData, pendientes, equiposYaUsadosIds);
  }

  // Estado 3: todos los grupos completos, sin partidos → aprobar completo
  if (allGroupsComplete) {
    const crucesSeed = seedingMejorPeor(pool);
    const cruces = optimizarEndogenos(crucesSeed, new Set());
    const { warnings } = detectarEmpates(pool, standingsData.standings, esq.reglas);
    _crucesCalculados[esq.id] = cruces;
    return _renderEsquemaPorAprobar(esq, pool, cruces, warnings, standingsData);
  }

  // Estado 4: nada todavía → esperar
  return _renderEsquemaEsperando(esq, standingsData);
}).join('');
```

### Helper `_calcularTamañoBracket`

```js
function _calcularTamañoBracket(reglas, grupos) {
  const hasGlobal = reglas.some(r => r.modo === 'global');
  if (hasGlobal) {
    const rule = reglas.find(r => r.modo === 'global');
    return (rule.hasta || 4) - (rule.desde || 1) + 1;
  }
  // Por posición: sumar cuántos equipos clasifican
  let total = 0;
  for (const r of reglas) {
    if (r.criterio && r.cantidad) {
      total += r.cantidad;
    } else {
      total += grupos.length;  // uno por grupo
    }
  }
  return total;
}
```

---

## Cambio 6: Sorteo inter-grupo inline

### Modificar `_renderWarnings`

Reemplazar el bloque de `empate_inter_grupo` para mostrar UI editable en vez del placeholder "disponible próximamente".

**HTML generado** para empate inter-grupo:

```html
<div class="sorteo-inter-grupo" data-esquema-id="..." data-posicion="2"
     style="font-size:12px; color:#d97706; margin-bottom:8px; padding:8px 10px;
            background:rgba(251,191,36,0.1); border-radius:6px; border-left:3px solid #d97706;">
  ⚠️ Empate entre 3 equipos (2° de grupo, mismos Pts/DS/DG/GF):

  <div style="margin:8px 0; display:flex; flex-direction:column; gap:4px;">
    <div class="sorteo-fila" style="display:flex; align-items:center; gap:6px;">
      <input type="number" min="1" max="3" class="sorteo-orden-input"
             data-pareja-id="uuid1"
             style="width:36px; text-align:center; padding:2px; border:1px solid var(--border); border-radius:4px;">
      <span>Gaby Z - Uri (A 2°)</span>
    </div>
    <div class="sorteo-fila" style="display:flex; align-items:center; gap:6px;">
      <input type="number" min="1" max="3" class="sorteo-orden-input"
             data-pareja-id="uuid2" ...>
      <span>Gus - Dudi (B 2°)</span>
    </div>
    <div class="sorteo-fila" style="display:flex; align-items:center; gap:6px;">
      <input type="number" min="1" max="3" class="sorteo-orden-input"
             data-pareja-id="uuid3" ...>
      <span>Marian - Sebi (C 2°)</span>
    </div>
  </div>

  <div style="display:flex; gap:6px;">
    <button class="btn-guardar-sorteo-inter btn-primary btn-sm"
            data-esquema-id="...">
      💾 Guardar sorteo
    </button>
  </div>

  <div style="font-size:11px; color:var(--muted); margin-top:4px;">
    Ingresá el orden del sorteo físico (1 = mejor posición).
    Los cruces se recalculan al guardar.
  </div>
</div>
```

### Handler en `_wireStatusEvents`

```js
// Guardar sorteo inter-grupo
if (btn.classList.contains('btn-guardar-sorteo-inter')) {
  const sorteoDiv = btn.closest('.sorteo-inter-grupo');
  if (!sorteoDiv) return;

  const inputs = sorteoDiv.querySelectorAll('.sorteo-orden-input');
  const ordenParejas = [];

  for (const inp of inputs) {
    const val = Number(inp.value);
    if (!val || val < 1) {
      alert('Completá todos los órdenes del sorteo');
      return;
    }
    ordenParejas.push({
      pareja_id: inp.dataset.parejaId,
      orden_sorteo: val
    });
  }

  // Verificar no hay duplicados
  const ordenes = ordenParejas.map(o => o.orden_sorteo);
  if (new Set(ordenes).size !== ordenes.length) {
    alert('Los órdenes no pueden repetirse');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳…';

  const { guardarSorteoInterGrupo } = await import('./copaDecisionService.js');
  const result = await guardarSorteoInterGrupo(supabase, TORNEO_ID, ordenParejas);

  if (result.ok) {
    logMsg('✅ Sorteo inter-grupo guardado');
    onRefresh?.();
  } else {
    logMsg(`❌ Error guardando sorteo: ${result.msg}`);
    btn.disabled = false;
    btn.textContent = '💾 Guardar sorteo';
  }
}
```

### Import necesario

Agregar al top de `statusView.js` (dynamic import en el handler, no estático):

```js
// Se importa dinámicamente en el handler:
// const { guardarSorteoInterGrupo } = await import('./copaDecisionService.js');
```

Usar import dinámico para no cargar el módulo si nunca se usa el sorteo.

---

## Cambio 7: `determinarPaso` en `index.js`

Actualmente `determinarPaso` devuelve paso 2 (esperar) o paso 3 (aprobar). Con aprobación parcial, necesita reconocer el estado intermedio:

```js
function determinarPaso(esquemas, copas, standingsData) {
  if (!esquemas?.length) return 1;

  const hayCopas = (copas || []).length > 0;

  // Si hay copas, verificar si TODAS tienen bracket completo
  // Si no, estamos en paso 3 (parcial / aprobar)
  if (hayCopas) {
    // Simplificación: si hay copas, al menos algo fue aprobado
    // Podrían quedar más cruces por aprobar, pero el indicador muestra "Aprobar/En curso"
    return 4;  // Mantener como "En curso" — el statusView internamente distingue parcial vs completo
  }

  const gruposCompletos = (standingsData.grupos || []).filter(g =>
    (standingsData.standings || []).some(s => s.grupo_id === g.id && s.grupo_completo)
  );
  if (gruposCompletos.length > 0) return 3;

  return 2;
}
```

**Decisión**: mantener la lógica simple. El indicador de pasos (1→2→3→4) es orientativo. La distinción fine-grained entre "parcial" y "completo" la maneja `statusView` internamente. Si se quiere agregar un paso "3.5 Parcial" se puede hacer, pero no es crítico.

**Cambio mínimo**: ajustar el mensaje de paso 3 para incluir el caso parcial:

```js
const mensajes = {
  1: 'Definí el plan de copas para arrancar',
  2: info || 'Esperando que terminen los grupos',
  3: info || 'Hay cruces para aprobar — revisá y aprobá',
  4: info || 'Copas en curso'
};
```

---

## Resumen de archivos que cambian

| Archivo | Cambio |
|---------|--------|
| `src/utils/copaMatchups.js` | Nueva función `seedingParcial` |
| `src/admin/copas/statusView.js` | Nuevo decision tree, `_renderEsquemaParcial`, `_mergeBracketData`, `_calcularTamañoBracket`, handler `.btn-aprobar-cruce`, handler `.btn-guardar-sorteo-inter`, warning de empate inter-grupo interactivo |
| `src/admin/copas/index.js` | Mensaje de paso 3 actualizado (mínimo) |

**No cambian**: `planService.js`, `planEditor.js`, `copaDecisionService.js` (ya tiene `guardarSorteoInterGrupo`), `copaMatchups.js` (solo se agrega, no se modifica lo existente), `_renderBracket` (ya maneja nulls).

---

## Verificación

### Parcial (caso 1.5)

1. Configurar torneo con 4 grupos, copa de 8 equipos (QF)
2. Completar grupos A y B
3. Abrir Tab Copas → ver bracket con QF1 y QF3 con equipos, QF2 y QF4 pendientes
4. Aprobar QF1 → se crea partido en BD, bracket muestra QF1 como "en curso"
5. Aprobar QF3 → se crea partido, QF3 en curso
6. Completar grupo C → refresh → QF2 o QF4 se calculan con los nuevos equipos (excluyendo los ya usados)
7. Completar grupo D → todos los QFs definidos → aprobar restantes → bracket completo

### Sorteo inter-grupo

1. Completar 3 grupos donde los 2° tienen stats idénticas
2. Tab Copas → ver warning con inputs de sorteo
3. Llenar orden (1, 2, 3) → Guardar → ver cruces recalculados
4. Cerrar y volver → sorteo persiste → mismos cruces

### Regresión

- Si todos los grupos ya están completos, el flujo full (sin parcialidad) sigue funcionando igual
- Bracket gráfico se renderiza correctamente en todos los estados
- Modo edición de cruces (E4b) sigue funcionando
- Reset copas sigue funcionando

---

## Edge cases

1. **Copa de 2 equipos (direct) con parcial**: Si solo un grupo terminó, hay 1 equipo. pool.length < 2 → _renderEsquemaEsperando. Correcto.
2. **Copa de 4 equipos con 1 grupo de 4**: Seeding global, 1 solo grupo. Si ese grupo termina, pool tiene 4 equipos → bracket completo → flow normal (no parcial).
3. **Pool impar**: regla `{posicion:2, criterio:'mejor', cantidad:1}` toma 1 equipo. Con 3 grupos completos → 3 primeros + 1 segundo = 4 equipos → bracket de 4 completo. Raro que quede impar pero `seedingParcial` lo maneja con bye.
4. **Todas las parciales aprobadas, luego reset**: Reset borra partidos y copas. El pool se recalcula desde cero. OK.
5. **Editar cruces en modo parcial**: Botón "Editar cruces" no se muestra en modo parcial — solo está en modo full (`_renderEsquemaPorAprobar`). En parcial, el admin aprueba cruce por cruce. Si quiere customizar, espera a que terminen todos los grupos.
