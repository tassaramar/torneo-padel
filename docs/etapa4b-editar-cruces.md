# Etapa 4b — StatusView: edición de cruces + aprobación con cruces custom

## Objetivo

Agregar el modo edición de cruces en `statusView.js`. El admin puede:
1. Click "✏️ Editar cruces" → ve selectores para cambiar cada par de equipos
2. Auto-dedup: si un equipo está seleccionado en un slot, queda deshabilitado en los demás
3. Warning inline por cruce: "⚠️ mismo grupo"
4. "✅ Aprobar con estos cruces" → llama al RPC con los cruces editados
5. "↩ Volver a sugeridos" → restaura la vista read-only con los cruces calculados

**Lo que NO incluye esta etapa**: aprobación parcial cruce por cruce, sorteo inter-grupo inline.

**Único archivo que cambia**: `src/admin/copas/statusView.js`

---

## Diseño general

La sección de cada copa se estructura así:

```
<div class="copa-seccion" data-esquema-id="...">
  <título>
  [warnings de empates — FUERA del container, no se reemplaza]
  <div class="cruces-container" data-esquema-id="...">
    ← Este div se reemplaza al entrar/salir del modo edición
  </div>
</div>
```

**Modo read-only** (`cruces-container` contiene):
- Label "CRUCES"
- Lista de cruces read-only
- Hint de endógenos (si los hay)
- `<details>` con tabla de clasificados
- Botones: "✅ Aprobar copa" | "✏️ Editar cruces"
- Footer de warning bloqueante (si hay)

**Modo edición** (`cruces-container` contiene):
- Label "CRUCES (edición)"
- Filas con selectores A vs B + badge de warning inline
- Botones: "✅ Aprobar con estos cruces" | "↩ Volver a sugeridos"

Cuando se entra/sale del modo edición, se reemplaza **solo** el innerHTML de `.cruces-container`. El wrapper `.copa-seccion` y los warnings de arriba quedan intactos.

Los eventos usan **event delegation** en el container principal para sobrevivir a los reemplazos de innerHTML.

---

## Cambios en `src/admin/copas/statusView.js`

### 1. Nuevas variables module-level

Agregar debajo de `const _crucesCalculados = {};`:

```js
const _crucesEditados = {}; // esquemaId → Array<cruce> (copia editable)
```

---

### 2. `_renderEsquemaPorAprobar` — refactorizar

**Cambios**:
- Mover la sección "CRUCES + tabla + botones" a una nueva función `_renderCrucesReadOnly`
- Envolver esa sección en `<div class="cruces-container" data-esquema-id="...">`
- Actualizar texto del hint de endógenos: ya no dice "disponible próximamente"

**Función completa reemplaza a la existente**:

```js
function _renderEsquemaPorAprobar(esq, pool, cruces, warnings, standingsData) {
  const warningsHtml = _renderWarnings(warnings, esq.id);

  const hayWarningsBloqueantes = warnings.some(
    w => w.tipo === 'empate_frontera' || w.tipo === 'empate_inter_grupo'
  );
  const borderColor = hayWarningsBloqueantes ? '#f59e0b' : '#e5e7eb';
  const bgColor     = hayWarningsBloqueantes ? 'rgba(251,191,36,0.06)' : 'var(--surface,#fff)';

  return `
    <div class="copa-seccion" data-esquema-id="${esq.id}"
         style="border:1px solid ${borderColor}; border-radius:12px;
                padding:12px 14px; margin-bottom:10px; background:${bgColor};">
      <div style="font-weight:600; margin-bottom:10px;">${_esc(esq.nombre)}</div>
      ${warningsHtml}
      <div class="cruces-container" data-esquema-id="${esq.id}">
        ${_renderCrucesReadOnly(esq, pool, cruces, warnings, standingsData)}
      </div>
    </div>
  `;
}
```

---

### 3. Nueva función `_renderCrucesReadOnly`

Contiene todo lo que antes estaba inline en `_renderEsquemaPorAprobar` (la parte de CRUCES + tabla + botones).

