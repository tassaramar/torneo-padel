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
  optimizarEndogenos,
  detectarEmpates
} from '../../utils/copaMatchups.js';
import { formatearResultado } from '../../utils/formatoResultado.js';
import { labelRonda } from '../../utils/copaRondas.js';

// Cruces calculados durante el render — accesibles en los event handlers
const _crucesCalculados = {}; // esquemaId → Array<cruce>

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

  // 4. Render por esquema
  const seccionesHtml = esquemas.map(esq => {
    const copa     = copaPorEsquema[esq.id];
    const partidos = copa ? (partidosPorCopa[copa.id] || []) : [];

    // Estado: ya hay partidos creados → en curso
    if (partidos.length > 0) {
      return _renderEsquemaEnCurso(esq, copa, partidos);
    }

    // Estado: no todos los grupos completos → esperar
    if (!allGroupsComplete) {
      return _renderEsquemaEsperando(esq, standingsData);
    }

    // Estado: todos completos → calcular matchups
    const { pool, pendientes } = armarPoolParaCopa(
      standingsData.standings,
      standingsData.grupos,
      esq.reglas,
      new Set() // E4a: sin aprobaciones parciales
    );

    const crucesSeed = seedingMejorPeor(pool);
    const cruces     = optimizarEndogenos(crucesSeed, new Set());
    const { warnings } = detectarEmpates(pool, standingsData.standings, esq.reglas);

    // Guardar para usar en event handlers
    _crucesCalculados[esq.id] = cruces;

    return _renderEsquemaPorAprobar(esq, pool, cruces, warnings, standingsData);
  }).join('');

  container.innerHTML = `
    <div class="copa-status-section">
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
  // ---- Warnings ----
  const warningsHtml = _renderWarnings(warnings, esq.id);

  // ---- Cruces ----
  const hayEndogenos = cruces.some(c => c.endogeno);
  const crucesHtml = _renderCruces(cruces);

  const endogenoHint = hayEndogenos ? `
    <p style="font-size:12px; color:var(--muted); margin-top:6px;">
      ℹ️ No se pudieron evitar cruces entre equipos del mismo grupo.
      Podés editar los cruces manualmente (disponible próximamente).
    </p>
  ` : '';

  // ---- Clasificados (acordeón) ----
  const tablaHtml = _renderTablaGeneral(standingsData, pool.map(p => p.pareja_id));

  // ---- Borde: naranja si hay warnings, gris si no ----
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
      <div style="font-size:12px; font-weight:600; color:var(--muted); margin-bottom:6px;">CRUCES</div>
      ${crucesHtml}
      ${endogenoHint}
      ${tablaHtml}
      <div class="admin-actions" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" class="btn-aprobar-copa btn-primary btn-sm"
                data-esquema-id="${esq.id}">
          ✅ Aprobar copa
        </button>
      </div>
      ${hayWarningsBloqueantes ? `
        <p style="font-size:12px; color:#d97706; margin-top:6px;">
          ⚠️ Hay empates sin resolver. Podés aprobar igual — los cruces se generan con el orden actual.
        </p>
      ` : ''}
    </div>
  `;
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
        `${_esc(e.nombre)} (${_esc(e.grupoNombre)} ${w.posicion}°)`
      ).join(', ');
      return `
        <div style="font-size:12px; color:#d97706; margin-bottom:8px; padding:6px 10px;
                    background:rgba(251,191,36,0.1); border-radius:6px; border-left:3px solid #d97706;">
          ⚠️ Empate entre ${w.equipos?.length || 0} equipos (${w.posicion}° de grupo):
          ${equiposStr}
          <br><span style="color:var(--muted);">🎲 Sorteo inter-grupo (disponible próximamente)</span>
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
// Render: lista de cruces
// ============================================================

function _renderCruces(cruces) {
  if (!cruces?.length) return '<p style="font-size:13px; color:var(--muted);">Sin cruces calculados.</p>';

  return cruces.map(c => {
    const rondaLabel  = labelRonda(c.ronda, true) + (c.orden ? ` ${c.orden}` : '');
    const nombreA     = c.parejaA
      ? `<strong>${_esc(c.parejaA.nombre)}</strong> <span style="font-size:11px; color:var(--muted);">(${_esc(c.parejaA.grupoNombre || '?')} ${c.parejaA.posicion_en_grupo || '?'}°)</span>`
      : `<span style="color:var(--muted);">⏳ pendiente</span>`;
    const nombreB     = c.parejaB
      ? `<strong>${_esc(c.parejaB.nombre)}</strong> <span style="font-size:11px; color:var(--muted);">(${_esc(c.parejaB.grupoNombre || '?')} ${c.parejaB.posicion_en_grupo || '?'}°)</span>`
      : `<span style="color:var(--muted);">⏳ pendiente</span>`;
    const endogenoBadge = c.endogeno
      ? `<span style="font-size:11px; color:#d97706; margin-left:6px;">⚠️ mismo grupo</span>`
      : '';

    return `
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;
                  padding:6px 0; border-bottom:1px solid var(--border);">
        <span style="font-size:12px; color:var(--muted); min-width:60px;">${_esc(rondaLabel)}</span>
        <span style="font-size:14px;">${nombreA}</span>
        <span style="color:var(--muted); font-size:12px;">vs</span>
        <span style="font-size:14px;">${nombreB}</span>
        ${endogenoBadge}
      </div>
    `;
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
  const semis   = partidos.filter(p => p.ronda_copa === 'SF').sort((a, b) => (a.orden_copa || 0) - (b.orden_copa || 0));
  const cuartos = partidos.filter(p => p.ronda_copa === 'QF').sort((a, b) => (a.orden_copa || 0) - (b.orden_copa || 0));
  const final   = partidos.find(p => p.ronda_copa === 'F');
  const tercer  = partidos.find(p => p.ronda_copa === '3P');
  const directo = partidos.find(p => p.ronda_copa === 'direct');

  const renderPartido = (p, label) => {
    if (!p) return '';
    const resultado = p.sets_a !== null
      ? `<span style="font-size:13px; color:var(--muted);">${formatearResultado(p, { incluirSTB: true })}</span>`
      : `<span style="font-size:12px; color:var(--muted);">pendiente</span>`;
    return `
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;
                  padding:5px 0; border-bottom:1px solid var(--border,#e5e7eb);">
        <span style="font-size:12px; color:var(--muted); min-width:60px;">${_esc(label)}</span>
        <span style="font-size:14px;">${_esc(p.pareja_a?.nombre || '?')}</span>
        <span style="color:var(--muted); font-size:12px;">vs</span>
        <span style="font-size:14px;">${_esc(p.pareja_b?.nombre || '?')}</span>
        ${resultado}
      </div>
    `;
  };

  const partidosHtml = [
    ...cuartos.map((q, i) => renderPartido(q, `Cuartos ${i + 1}`)),
    ...semis.map((s, i) => renderPartido(s, `${labelRonda('SF', true)} ${i + 1}`)),
    renderPartido(directo, labelRonda('direct')),
    renderPartido(final, labelRonda('F')),
    renderPartido(tercer, labelRonda('3P'))
  ].filter(Boolean).join('');

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
      ${partidosHtml}
      ${autoFinalHint}
    </div>
  `;
}

