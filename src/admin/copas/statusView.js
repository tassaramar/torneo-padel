/**
 * Vista de estado de copas — v2
 * Pipeline: standings → pool → matchups → render
 * Sin propuestas_copa: los cruces se derivan client-side.
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';
import { resetCopas, crearPartidosCopa } from './planService.js';
import {
  armarPoolParaCopa,
  seedingMejorPeor,
  seedingParcial,
  optimizarEndogenos,
  detectarEmpates
} from '../../utils/copaMatchups.js';
import { formatearResultado } from '../../utils/formatoResultado.js';
import { labelRonda } from '../../utils/copaRondas.js';

// Cruces calculados durante el render — accesibles en los event handlers
const _crucesCalculados = {}; // esquemaId → Array<cruce>
const _crucesEditados = {}; // esquemaId → Array<cruce> (copia editable)

// ============================================================
// Entrada pública
// ============================================================

/**
 * @param {HTMLElement} container
 * @param {Array}    esquemas      - Esquemas del torneo (de cargarEsquemas)
 * @param {Array}    copas         - Copas existentes (id, nombre, esquema_copa_id)
 * @param {Object}   standingsData - { standings, grupos, todosCompletos }
 * @param {Function} onRefresh     - Callback para re-render
 */
export async function renderStatusView(container, esquemas, copas, standingsData, onRefresh) {
  // 1. Cargar partidos de copas existentes
  const copaIds = (copas || []).map(c => c.id);
  const partidosPorCopa = {};

  if (copaIds.length > 0) {
    const { data: partidos } = await supabase
      .from('partidos')
      .select(`
        id, copa_id, ronda_copa, orden_copa, estado,
        sets_a, sets_b,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b,
        stb_puntos_a, stb_puntos_b,
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .in('copa_id', copaIds)
      .order('orden_copa', { ascending: true });

    (partidos || []).forEach(p => {
      if (!partidosPorCopa[p.copa_id]) partidosPorCopa[p.copa_id] = [];
      partidosPorCopa[p.copa_id].push(p);
    });
  }

  // 2. Mapa copa por esquema
  const copaPorEsquema = {};
  (copas || []).forEach(c => {
    if (c.esquema_copa_id) copaPorEsquema[c.esquema_copa_id] = c;
  });

  // 3. Verificar si todos los grupos están completos
  const allGroupsComplete = (standingsData.grupos || []).length > 0 &&
    (standingsData.grupos || []).every(g =>
      (standingsData.standings || []).some(s => s.grupo_id === g.id && s.grupo_completo)
    );

  // 4. Posiciones de quiebre (para filtrar warnings inter-grupo irrelevantes)
  const quiebrePos = _posicionesQuiebre(esquemas);
  const _filtrarWarnings = (warnings) => warnings.filter(w => {
    if (w.tipo === 'empate_inter_grupo') return quiebrePos.has(w.posicion);
    return true;
  });

  // 5. Render por esquema
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

    // Calcular pool parcial (excluye equipos ya usados)
    const { pool, pendientes } = armarPoolParaCopa(
      standingsData.standings, standingsData.grupos, esq.reglas, equiposYaUsadosIds
    );

    // Estado 2: bracket incompleto con partidos ya aprobados, o algunos grupos completos (no todos)
    if (partidos.length > 0 || (!allGroupsComplete && pool.length >= 2)) {
      const cruces = seedingParcial(pool, tamañoBracket);
      const crucesOpt = optimizarEndogenos(cruces, equiposYaUsadosIds);
      const { warnings: rawWarnings } = detectarEmpates(pool, standingsData.standings, esq.reglas);
      const warnings = _filtrarWarnings(rawWarnings);

      _crucesCalculados[esq.id] = crucesOpt;

      return _renderEsquemaParcial(esq, copa, partidos, crucesOpt, warnings,
                                    standingsData, pendientes, equiposYaUsadosIds);
    }

    // Estado 3: todos los grupos completos, sin partidos → aprobar completo
    if (allGroupsComplete) {
      const crucesSeed = seedingMejorPeor(pool);
      const cruces     = optimizarEndogenos(crucesSeed, new Set());
      const { warnings: rawWarnings } = detectarEmpates(pool, standingsData.standings, esq.reglas);
      const warnings = _filtrarWarnings(rawWarnings);
      _crucesCalculados[esq.id] = cruces;
      return _renderEsquemaPorAprobar(esq, pool, cruces, warnings, standingsData);
    }

    // Estado 4: nada todavía → esperar
    return _renderEsquemaEsperando(esq, standingsData);
  }).join('');

  // Reminder de sorteos si hay alguno guardado
  const haySorteoIntra = (standingsData.standings || []).some(s => s.sorteo_orden);
  const haySorteoInter = (standingsData.standings || []).some(s => s.sorteo_inter);
  let sorteoReminder = '';
  if (haySorteoIntra || haySorteoInter) {
    const partes = [];
    if (haySorteoIntra) partes.push('intra-grupo');
    if (haySorteoInter) partes.push('inter-grupo');
    sorteoReminder = `<div style="margin-bottom:12px; padding:8px 12px; border-radius:8px; background:#ede9fe; border:1px solid #c4b5fd; font-size:13px; color:#5b21b6;">
      🎲 Hay sorteos guardados (${partes.join(' + ')}) que afectan el seeding. Podés revisarlos en <strong>Tab Grupos</strong>.
    </div>`;
  }

  container.innerHTML = `
    <div class="copa-status-section">
      ${sorteoReminder}
      ${seccionesHtml}
      <div class="admin-actions" style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
        <button type="button" id="btn-editar-plan" class="btn-sm"
                style="border:1px solid var(--border); background:transparent;">
          ✏️ Editar plan
        </button>
        <button type="button" id="btn-reset-copas" class="btn-sm btn-danger">
          🗑 Reset copas
        </button>
      </div>
    </div>
  `;

  _wireStatusEvents(container, esquemas, standingsData, onRefresh);
}

// ============================================================
// Render: esquema listo para aprobar (todos los grupos completos)
// ============================================================

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

// ============================================================
// Render: contenido read-only del cruces-container
// ============================================================

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
    ${_renderBracket(_normalizarCrucesParaBracket(cruces))}
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

// ============================================================
// Render: formulario de edición de cruces
// ============================================================

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
      `${_esc(s.nombre)} (${_esc(s.grupoNombre || '?')} ${s.posicion_en_grupo || '?'}°)</option>`
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

// ============================================================
// Modo edición: activar / desactivar
// ============================================================

function _activarModoEdicion(container, esquemaId, pool, allStandings) {
  const crucesContainer = container.querySelector(`.cruces-container[data-esquema-id="${esquemaId}"]`);
  if (!crucesContainer) return;

  const crucesBase = _crucesCalculados[esquemaId] || [];
  _crucesEditados[esquemaId] = crucesBase.map(c => ({ ...c }));

  crucesContainer.innerHTML = _renderFormEdicion(esquemaId, crucesBase, pool, allStandings);
  _actualizarSelectores(crucesContainer, allStandings);
}

function _desactivarModoEdicion(container, esquemaId, esq, pool, allStandings, standingsData) {
  const crucesContainer = container.querySelector(`.cruces-container[data-esquema-id="${esquemaId}"]`);
  if (!crucesContainer) return;

  delete _crucesEditados[esquemaId];

  const cruces = _crucesCalculados[esquemaId] || [];
  const { warnings } = detectarEmpates(pool, allStandings, esq.reglas);
  crucesContainer.innerHTML = _renderCrucesReadOnly(esq, pool, cruces, warnings, standingsData);
}

// ============================================================
// Helpers para aprobación parcial
// ============================================================

/**
 * Calcula el tamaño total del bracket (número de equipos clasificados) según las reglas.
 */
function _calcularTamañoBracket(reglas, grupos) {
  const hasGlobal = (reglas || []).some(r => r.modo === 'global');
  if (hasGlobal) {
    const rule = reglas.find(r => r.modo === 'global');
    return (rule.hasta || 4) - (rule.desde || 1) + 1;
  }
  // Por posición: sumar cuántos equipos clasifican
  let total = 0;
  for (const r of (reglas || [])) {
    if (r.criterio && r.cantidad) {
      total += r.cantidad;
    } else {
      total += (grupos || []).length; // uno por grupo
    }
  }
  return total;
}

/**
 * Calcula posiciones de grupo que son "quiebre" entre copas.
 * Un quiebre existe cuando un esquema usa regla con criterio+cantidad
 * (ej: "el mejor 2°"), lo que significa que no todos los equipos de esa
 * posición van a la misma copa → el orden entre ellos importa.
 */
function _posicionesQuiebre(esquemas) {
  const quiebre = new Set();
  for (const esq of (esquemas || [])) {
    for (const r of (esq.reglas || [])) {
      if (r.criterio && r.cantidad != null) {
        quiebre.add(r.posicion);
      }
    }
  }
  return quiebre;
}

/**
 * Combina partidos existentes (de BD) con cruces parciales (calculados client-side)
 * para alimentar _renderBracket. Si un slot ya tiene partido en BD, se usa ese.
 */
function _mergeBracketData(partidosExistentes, crucesParciales) {
  const normPartidos = _normalizarPartidosParaBracket(partidosExistentes || []);
  const normCruces   = _normalizarCrucesParaBracket(crucesParciales || []);

  // Mapa de partidos existentes: "ronda:orden" → partido normalizado
  const partidosMap = new Map();
  for (const p of normPartidos) {
    partidosMap.set(`${p.ronda}:${p.orden}`, p);
  }

  // Para cada slot calculado, usar partido existente si hay
  return normCruces.map(cruce => {
    const key = `${cruce.ronda}:${cruce.orden}`;
    return partidosMap.get(key) || cruce;
  });
}

// ============================================================
// Auto-dedup + warnings inline
// ============================================================

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

// ============================================================
// Leer cruces desde el formulario
// ============================================================

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

// ============================================================
// Aprobación compartida
// ============================================================

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

// ============================================================
// Eventos (event delegation)
// ============================================================

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

    // Aprobar cruce individual (modo parcial)
    if (btn.classList.contains('btn-aprobar-cruce')) {
      const esquemaId = btn.dataset.esquemaId;
      const ronda     = btn.dataset.ronda;
      const orden     = Number(btn.dataset.orden);

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

// ============================================================
// Reset dialog
// ============================================================

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
      // Limpiar sorteos inter-grupo (intra-grupo son independientes del sistema de copas)
      await supabase.from('sorteos').delete()
        .eq('torneo_id', TORNEO_ID)
        .eq('tipo', 'inter_grupo');

      Object.keys(_crucesCalculados).forEach(k => delete _crucesCalculados[k]);
      Object.keys(_crucesEditados).forEach(k => delete _crucesEditados[k]);
      logMsg(`✅ Reset listo — ${result.partidos_borrados} partidos y ${result.copas_borradas} copas borradas (sorteos limpiados)`);
      onRefresh?.();
    } else {
      logMsg(`❌ Error en reset: ${result.msg}`);
      btn.disabled    = false;
      btn.textContent = '🗑 Reset copas';
    }
  });
}

// ============================================================
// Render: warnings de empates
// ============================================================

function _renderWarnings(warnings, esquemaId) {
  if (!warnings?.length) return '';

  return warnings.map(w => {
    if (w.tipo === 'empate_intra_grupo') {
      return `
        <div style="font-size:12px; color:#d97706; margin-bottom:8px; padding:6px 10px;
                    background:rgba(251,191,36,0.1); border-radius:6px; border-left:3px solid #d97706;">
          ⚠️ Empate en <strong>Grupo ${_esc(w.grupoNombre)}</strong> (posiciones ${_esc(w.posiciones)}) —
          Resolvelo haciendo el sorteo desde el <strong>Tab Grupos</strong>.
        </div>
      `;
    }

    if (w.tipo === 'empate_inter_grupo') {
      const equiposStr = (w.equipos || []).map(e =>
        `${_esc(e.nombre)} (${_esc(e.grupoNombre || '')} ${w.posicion}°)`
      ).join(', ');
      return `
        <div style="font-size:12px; color:#d97706; margin-bottom:8px; padding:6px 10px;
                    background:rgba(251,191,36,0.1); border-radius:6px; border-left:3px solid #d97706;">
          ⚠️ Empate entre equipos del mismo tier (${w.posicion}° de grupo): ${equiposStr}
          — Resolvelo haciendo el sorteo desde el <strong>Tab Grupos</strong>.
        </div>
      `;
    }

    if (w.tipo === 'empate_frontera') {
      const equiposStr = (w.equipos || []).map(e =>
        `${_esc(e.nombre)} (${_esc(e.grupoNombre)})`
      ).join(', ');
      return `
        <div style="font-size:12px; color:#d97706; margin-bottom:8px; padding:6px 10px;
                    background:rgba(251,191,36,0.1); border-radius:6px; border-left:3px solid #d97706;">
          ⚠️ Empate en la frontera de clasificación (${_esc(w.detalle)}):
          ${equiposStr}
        </div>
      `;
    }

    return '';
  }).join('');
}

// ============================================================
// Render: tabla general de clasificados (acordeón)
// ============================================================

/**
 * Tabla general con ORDER BY: posicion_en_grupo ASC → P → DS → DG → GF → sorteo_orden → nombre
 * Marca con ✅ a los equipos clasificados para esta copa.
 * Separa con línea divisoria cuando cambia el tier (posicion_en_grupo).
 *
 * @param {Object} standingsData - { standings, grupos }
 * @param {Array}  clasificadosIds - Array de pareja_id que clasificaron
 */
function _renderTablaGeneral(standingsData, clasificadosIds) {
  const { standings } = standingsData || {};
  if (!standings?.length) return '';

  const clasificadosSet = new Set(clasificadosIds || []);

  // ORDER BY: posicion_en_grupo ASC, puntos DESC, ds DESC, dg DESC, gf DESC, sorteo_orden ASC, nombre
  const sorted = [...standings].sort((a, b) => {
    const posA = a.posicion_en_grupo ?? 999;
    const posB = b.posicion_en_grupo ?? 999;
    if (posA !== posB) return posA - posB;
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.ds !== a.ds) return b.ds - a.ds;
    if ((b.dg || 0) !== (a.dg || 0)) return (b.dg || 0) - (a.dg || 0);
    if (b.gf !== a.gf) return b.gf - a.gf;
    const sA = a.sorteo_orden ?? 999999;
    const sB = b.sorteo_orden ?? 999999;
    if (sA !== sB) return sA - sB;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''));
  });

  const COL = {
    num:   'min-width:22px; text-align:right;',
    check: 'min-width:18px; text-align:center;',
    pts:   'min-width:30px; text-align:right;',
    ds:    'min-width:34px; text-align:right;',
    dg:    'min-width:34px; text-align:right;',
    gf:    'min-width:26px; text-align:right;',
    grp:   'min-width:64px;'
  };

  let lastTier = null;
  const rows = sorted.map((team, idx) => {
    const esClasif   = clasificadosSet.has(team.pareja_id);
    const tierActual = team.posicion_en_grupo;
    const divider    = lastTier !== null && tierActual !== lastTier
      ? '<div style="border-top:1px dashed #d1d5db; margin:4px 0;"></div>'
      : '';
    lastTier = tierActual;

    const dgVal = team.dg ?? 0;
    const dsVal = team.ds ?? 0;

    return `
      ${divider}
      <div style="display:flex; align-items:center; gap:10px; padding:3px 0; font-size:12px;
                  ${!esClasif ? 'opacity:0.5;' : ''}">
        <span style="${COL.num} color:var(--muted);">${idx + 1}.</span>
        <span style="${COL.check}">${esClasif ? '✅' : ''}</span>
        <span style="flex:1; font-weight:${esClasif ? '500' : '400'};">${_esc(team.nombre)}</span>
        <span style="${COL.pts} color:var(--muted);">${team.puntos}</span>
        <span style="${COL.ds} color:var(--muted);">${_signo(dsVal)}${Math.abs(dsVal)}</span>
        <span style="${COL.dg} color:var(--muted);">${_signo(dgVal)}${Math.abs(dgVal)}</span>
        <span style="${COL.gf} color:var(--muted);">${team.gf ?? 0}</span>
        <span style="${COL.grp} color:var(--muted); font-size:11px; white-space:nowrap;">${_esc(team.grupoNombre || '')} ${tierActual || ''}°</span>
      </div>
    `;
  }).join('');

  return `
    <details style="margin:8px 0 2px;">
      <summary style="cursor:pointer; font-size:12px; color:var(--muted); user-select:none; padding:2px 0;">
        Ver clasificados (${sorted.length} equipos)
      </summary>
      <div style="margin-top:6px; padding:8px; background:#f9fafb;
                  border-radius:8px; border:1px solid var(--border); overflow-x:auto;">
        <div style="display:flex; gap:10px; padding-bottom:4px; margin-bottom:4px;
                    font-size:11px; font-weight:600; color:var(--muted);
                    border-bottom:1px solid var(--border);">
          <span style="${COL.num}">#</span>
          <span style="${COL.check}"></span>
          <span style="flex:1;">Pareja</span>
          <span style="${COL.pts}">Pts</span>
          <span style="${COL.ds}">DS</span>
          <span style="${COL.dg}">DG</span>
          <span style="${COL.gf}">GF</span>
          <span style="${COL.grp}">Grupo</span>
        </div>
        ${rows}
      </div>
    </details>
  `;
}

// ============================================================
// Render: esquema con aprobación parcial
// ============================================================

function _renderEsquemaParcial(esq, copa, partidosExistentes, crucesParciales, warnings,
                                standingsData, pendientes, equiposYaUsadosIds) {
  const hayWarningsBloqueantes = (warnings || []).some(
    w => w.tipo === 'empate_frontera' || w.tipo === 'empate_inter_grupo'
  );
  const borderColor = hayWarningsBloqueantes ? '#f59e0b' : '#e5e7eb';
  const bgColor     = hayWarningsBloqueantes ? 'rgba(251,191,36,0.06)' : 'var(--surface,#fff)';

  // Bracket combinando partidos existentes + cruces nuevos + pendientes
  const bracketData = _mergeBracketData(partidosExistentes, crucesParciales);

  // Warnings con UI interactiva para empate inter-grupo
  const warningsHtml = _renderWarnings(warnings || [], esq.id);

  // Info de grupos pendientes
  const gruposPendientesNombres = (pendientes || [])
    .map(p => p.grupoNombre || p.grupoId).join(', ');
  const progressHtml = gruposPendientesNombres
    ? `<div style="font-size:12px; color:var(--muted); margin:8px 0;">
         ⏳ Esperando ${_esc(gruposPendientesNombres)} para completar el cuadro
       </div>`
    : '';

  // Cruces approvables individualmente (ambos equipos definidos, no están en BD)
  const partidosExistentesKeys = new Set(
    (partidosExistentes || []).map(p => `${p.ronda_copa}:${p.orden_copa}`)
  );
  const crucesApprovables = (crucesParciales || []).filter(c => {
    if (!c.parejaA?.pareja_id || !c.parejaB?.pareja_id) return false;
    return !partidosExistentesKeys.has(`${c.ronda}:${c.orden}`);
  });

  const crucesApprovablesHtml = crucesApprovables.length > 0 ? `
    <div class="cruces-approvables" data-esquema-id="${_esc(esq.id)}" style="margin-top:8px;">
      <div style="font-size:12px; font-weight:600; margin-bottom:6px; color:var(--muted);">CRUCES LISTOS</div>
      ${crucesApprovables.map(c => {
        const rondaLabel = labelRonda(c.ronda, true);
        const nombreA = _esc(c.parejaA.nombre || c.parejaA.pareja_id);
        const nombreB = _esc(c.parejaB.nombre || c.parejaB.pareja_id);
        return `
          <div class="cruce-approvable" data-ronda="${_esc(c.ronda)}" data-orden="${c.orden}"
               style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--border);">
            <span style="font-size:12px; color:var(--muted); min-width:40px;">${_esc(rondaLabel)} ${c.orden}</span>
            <span style="flex:1; font-size:13px;">${nombreA} vs ${nombreB}</span>
            <button class="btn-aprobar-cruce btn-primary btn-sm"
                    data-esquema-id="${_esc(esq.id)}" data-ronda="${_esc(c.ronda)}" data-orden="${c.orden}">
              ✅ Aprobar
            </button>
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  // Tabla de clasificados parcial
  const poolIds = (crucesParciales || [])
    .flatMap(c => [c.parejaA?.pareja_id, c.parejaB?.pareja_id])
    .filter(Boolean);
  const tablaHtml = _renderTablaGeneral(standingsData, poolIds);

  const gruposCompletos = (standingsData.grupos || []).filter(g =>
    (standingsData.standings || []).some(s => s.grupo_id === g.id && s.grupo_completo)
  ).length;
  const gruposTotal = (standingsData.grupos || []).length;

  return `
    <div class="copa-seccion" data-esquema-id="${_esc(esq.id)}"
         style="border:1px solid ${borderColor}; border-radius:12px;
                padding:12px 14px; margin-bottom:10px; background:${bgColor};">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <strong>${_esc(esq.nombre)}</strong>
        <span style="font-size:12px; color:#f59e0b;">🏗️ Parcial (${gruposCompletos} de ${gruposTotal} grupos)</span>
      </div>
      ${warningsHtml}
      <div class="cruces-container" data-esquema-id="${_esc(esq.id)}">
        ${_renderBracket(bracketData)}
        ${progressHtml}
        ${crucesApprovablesHtml}
        ${tablaHtml}
      </div>
    </div>
  `;
}

// ============================================================
// Render: esquema esperando grupos
// ============================================================

function _renderEsquemaEsperando(esq, standingsData) {
  const { grupos, standings } = standingsData || {};
  const gruposTotal     = grupos?.length || 0;
  const gruposCompletos = (grupos || []).filter(g =>
    (standings || []).some(s => s.grupo_id === g.id && s.grupo_completo)
  );

  const hasGlobal = (esq.reglas || []).some(r => r.modo === 'global');
  const nota = hasGlobal
    ? `Los cruces se generan cuando <strong>todos</strong> los grupos terminen (seeding global).`
    : `Los cruces aparecerán cuando todos los grupos terminen.`;

  return `
    <div class="copa-seccion"
         style="border:1px solid var(--border,#e5e7eb); border-radius:12px;
                padding:12px 14px; margin-bottom:10px; opacity:0.75;">
      <div style="display:flex; align-items:center; gap:8px;">
        <strong>${_esc(esq.nombre)}</strong>
        <span style="font-size:12px; color:var(--muted);">⏳ Esperando grupos…</span>
      </div>
      <div style="font-size:12px; color:var(--muted); margin-top:4px;">
        Grupos completos: ${gruposCompletos.length} de ${gruposTotal}
      </div>
      <div style="font-size:12px; color:var(--muted);">${nota}</div>
    </div>
  `;
}

// ============================================================
// Render: esquema en curso (partidos ya creados)
// ============================================================

function _renderEsquemaEnCurso(esq, copa, partidos) {
  const semis   = partidos.filter(p => p.ronda_copa === 'SF');
  const final   = partidos.find(p => p.ronda_copa === 'F');
  const directo = partidos.find(p => p.ronda_copa === 'direct');

  const semisConfirmadas = semis.filter(s => s.estado === 'confirmado').length;
  const pendFinal = semis.length >= 2 && semisConfirmadas === semis.length && !final && !directo;
  const autoFinalHint = pendFinal
    ? `<p style="font-size:12px; color:var(--muted); margin-top:8px;">
         → Final se generará automáticamente al confirmar semis
       </p>`
    : '';

  return `
    <div class="copa-seccion" data-esquema-id="${esq.id}"
         style="border:1px solid var(--border,#e5e7eb); border-radius:12px;
                padding:12px 14px; margin-bottom:10px; background:var(--surface,#fff);">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <strong>${_esc(esq.nombre)}</strong>
        <span style="font-size:12px; color:#16a34a;">✅ En curso</span>
      </div>
      ${_renderBracket(_normalizarPartidosParaBracket(partidos))}
      ${autoFinalHint}
    </div>
  `;
}

// ============================================================
// Bracket helpers
// ============================================================

function _normalizarCrucesParaBracket(cruces) {
  return (cruces || []).map(c => ({
    ronda:    c.ronda,
    orden:    c.orden || 0,
    teamA:    c.parejaA ? {
      nombre:  c.parejaA.nombre,
      detalle: c.parejaA.grupoNombre
        ? `${c.parejaA.grupoNombre} ${c.parejaA.posicion_en_grupo || '?'}°`
        : null,
      winner: false
    } : null,
    teamB:    c.parejaB ? {
      nombre:  c.parejaB.nombre,
      detalle: c.parejaB.grupoNombre
        ? `${c.parejaB.grupoNombre} ${c.parejaB.posicion_en_grupo || '?'}°`
        : null,
      winner: false
    } : null,
    resultado: null,
    endogeno:  c.endogeno || false
  }));
}

function _normalizarPartidosParaBracket(partidos) {
  return (partidos || []).map(p => {
    const hayResultado = p.sets_a !== null && p.sets_b !== null;
    return {
      ronda:    p.ronda_copa,
      orden:    p.orden_copa || 0,
      teamA:    p.pareja_a ? {
        nombre:  p.pareja_a.nombre,
        detalle: null,
        winner:  hayResultado && p.sets_a > p.sets_b
      } : null,
      teamB:    p.pareja_b ? {
        nombre:  p.pareja_b.nombre,
        detalle: null,
        winner:  hayResultado && p.sets_b > p.sets_a
      } : null,
      resultado: hayResultado ? formatearResultado(p, { incluirSTB: true }) : null,
      endogeno:  false
    };
  });
}

function _renderBracketMatch(m) {
  const needsNumber = !['F', 'direct', '3P'].includes(m.ronda);
  const rondaLabel  = labelRonda(m.ronda, true) + (needsNumber && m.orden ? ` ${m.orden}` : '');

  const renderTeam = (team, isWinner) => {
    if (!team) {
      return `<div class="sb-team sb-pending">⏳ pendiente</div>`;
    }
    const detalleHtml = team.detalle
      ? ` <span style="color:#9ca3af; font-size:10px;">(${_esc(team.detalle)})</span>`
      : '';
    const cls = ['sb-team'];
    if (isWinner)   cls.push('sb-winner');
    if (m.endogeno) cls.push('sb-endogeno');
    return `<div class="${cls.join(' ')}">${_esc(team.nombre)}${detalleHtml}</div>`;
  };

  const resultHtml = m.resultado
    ? `<div class="sb-result">${_esc(m.resultado)}</div>`
    : '';

  const endogenoWarn = m.endogeno
    ? `<div style="font-size:10px; color:#d97706; margin-top:2px;">⚠️ mismo grupo</div>`
    : '';

  return `
    <div class="sb-match">
      <div class="sb-label">${_esc(rondaLabel)}</div>
      <div class="sb-teams">
        ${renderTeam(m.teamA, m.teamA?.winner)}
        ${renderTeam(m.teamB, m.teamB?.winner)}
      </div>
      ${resultHtml}
      ${endogenoWarn}
    </div>
  `;
}

function _renderBracketConnector(inputCount) {
  const N     = inputCount;
  const pairs = N / 2;
  const lines = [];

  for (let p = 0; p < pairs; p++) {
    const topY = `${((4 * p + 1) / (2 * N)) * 100}%`;
    const botY = `${((4 * p + 3) / (2 * N)) * 100}%`;
    const midY = `${((4 * p + 2) / (2 * N)) * 100}%`;
    lines.push(
      `<line x1="0" y1="${topY}" x2="50%" y2="${topY}" stroke="#d1d5db" stroke-width="1"/>`,
      `<line x1="0" y1="${botY}" x2="50%" y2="${botY}" stroke="#d1d5db" stroke-width="1"/>`,
      `<line x1="50%" y1="${topY}" x2="50%" y2="${botY}" stroke="#d1d5db" stroke-width="1"/>`,
      `<line x1="50%" y1="${midY}" x2="100%" y2="${midY}" stroke="#d1d5db" stroke-width="1"/>`
    );
  }

  return `
    <div class="sbracket-lines">
      <svg width="100%" height="100%" preserveAspectRatio="none"
           style="display:block; height:100%;">
        ${lines.join('\n        ')}
      </svg>
    </div>
  `;
}

function _renderBracket(matches) {
  if (!matches?.length) {
    return '<p style="font-size:13px; color:var(--muted);">Sin cruces calculados.</p>';
  }

  // Agrupar por ronda y ordenar por orden
  const byRound = {};
  for (const m of matches) {
    if (!byRound[m.ronda]) byRound[m.ronda] = [];
    byRound[m.ronda].push(m);
  }
  for (const arr of Object.values(byRound)) {
    arr.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }

  // Agregar rondas futuras como placeholders (equipos null → "⏳ pendiente")
  const addPlaceholder = (ronda, count) => {
    if (!byRound[ronda]) {
      byRound[ronda] = Array.from({ length: count }, (_, i) => ({
        ronda, orden: i + 1, teamA: null, teamB: null, resultado: null, endogeno: false
      }));
    }
  };
  if (byRound['QF'] && !byRound['SF']) addPlaceholder('SF', byRound['QF'].length / 2);
  if ((byRound['QF'] || byRound['SF']) && !byRound['F']) addPlaceholder('F', 1);
  // direct: no necesita placeholder

  const has3P = !!byRound['3P'];

  const ROUND_ORDER = ['QF', 'SF', 'direct', 'F'];
  const rounds = ROUND_ORDER.filter(r => byRound[r]);

  if (!rounds.length) {
    return '<p style="font-size:13px; color:var(--muted);">Sin cruces calculados.</p>';
  }

  let html = '<div class="sbracket">';
  for (let i = 0; i < rounds.length; i++) {
    const ronda        = rounds[i];
    const roundMatches = byRound[ronda];

    html += `<div class="sbracket-col">`;
    html += roundMatches.map(m => _renderBracketMatch(m)).join('');
    html += `</div>`;

    if (i < rounds.length - 1) {
      html += _renderBracketConnector(roundMatches.length);
    }
  }
  html += `<div class="sb-trophy">🏆</div>`;
  html += `</div>`;

  if (has3P) {
    const m3p = byRound['3P'][0];
    html += `
      <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
        <div style="font-size:11px; color:var(--muted); margin-bottom:4px; font-weight:600;">3ER PUESTO</div>
        ${_renderBracketMatch(m3p)}
      </div>
    `;
  }

  return html;
}

// ============================================================
// Helpers
// ============================================================

async function _getCopaIds() {
  const { data } = await supabase
    .from('copas')
    .select('id')
    .eq('torneo_id', TORNEO_ID);
  return (data || []).map(c => c.id);
}

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _signo(n) { return (n >= 0) ? '+' : ''; }