```js
function _renderCrucesReadOnly(esq, pool, cruces, warnings, standingsData) {
  const hayEndogenos = cruces.some(c => c.endogeno);
  const endogenoHint = hayEndogenos ? `
    <p style="font-size:12px; color:var(--muted); margin-top:6px;">
      ℹ️ No se pudieron evitar todos los cruces entre equipos del mismo grupo.
      Podés editarlos manualmente con el botón ✏️ Editar cruces.
    </p>
  ` : '';

  const tablaHtml = _renderTablaGeneral(standingsData, pool.map(p => p.pareja_id));

  const hayWarningsBloqueantes = warnings.some(
    w => w.tipo === 'empate_frontera' || w.tipo === 'empate_inter_grupo'
  );

  return `
    <div style="font-size:12px; font-weight:600; color:var(--muted); margin-bottom:6px;">CRUCES</div>
    ${_renderCruces(cruces)}
    ${endogenoHint}
    ${tablaHtml}
    <div class="copa-actions admin-actions" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button type="button" class="btn-aprobar-copa btn-primary btn-sm"
              data-esquema-id="${_esc(esq.id)}">
        ✅ Aprobar copa
      </button>
      <button type="button" class="btn-editar-cruces btn-sm"
              data-esquema-id="${_esc(esq.id)}"
              style="border:1px solid var(--border); background:transparent;">
        ✏️ Editar cruces
      </button>
    </div>
    ${hayWarningsBloqueantes ? `
      <p style="font-size:12px; color:#d97706; margin-top:6px;">
        ⚠️ Hay empates sin resolver. Podés aprobar igual — los cruces se generan con el orden actual.
      </p>
    ` : ''}
  `;
}
```

---

### 4. Nueva función `_renderFormEdicion`

Genera el HTML del modo edición (selectores).

Las opciones del select están ordenadas en dos `<optgroup>`:
1. "Clasificados" → equipos del pool de esta copa, con `✅` prefijo, ordenados por posicion_en_grupo ASC, grupoNombre ASC
2. "Otros equipos" → todos los demás equipos del torneo (no en pool)

```js
function _renderFormEdicion(esquemaId, crucesBase, pool, allStandings) {
  const poolIds = new Set(pool.map(e => e.pareja_id));

  const clasificados = allStandings
    .filter(s => poolIds.has(s.pareja_id))
    .sort((a, b) => {
      if ((a.posicion_en_grupo || 0) !== (b.posicion_en_grupo || 0))
        return (a.posicion_en_grupo || 0) - (b.posicion_en_grupo || 0);
      return String(a.grupoNombre || '').localeCompare(String(b.grupoNombre || ''));
    });

  const otros = allStandings.filter(s => !poolIds.has(s.pareja_id));

  const buildSelect = (extraClass, selectedId) => {
    const opClas = clasificados.map(s =>
      `<option value="${_esc(s.pareja_id)}"${s.pareja_id === selectedId ? ' selected' : ''}>` +
      `✅ ${_esc(s.nombre)} (${_esc(s.grupoNombre || '?')} ${s.posicion_en_grupo || '?'}°)</option>`
    ).join('');
    const opOtros = otros.map(s =>
      `<option value="${_esc(s.pareja_id)}"${s.pareja_id === selectedId ? ' selected' : ''}>` +
      `${_esc(s.nombre)} (${_esc(s.grupoNombre || '?')})</option>`
    ).join('');

    return `
      <select class="sel-equipo ${_esc(extraClass)}"
              style="flex:1; min-width:130px; max-width:220px; font-size:12px;
                     padding:4px 6px; border:1px solid var(--border); border-radius:6px;">
        <option value="">— elegir —</option>
        ${clasificados.length ? `<optgroup label="Clasificados">${opClas}</optgroup>` : ''}
        ${otros.length ? `<optgroup label="Otros equipos">${opOtros}</optgroup>` : ''}
      </select>
    `;
  };

  const filas = crucesBase.map(c => {
    const rondaLabel = labelRonda(c.ronda, true) + (c.orden ? ` ${c.orden}` : '');
    const idA = c.parejaA?.pareja_id ?? '';
    const idB = c.parejaB?.pareja_id ?? '';

    return `
      <div class="edicion-cruce"
           data-ronda="${_esc(c.ronda)}" data-orden="${c.orden ?? ''}"
           style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;
                  padding:6px 0; border-bottom:1px solid var(--border);">
        <span style="font-size:12px; color:var(--muted); min-width:60px; flex-shrink:0;">${_esc(rondaLabel)}</span>
        ${buildSelect('sel-a', idA)}
        <span style="color:var(--muted); font-size:12px; flex-shrink:0;">vs</span>
        ${buildSelect('sel-b', idB)}
        <span class="cruce-warning" style="font-size:11px; color:#d97706; white-space:nowrap;"></span>
      </div>
    `;
  }).join('');

  return `
    <div style="font-size:12px; font-weight:600; color:var(--muted); margin-bottom:6px;">CRUCES (edición)</div>
    ${filas}
    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button type="button" class="btn-aprobar-editados btn-primary btn-sm"
              data-esquema-id="${_esc(esquemaId)}">
        ✅ Aprobar con estos cruces
      </button>
      <button type="button" class="btn-volver-sugeridos btn-sm"
              data-esquema-id="${_esc(esquemaId)}"
              style="border:1px solid var(--border); background:transparent;">
        ↩ Volver a sugeridos
      </button>
    </div>
  `;
}
```