// ============================================================
// Eventos
// ============================================================

function _wireStatusEvents(container, esquemas, standingsData, onRefresh) {

  // ---- Aprobar copa ----
  container.querySelectorAll('.btn-aprobar-copa').forEach(btn => {
    btn.addEventListener('click', async () => {
      const esquemaId = btn.dataset.esquemaId;
      const cruces    = _crucesCalculados[esquemaId];

      if (!cruces?.length) {
        logMsg('❌ No hay cruces calculados para aprobar');
        return;
      }

      const crucesCompletos = cruces.filter(c => c.parejaA && c.parejaB);
      if (crucesCompletos.length === 0) {
        logMsg('⚠️ No hay cruces completos (faltan equipos)');
        return;
      }

      btn.disabled     = true;
      btn.textContent  = '⏳ Creando partidos…';

      const { ok, partidos_creados, msg } = await crearPartidosCopa(supabase, esquemaId, cruces);

      if (ok) {
        logMsg(`✅ Copa aprobada — ${partidos_creados} partidos creados`);
        onRefresh?.();
      } else {
        logMsg(`❌ Error: ${msg}`);
        btn.disabled    = false;
        btn.textContent = '✅ Aprobar copa';
      }
    });
  });

  // ---- Editar plan ----
  container.querySelector('#btn-editar-plan')?.addEventListener('click', async () => {
    const { renderPlanEditor } = await import('./planEditor.js');
    const co = document.getElementById('copas-admin');
    if (co) renderPlanEditor(co, onRefresh, esquemas);
  });

  // ---- Reset copas ----
  container.querySelector('#btn-reset-copas')?.addEventListener('click', () => {
    const btn = container.querySelector('#btn-reset-copas');

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
        logMsg(`✅ Reset listo — ${result.partidos_borrados} partidos y ${result.copas_borradas} copas borradas`);
        onRefresh?.();
      } else {
        logMsg(`❌ Error en reset: ${result.msg}`);
        btn.disabled    = false;
        btn.textContent = '🗑 Reset copas';
      }
    });
  });
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