---

### 5. Nueva función `_activarModoEdicion`

```js
function _activarModoEdicion(container, esquemaId, pool, allStandings) {
  const crucesContainer = container.querySelector(`.cruces-container[data-esquema-id="${esquemaId}"]`);
  if (!crucesContainer) return;

  const crucesBase = _crucesCalculados[esquemaId] || [];
  _crucesEditados[esquemaId] = crucesBase.map(c => ({ ...c }));

  crucesContainer.innerHTML = _renderFormEdicion(esquemaId, crucesBase, pool, allStandings);
  _actualizarSelectores(crucesContainer, allStandings);
}
```

---

### 6. Nueva función `_desactivarModoEdicion`

```js
function _desactivarModoEdicion(container, esquemaId, esq, pool, allStandings, standingsData) {
  const crucesContainer = container.querySelector(`.cruces-container[data-esquema-id="${esquemaId}"]`);
  if (!crucesContainer) return;

  delete _crucesEditados[esquemaId];

  const cruces = _crucesCalculados[esquemaId] || [];
  const { warnings } = detectarEmpates(pool, allStandings, esq.reglas);
  crucesContainer.innerHTML = _renderCrucesReadOnly(esq, pool, cruces, warnings, standingsData);
}
```

---

### 7. Nueva función `_actualizarSelectores`

Aplica auto-dedup (deshabilita en otros slots los equipos ya seleccionados) y actualiza warnings inline por cruce.

```js
function _actualizarSelectores(crucesContainer, allStandings) {
  const standingsMap = Object.fromEntries(allStandings.map(s => [s.pareja_id, s]));
  const filas = crucesContainer.querySelectorAll('.edicion-cruce');

  // Paso 1: recolectar todos los valores seleccionados
  // Map: pareja_id → Array de { filaIdx, slot }
  const seleccionados = new Map();
  filas.forEach((fila, filaIdx) => {
    ['a', 'b'].forEach(slot => {
      const sel = fila.querySelector(`.sel-${slot}`);
      const val = sel?.value;
      if (val) {
        if (!seleccionados.has(val)) seleccionados.set(val, []);
        seleccionados.get(val).push({ filaIdx, slot });
      }
    });
  });

  // Paso 2: deshabilitar opciones usadas en OTROS slots
  filas.forEach((fila, filaIdx) => {
    ['a', 'b'].forEach(slot => {
      const sel = fila.querySelector(`.sel-${slot}`);
      if (!sel) return;
      Array.from(sel.options).forEach(opt => {
        if (!opt.value) return; // skip "— elegir —"
        const usados = seleccionados.get(opt.value) || [];
        const usadoEnOtroLado = usados.some(u => !(u.filaIdx === filaIdx && u.slot === slot));
        opt.disabled = usadoEnOtroLado;
      });
    });

    // Paso 3: actualizar warning inline de la fila
    const selA = fila.querySelector('.sel-a');
    const selB = fila.querySelector('.sel-b');
    const warnEl = fila.querySelector('.cruce-warning');
    if (!warnEl) return;

    const teamA = selA?.value ? standingsMap[selA.value] : null;
    const teamB = selB?.value ? standingsMap[selB.value] : null;

    const warns = [];
    if (teamA && teamB && teamA.grupo_id && teamA.grupo_id === teamB.grupo_id) {
      warns.push('⚠️ mismo grupo');
    }
    warnEl.textContent = warns.join(' ');
  });
}
```

---

### 8. Nueva función `_crucesDesdeForm`

Convierte el estado del formulario en Array<cruce> compatible con `crearPartidosCopa`.

Si hay slots vacíos, muestra `confirm()` preguntando si continuar igual. Si cancela, retorna `null`.

```js
function _crucesDesdeForm(crucesContainer, allStandings) {
  const standingsMap = Object.fromEntries(allStandings.map(s => [s.pareja_id, s]));
  const filas = crucesContainer.querySelectorAll('.edicion-cruce');

  const cruces = [];
  let hayVacios = false;

  filas.forEach(fila => {
    const ronda = fila.dataset.ronda;
    const orden = fila.dataset.orden ? Number(fila.dataset.orden) : null;
    const idA   = fila.querySelector('.sel-a')?.value || null;
    const idB   = fila.querySelector('.sel-b')?.value || null;

    if (!idA || !idB) hayVacios = true;

    const teamA = idA ? (standingsMap[idA] ?? { pareja_id: idA }) : null;
    const teamB = idB ? (standingsMap[idB] ?? { pareja_id: idB }) : null;

    cruces.push({
      ronda,
      orden,
      parejaA:  teamA,
      parejaB:  teamB,
      endogeno: !!(teamA && teamB && teamA.grupo_id && teamA.grupo_id === teamB.grupo_id)
    });
  });

  if (hayVacios) {
    const ok = window.confirm('Hay slots sin equipo asignado. ¿Aprobar igual con cruces incompletos?');
    if (!ok) return null;
  }

  return cruces;
}
```

---

### 9. Nueva función `_aprobarCopa`

Extrae la lógica de aprobación compartida entre "Aprobar copa" y "Aprobar con estos cruces".

```js
async function _aprobarCopa(btn, esquemaId, cruces, onRefresh) {
  btn.disabled    = true;
  btn.textContent = '⏳ Creando partidos…';

  const { ok, partidos_creados, msg } = await crearPartidosCopa(supabase, esquemaId, cruces);

  if (ok) {
    logMsg(`✅ Copa aprobada — ${partidos_creados} partidos creados`);
    onRefresh?.();
  } else {
    logMsg(`❌ Error: ${msg}`);
    btn.disabled    = false;
    btn.textContent = btn.classList.contains('btn-aprobar-editados')
      ? '✅ Aprobar con estos cruces'
      : '✅ Aprobar copa';
  }
}
```

---

### 10. `_wireStatusEvents` — reemplazar completo

Reemplazar la función completa por esta versión que usa **event delegation** en el container.
El delegated listener maneja TODOS los botones (no solo los nuevos), para sobrevivir a los reemplazos de innerHTML de `.cruces-container`.
El handler del reset se extrae a `_handleResetClick` para mayor legibilidad.

```js
function _wireStatusEvents(container, esquemas, standingsData, onRefresh) {
  const esqMap      = Object.fromEntries(esquemas.map(e => [e.id, e]));
  const allStandings = standingsData.standings || [];

  // ---- Delegated click handler ----
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // Aprobar copa (cruces calculados, modo read-only)
    if (btn.classList.contains('btn-aprobar-copa')) {
      const esquemaId = btn.dataset.esquemaId;
      const cruces    = _crucesCalculados[esquemaId];
      if (!cruces?.length) { logMsg('❌ No hay cruces calculados para aprobar'); return; }
      await _aprobarCopa(btn, esquemaId, cruces, onRefresh);
      return;
    }

    // Editar cruces
    if (btn.classList.contains('btn-editar-cruces')) {
      const esquemaId = btn.dataset.esquemaId;
      const esq       = esqMap[esquemaId];
      if (!esq) return;
      const { pool } = armarPoolParaCopa(standingsData.standings, standingsData.grupos, esq.reglas, new Set());
      _activarModoEdicion(container, esquemaId, pool, allStandings);
      return;
    }

    // Aprobar con cruces editados
    if (btn.classList.contains('btn-aprobar-editados')) {
      const esquemaId      = btn.dataset.esquemaId;
      const crucesContainer = container.querySelector(`.cruces-container[data-esquema-id="${esquemaId}"]`);
      if (!crucesContainer) return;
      const cruces = _crucesDesdeForm(crucesContainer, allStandings);
      if (!cruces) return; // usuario canceló
      await _aprobarCopa(btn, esquemaId, cruces, onRefresh);
      return;
    }

    // Volver a sugeridos
    if (btn.classList.contains('btn-volver-sugeridos')) {
      const esquemaId = btn.dataset.esquemaId;
      const esq       = esqMap[esquemaId];
      if (!esq) return;
      const { pool } = armarPoolParaCopa(standingsData.standings, standingsData.grupos, esq.reglas, new Set());
      _desactivarModoEdicion(container, esquemaId, esq, pool, allStandings, standingsData);
      return;
    }

    // Editar plan
    if (btn.id === 'btn-editar-plan') {
      const { renderPlanEditor } = await import('./planEditor.js');
      const co = document.getElementById('copas-admin');
      if (co) renderPlanEditor(co, onRefresh, esquemas);
      return;
    }

    // Reset copas
    if (btn.id === 'btn-reset-copas') {
      _handleResetClick(container, btn, onRefresh);
      return;
    }
  });

  // ---- Delegated change handler (selects en modo edición) ----
  container.addEventListener('change', (e) => {
    if (e.target.classList.contains('sel-equipo')) {
      const crucesContainer = e.target.closest('.cruces-container');
      if (crucesContainer) _actualizarSelectores(crucesContainer, allStandings);
    }
  });
}
```

---

### 11. Nueva función `_handleResetClick`

Extrae el handler de reset del antiguo `_wireStatusEvents`. **Es exactamente el mismo código**, solo movido a su propia función.

```js
function _handleResetClick(container, btn, onRefresh) {
  const dialog = document.createElement('div');
  dialog.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;';
  dialog.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:20px;max-width:340px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
      <div style="font-weight:700;font-size:16px;margin-bottom:6px;">🔄 RESET COPAS</div>
      <p style="font-size:14px;color:#374151;margin-bottom:14px;">¿Qué querés resetear?</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button id="dlg-solo-resultados" style="text-align:left;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;cursor:pointer;">
          <div style="font-weight:600;font-size:14px;">Solo resultados</div>
          <div style="font-size:12px;color:#6b7280;margin-top:3px;">Limpia scores de partidos de copa. Mantiene partidos y plan.</div>
        </button>
        <button id="dlg-todo-copas" style="text-align:left;padding:12px 14px;border:1px solid #fca5a5;border-radius:8px;background:#fff7f7;cursor:pointer;">
          <div style="font-weight:600;font-size:14px;color:#dc2626;">Todo (partidos + plan)</div>
          <div style="font-size:12px;color:#6b7280;margin-top:3px;">Borra partidos de copa, copas y esquemas. Vuelve al paso "Definir plan".</div>
        </button>
        <button id="dlg-cancelar" style="padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:transparent;cursor:pointer;font-size:14px;">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  const closeDialog = () => dialog.remove();
  dialog.querySelector('#dlg-cancelar').addEventListener('click', closeDialog);
  dialog.addEventListener('click', e => { if (e.target === dialog) closeDialog(); });

  dialog.querySelector('#dlg-solo-resultados').addEventListener('click', async () => {
    closeDialog();
    btn.disabled    = true;
    btn.textContent = '⏳ Limpiando…';

    const copaIds = await _getCopaIds();
    if (!copaIds.length) {
      logMsg('⚠️ No hay copas para limpiar');
      btn.disabled    = false;
      btn.textContent = '🗑 Reset copas';
      return;
    }

    const { error } = await supabase
      .from('partidos')
      .update({
        set1_a: null, set1_b: null,
        set2_a: null, set2_b: null,
        set3_a: null, set3_b: null,
        set1_temp_a: null, set1_temp_b: null,
        set2_temp_a: null, set2_temp_b: null,
        set3_temp_a: null, set3_temp_b: null,
        estado: 'pendiente',
        cargado_por_pareja_id: null,
        notas_revision: null,
      })
      .in('copa_id', copaIds);

    if (error) {
      logMsg(`❌ Error limpiando resultados: ${error.message}`);
    } else {
      logMsg('✅ Resultados de copas limpiados — partidos y plan conservados');
      onRefresh?.();
    }
    btn.disabled    = false;
    btn.textContent = '🗑 Reset copas';
  });

  dialog.querySelector('#dlg-todo-copas').addEventListener('click', async () => {
    closeDialog();
    btn.disabled    = true;
    btn.textContent = '⏳ Reseteando…';

    const result = await resetCopas(supabase, TORNEO_ID);
    if (result.ok) {
      Object.keys(_crucesCalculados).forEach(k => delete _crucesCalculados[k]);
      Object.keys(_crucesEditados).forEach(k => delete _crucesEditados[k]);
      logMsg(`✅ Reset listo — ${result.partidos_borrados} partidos y ${result.copas_borradas} copas borradas`);
      onRefresh?.();
    } else {
      logMsg(`❌ Error en reset: ${result.msg}`);
      btn.disabled    = false;
      btn.textContent = '🗑 Reset copas';
    }
  });
}
```

> **Nota**: En el handler de "Todo (partidos + plan)", agregar la limpieza de `_crucesEditados` además de `_crucesCalculados`.

---

## Resumen de cambios en `statusView.js`

| Sección | Acción | Descripción |
|---|---|---|
| Module-level | **Agregar** | `const _crucesEditados = {}` |
| `_renderEsquemaPorAprobar` | **Reemplazar** | Envuelve cruces en `.cruces-container`, delega a `_renderCrucesReadOnly` |
| `_renderCrucesReadOnly` | **Nueva función** | Contenido read-only de `.cruces-container` + botón "Editar cruces" |
| `_renderFormEdicion` | **Nueva función** | Selectores de edición con optgroups clasificados/otros |
| `_activarModoEdicion` | **Nueva función** | Reemplaza innerHTML de `.cruces-container` con el form |
| `_desactivarModoEdicion` | **Nueva función** | Restaura innerHTML read-only al volver a sugeridos |
| `_actualizarSelectores` | **Nueva función** | Auto-dedup + warning "mismo grupo" por cruce |
| `_crucesDesdeForm` | **Nueva función** | Lee selects → Array<cruce> con confirm si hay vacíos |
| `_aprobarCopa` | **Nueva función** | Lógica compartida de aprobación (extraída de handler) |
| `_wireStatusEvents` | **Reemplazar** | Event delegation para todos los botones |
| `_handleResetClick` | **Nueva función** | Lógica del reset dialog (extraída de `_wireStatusEvents`) |

---

## Pasos finales obligatorios

1. `npm run build` — verificar que compila sin errores
2. Test manual (ver sección siguiente)
3. Actualizar `docs/brainstorming-proximas-mejoras.md`:
   - Agregar E4b al historial de "Copa Approval v2"
4. `npm version patch` y `git push --follow-tags`

---

## Verificación

### Flujo básico
1. Abrir admin.html → Tab Copas → estado "Listo para aprobar" (grupos completos, sin copa creada)
2. Verificar que aparecen los botones "✅ Aprobar copa" y "✏️ Editar cruces"
3. Click "✏️ Editar cruces" → el bloque CRUCES se reemplaza por selectores
4. Verificar que los clasificados aparecen en el optgroup "Clasificados" con ✅ prefijo y detalle `(Grupo X N°)`
5. Verificar que los otros equipos del torneo aparecen en "Otros equipos"
6. Seleccionar el mismo equipo en dos slots → verificar que en el segundo slot ese equipo queda deshabilitado
7. Seleccionar dos equipos del mismo grupo → verificar que aparece "⚠️ mismo grupo" en esa fila
8. Click "↩ Volver a sugeridos" → vuelve la vista read-only con los cruces originales
9. Click "✏️ Editar cruces" de nuevo → modificar un cruce → click "✅ Aprobar con estos cruces"
10. Verificar en log: "✅ Copa aprobada — N partidos creados"
11. La vista cambia a modo "En curso" mostrando los partidos con los equipos editados

### Flujo con slots vacíos
1. Entrar modo edición → borrar un equipo (seleccionar "— elegir —") → click aprobar
2. Verificar que aparece `confirm()`: "Hay slots sin equipo asignado. ¿Aprobar igual?"
3. Click Cancelar → se queda en edición
4. Click Aceptar → aprueba con slot vacío (partido con TBD)

### Reset en modo edición
1. Entrar modo edición de una copa → click "🗑 Reset copas" → "Todo"
2. Verificar que el reset funciona y vuelve al estado inicial (sin error JS)
