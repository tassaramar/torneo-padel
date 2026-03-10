/**
 * Vista de estado de copas — Estados 2, 3 y 4
 * Flujo de aprobación con 2 decisiones:
 *   D1: ¿Quiénes entran? — clasificados con standings, zona gris, empates
 *   D2: ¿Contra quién juegan? — cruces con warnings, edición libre
 * Propuestas progresivas: parciales con NULL mientras faltan grupos.
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';
import {
  invocarMotorPropuestas,
  aprobarPropuestas,
  aprobarPropuestaIndividual,
  modificarPropuesta,
  resetCopas,
  calcularClasificadosConWarnings,
  calcularCrucesConWarnings
} from './planService.js';
import { formatearResultado } from '../../utils/formatoResultado.js';
import { labelRonda } from '../../utils/copaRondas.js';

// ============================================================
// Estado de la UI (persiste entre renders del mismo esquema)
// ============================================================
const _state = {
  d1Confirmado:   {},  // esquemaId -> boolean
  modoEdicion:    {},  // esquemaId -> boolean
  crucesEditados: {},  // esquemaId -> array de cruces modificados
  swapTemp:       {},  // esquemaId -> { oldId, newTeam } intercambio pendiente
};

// ============================================================
// Entrada pública
// ============================================================

/**
 * @param {HTMLElement} container
 * @param {Array}    esquemas       - Esquemas del torneo
 * @param {Array}    propuestas     - Todas las propuestas (enriquecidas)
 * @param {Array}    copas          - Copas existentes
 * @param {Object}   standingsData  - { standings, grupos, todosCompletos }
 * @param {Function} onRefresh      - Callback para re-render
 */
export async function renderStatusView(container, esquemas, propuestas, copas, standingsData, onRefresh) {
  const copaIds = copas.map(c => c.id);
  let partidosPorCopa = {};

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

  // Propuestas agrupadas por esquema
  const propuestasPorEsquema = {};
  (propuestas || []).forEach(p => {
    const eid = p.esquema?.id;
    if (!eid) return;
    if (!propuestasPorEsquema[eid]) propuestasPorEsquema[eid] = [];
    propuestasPorEsquema[eid].push(p);
  });

  // Copa por esquema
  const copaPorEsquema = {};
  (copas || []).forEach(c => {
    if (c.esquema_copa_id) copaPorEsquema[c.esquema_copa_id] = c;
  });

  const totalPendientes = (propuestas || []).filter(p => p.estado === 'pendiente').length;
  const titulo = totalPendientes > 0
    ? `Copas — <span style="color:var(--warning,#d97706);">${totalPendientes} propuesta${totalPendientes > 1 ? 's' : ''} para revisar</span>`
    : 'Copas — En curso';

  const seccionesHtml = esquemas.map(esq => {
    const propEsq     = propuestasPorEsquema[esq.id] || [];
    const pendientes  = propEsq.filter(p => p.estado === 'pendiente');
    const aprobadas   = propEsq.filter(p => p.estado === 'aprobado');
    const copa        = copaPorEsquema[esq.id];
    const partidos    = copa ? (partidosPorCopa[copa.id] || []) : [];

    if (pendientes.length > 0 || aprobadas.length > 0) {
      return _renderEsquemaPropuestas(esq, propEsq, standingsData);
    } else if (partidos.length > 0) {
      return _renderEsquemaEnCurso(esq, copa, partidos);
    } else {
      return _renderEsquemaEsperando(esq, standingsData);
    }
  }).join('');

  container.innerHTML = `
    <div class="copa-status-section">
      <div style="font-weight:600; margin-bottom:12px;">${titulo}</div>

      ${seccionesHtml}

      <div class="admin-actions" style="margin-top:16px;">
        <button type="button" id="btn-proponer-ahora" class="btn-secondary btn-sm">
          🔄 Proponer ahora
        </button>
        <button type="button" id="btn-editar-plan" class="btn-sm"
                style="border:1px solid var(--border); background:transparent;">
          ✏️ Editar plan
        </button>
      </div>
      <div class="admin-actions" style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
        <button type="button" id="btn-reset-copas" class="btn-sm btn-danger">
          🗑 Reset copas
        </button>
      </div>
    </div>
  `;

  _wireStatusEvents(container, esquemas, propuestasPorEsquema, standingsData, onRefresh);
}

// ============================================================
// Render: Esquema con propuestas (D1 + D2)
// ============================================================

function _renderEsquemaPropuestas(esquema, propuestasEsquema, standingsData) {
  const aprobadas  = propuestasEsquema.filter(p => p.estado === 'aprobado');
  const pendientes = propuestasEsquema.filter(p => p.estado === 'pendiente');

  // Calcular D1 (clasificados) y D2 (cruces con warnings)
  const d1 = calcularClasificadosConWarnings(standingsData, esquema, aprobadas);
  const d2 = calcularCrucesConWarnings(propuestasEsquema, standingsData);

  const hayZonaGris = d1.zonaGris.length > 0;
  const hayEmpateGrupo = d1.warnings.some(w => w.tipo === 'empate_grupo');

  // D1 se auto-confirma si no hay zona gris ni empate de grupo
  const autoConfirmado = !hayZonaGris && !hayEmpateGrupo;
  if (!_state.d1Confirmado[esquema.id] && autoConfirmado) {
    _state.d1Confirmado[esquema.id] = true;
  }
  const d1Confirmado = _state.d1Confirmado[esquema.id] || false;

  // ---- D1 HTML ----
  const clasificadosHtml = d1.clasificados.map((c, i) => {
    const aprobBadge = c.aprobado
      ? `<span style="font-size:11px; color:#16a34a; margin-left:4px;">(aprobado)</span>`
      : '';
    return `
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;
                  padding:4px 0; font-size:13px;">
        <span style="min-width:20px; color:#16a34a;">✅</span>
        <span style="font-weight:500;">${_esc(c.nombre)}</span>
        <span style="color:var(--muted);">${c.puntos} pts DS ${_signo(c.ds)}${Math.abs(c.ds || 0)}</span>
        <span style="color:var(--muted); font-size:12px;">${_esc(c.grupoNombre)} ${c.posicion_en_grupo}°</span>
        ${aprobBadge}
      </div>
    `;
  }).join('');

  const zonaGrisHtml = hayZonaGris ? `
    <div style="border-top:1px dashed var(--border); margin:6px 0; padding-top:4px;">
      <div style="font-size:11px; color:var(--muted); margin-bottom:4px;">zona gris — empate en frontera</div>
      ${d1.zonaGris.map(z => `
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;
                    padding:4px 0; font-size:13px; opacity:0.7;">
          <span style="min-width:20px; color:#dc2626;">❌</span>
          <span>${_esc(z.nombre)}</span>
          <span style="color:var(--muted);">${z.puntos} pts DS ${_signo(z.ds)}${Math.abs(z.ds || 0)}</span>
          <span style="color:var(--muted); font-size:12px;">${_esc(z.grupoNombre)} ${z.posicion_en_grupo}°</span>
          <span style="font-size:12px; color:#d97706;">⚠️ empate frontera</span>
          ${!d1Confirmado ? `
            <button type="button" class="btn-intercambiar btn-sm"
                    data-esquema-id="${esquema.id}"
                    data-pareja-id="${z.pareja_id}"
                    data-pareja-nombre="${_esc(z.nombre)}"
                    style="font-size:11px; padding:2px 8px; border:1px solid var(--border);
                           border-radius:6px; background:transparent; cursor:pointer;">
              ↔ Intercambiar
            </button>
          ` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  const pendientesHtml = d1.pendientes.map(p => `
    <div style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:13px;">
      <span style="min-width:20px; color:var(--muted);">⏳</span>
      <span style="color:var(--muted);">Esperando ${_esc(p.grupoNombre)}…</span>
    </div>
  `).join('');

  const d1WarningsHtml = d1.warnings.filter(w => w.tipo === 'empate_grupo').map(w => `
    <div style="font-size:12px; color:#d97706; margin-top:6px; padding:6px 8px;
                background:rgba(251,191,36,0.1); border-radius:6px;">
      ⚠️ Empate a 3 en ${_esc(w.grupoNombre)} (posiciones ${w.posiciones}) —
      revisá la tabla en el tab <strong>Grupos</strong> antes de confirmar.
    </div>
  `).join('');

  const confirmD1Btn = (hayZonaGris || hayEmpateGrupo) && !d1Confirmado ? `
    <div style="margin-top:8px;">
      <button type="button" class="btn-confirmar-d1 btn-sm btn-secondary"
              data-esquema-id="${esquema.id}">
        ✓ Confirmar clasificados
      </button>
    </div>
  ` : '';

  const tablaCompletaHtml = _renderTablaCompleta(standingsData, d1.clasificados);

  // D1 section: compact if auto-confirmed and no zona gris
  const d1Collapsed = autoConfirmado && !hayZonaGris;
  const d1Html = `
    <div class="copa-d1" style="margin-bottom:${d1Collapsed ? 8 : 12}px;">
      <div style="font-size:12px; font-weight:600; color:var(--muted); margin-bottom:4px;">
        CLASIFICADOS
        ${d1.pendientes.length > 0 ? `<span style="color:#d97706;">(${d1.pendientes.length} grupo${d1.pendientes.length > 1 ? 's' : ''} pendiente${d1.pendientes.length > 1 ? 's' : ''})</span>` : ''}
      </div>
      ${clasificadosHtml}
      ${pendientesHtml}
      ${zonaGrisHtml}
      ${d1WarningsHtml}
      ${tablaCompletaHtml}
      ${confirmD1Btn}
    </div>
  `;

  // ---- D2 HTML (solo visible si D1 confirmado) ----
  let d2Html = '';
  if (d1Confirmado) {
    const modoEdicion = _state.modoEdicion[esquema.id] || false;
    const crucesParaMostrar = _state.crucesEditados[esquema.id] || d2.cruces;

    // Warnings basados en los cruces que se muestran (pueden estar editados)
    const warningsActuales = crucesParaMostrar
      .filter(c => c.mismoGrupo && !c.aprobado)
      .map(c => `
        <div style="font-size:12px; color:#d97706; margin-bottom:6px; padding:4px 8px;
                    background:rgba(251,191,36,0.1); border-radius:6px;">
          ⚠️ ${_esc([c.parejaA?.nombre, c.parejaB?.nombre].filter(Boolean).join(' y '))} ya jugaron en ${_esc(c.parejaA?.grupoNombre || '?')}
        </div>
      `);
    const d2WarningsHtml = warningsActuales.join('');

    const crucesHtml = crucesParaMostrar.map((cruce, idx) => {
      const rondaLabel = cruce.ronda === 'SF'
        ? `Semi ${cruce.orden}`
        : labelRonda(cruce.ronda, true);

      if (cruce.aprobado) {
        // Cruce firme (ya aprobado) — no editable
        return `
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;
                      padding:6px 0; border-bottom:1px solid var(--border);
                      opacity:0.7;">
            <span style="font-size:12px; color:var(--muted); min-width:52px;">${rondaLabel}</span>
            <span style="font-size:14px;">${_esc(cruce.parejaA?.nombre || '?')}</span>
            <span style="color:var(--muted); font-size:12px;">vs</span>
            <span style="font-size:14px;">${_esc(cruce.parejaB?.nombre || '?')}</span>
            <span style="font-size:11px; color:#16a34a;">✅ aprobado</span>
          </div>
        `;
      }

      // Cruce pendiente (puede ser parcial con NULL)
      const esPendiente = !cruce.parejaA || !cruce.parejaB;
      const warningMismoGrupo = cruce.mismoGrupo
        ? `<span style="font-size:11px; color:#d97706;">⚠️ mismo grupo</span>`
        : '';

      if (modoEdicion) {
        // Modo edición: selectores
        const todasLasParejas = d2.cruces
          .flatMap(c => [c.parejaA, c.parejaB])
          .filter((p, i, arr) => p && arr.findIndex(x => x?.id === p.id) === i);

        const makeSelect = (selectedId, slotKey) => {
          const opts = todasLasParejas.map(p => `
            <option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${_esc(p.nombre)}</option>
          `).join('');
          return `
            <select class="cruce-select" data-esquema-id="${esquema.id}"
                    data-cruce-idx="${idx}" data-slot="${slotKey}"
                    style="font-size:13px; padding:3px 6px; border:1px solid var(--border);
                           border-radius:6px; max-width:160px;">
              <option value="">— pendiente —</option>
              ${opts}
            </select>
          `;
        };

        return `
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;
                      padding:6px 0; border-bottom:1px solid var(--border);">
            <span style="font-size:12px; color:var(--muted); min-width:52px;">${rondaLabel}</span>
            ${makeSelect(cruce.parejaA?.id, 'a')}
            <span style="color:var(--muted); font-size:12px;">vs</span>
            ${makeSelect(cruce.parejaB?.id, 'b')}
            ${warningMismoGrupo}
          </div>
        `;
      }

      // Vista normal (no edición)
      if (esPendiente) {
        const nombreA = cruce.parejaA?.nombre || null;
        const nombreB = cruce.parejaB?.nombre || null;
        return `
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;
                      padding:6px 0; border-bottom:1px solid var(--border);">
            <span style="font-size:12px; color:var(--muted); min-width:52px;">${rondaLabel}</span>
            <span style="font-size:14px;">${nombreA ? _esc(nombreA) : '<span style="color:var(--muted);">⏳ pendiente</span>'}</span>
            <span style="color:var(--muted); font-size:12px;">vs</span>
            <span style="font-size:14px;">${nombreB ? _esc(nombreB) : '<span style="color:var(--muted);">⏳ pendiente</span>'}</span>
          </div>
        `;
      }

      return `
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;
                    padding:6px 0; border-bottom:1px solid var(--border);">
          <span style="font-size:12px; color:var(--muted); min-width:52px;">${rondaLabel}</span>
          <span style="font-size:14px; font-weight:500;">
            ${_esc(cruce.parejaA.nombre)}
            <span style="font-size:11px; font-weight:400; color:var(--muted);">(${_esc(cruce.parejaA.grupoNombre || '?')})</span>
          </span>
          <span style="color:var(--muted); font-size:12px;">vs</span>
          <span style="font-size:14px; font-weight:500;">
            ${_esc(cruce.parejaB.nombre)}
            <span style="font-size:11px; font-weight:400; color:var(--muted);">(${_esc(cruce.parejaB.grupoNombre || '?')})</span>
          </span>
          ${warningMismoGrupo}
          <button type="button" class="btn-aprobar-individual btn-sm btn-primary"
                  data-esquema-id="${esquema.id}"
                  data-propuesta-id="${cruce.id}"
                  style="font-size:11px; padding:3px 10px; margin-left:auto;">
            ✅ Aprobar
          </button>
        </div>
      `;
    }).join('');

    const crucesCompletos = crucesParaMostrar.filter(c => !c.aprobado && c.parejaA && c.parejaB);
    const hayPendientesConNull = crucesParaMostrar.some(c => !c.aprobado && (!c.parejaA || !c.parejaB));

    const actionsHtml = modoEdicion ? `
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
        <button type="button" class="btn-guardar-cruces btn-primary btn-sm"
                data-esquema-id="${esquema.id}">
          💾 Guardar cruces
        </button>
        <button type="button" class="btn-cancelar-edicion btn-sm"
                data-esquema-id="${esquema.id}"
                style="border:1px solid var(--border); background:transparent;">
          ↩ Volver a sugeridos
        </button>
      </div>
    ` : `
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
        ${crucesCompletos.length > 0 ? `
          <button type="button" class="btn-aprobar-todos btn-primary btn-sm"
                  data-esquema-id="${esquema.id}">
            ✅ Aprobar ${crucesCompletos.length > 1 ? 'todos' : ''}
          </button>
        ` : ''}
        <button type="button" class="btn-editar-cruces btn-sm"
                data-esquema-id="${esquema.id}"
                style="border:1px solid var(--border); background:transparent;">
          ✏️ Editar cruces
        </button>
      </div>
      ${hayPendientesConNull ? `
        <p style="font-size:12px; color:var(--muted); margin-top:6px;">
          ⏳ Hay partidos con equipos pendientes — se pueden aprobar cuando estén definidos.
        </p>
      ` : ''}
    `;

    d2Html = `
      <div class="copa-d2" style="border-top:1px solid var(--border); padding-top:10px;">
        <div style="font-size:12px; font-weight:600; color:var(--muted); margin-bottom:6px;">CRUCES</div>
        ${d2WarningsHtml}
        <div class="copa-cruces-list" data-esquema-id="${esquema.id}">
          ${crucesHtml}
        </div>
        ${actionsHtml}
      </div>
    `;
  } else {
    // D1 no confirmado (zona gris presente): mostrar hint
    d2Html = `
      <div style="font-size:12px; color:var(--muted); padding:8px 0; border-top:1px solid var(--border);">
        → Confirmá los clasificados para ver los cruces propuestos.
      </div>
    `;
  }

  const borderColor = pendientes.length > 0 ? '#f59e0b' : '#e5e7eb';
  const bgColor = pendientes.length > 0 ? 'rgba(251,191,36,0.06)' : 'var(--surface,#fff)';

  return `
    <div class="copa-seccion copa-seccion-propuestas" data-esquema-id="${esquema.id}"
         style="border:1px solid ${borderColor}; border-radius:12px; padding:12px 14px;
                margin-bottom:10px; background:${bgColor};">
      <div style="font-weight:600; margin-bottom:10px;">
        ${_esc(esquema.nombre)}
        ${pendientes.length > 0 ? `<span style="font-size:12px; color:#d97706; font-weight:400; margin-left:6px;">pendiente de aprobación</span>` : ''}
      </div>
      ${d1Html}
      ${d2Html}
    </div>
  `;
}

// ============================================================
// Render: Esquema en curso (partidos ya creados)
// ============================================================

function _renderEsquemaEnCurso(esquema, copa, partidos) {
  const semis   = partidos.filter(p => p.ronda_copa === 'SF').sort((a, b) => (a.orden_copa||0) - (b.orden_copa||0));
  const final   = partidos.find(p => p.ronda_copa === 'F');
  const tercer  = partidos.find(p => p.ronda_copa === '3P');
  const directo = partidos.find(p => p.ronda_copa === 'direct');
  const cuartos = partidos.filter(p => p.ronda_copa === 'QF').sort((a, b) => (a.orden_copa||0) - (b.orden_copa||0));

  const renderPartido = (p, label) => {
    if (!p) return '';
    const resultado = p.sets_a !== null
      ? `<span style="font-size:13px; color:var(--muted);">${formatearResultado(p, { incluirSTB: true })}</span>`
      : `<span style="font-size:12px; color:var(--muted);">pendiente</span>`;
    return `
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;
                  padding:5px 0; border-bottom:1px solid var(--border,#e5e7eb);">
        <span style="font-size:12px; color:var(--muted); min-width:50px;">${label}</span>
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
    <div class="copa-seccion" data-esquema-id="${esquema.id}"
         style="border:1px solid var(--border,#e5e7eb); border-radius:12px;
                padding:12px 14px; margin-bottom:10px; background:var(--surface,#fff);">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <strong>${_esc(esquema.nombre)}</strong>
        <span style="font-size:12px; color:#16a34a;">✅ En curso</span>
      </div>
      ${partidosHtml}
      ${autoFinalHint}
    </div>
  `;
}

// ============================================================
// Render: Esquema esperando grupos (enriquecido con info parcial)
// ============================================================

function _renderEsquemaEsperando(esquema, standingsData) {
  const { grupos, standings } = standingsData || {};
  const gruposTotal = grupos?.length || 0;
  const gruposCompletos = grupos
    ? grupos.filter(g => standings?.some(s => s.grupo_id === g.id && s.grupo_completo))
    : [];

  const hasGlobal = (esquema.reglas || []).some(r => r.modo === 'global');

  let contenido;
  if (hasGlobal) {
    // Modo global: esperar todos los grupos
    contenido = `
      <div style="font-size:12px; color:var(--muted); margin-top:4px;">
        Grupos completos: ${gruposCompletos.length} de ${gruposTotal}
      </div>
      <div style="font-size:12px; color:var(--muted);">
        Los cruces se generan cuando <strong>todos</strong> los grupos terminen (seeding global).
      </div>
    `;
  } else {
    // Modo por posición: mostrar progreso
    contenido = `
      <div style="font-size:12px; color:var(--muted); margin-top:4px;">
        Grupos completos: ${gruposCompletos.length} de ${gruposTotal}
        ${gruposCompletos.length > 0 && gruposCompletos.length < gruposTotal
          ? ' — los cruces parciales aparecerán cuando haya al menos 2 equipos clasificados.'
          : ''}
      </div>
    `;
  }

  return `
    <div class="copa-seccion"
         style="border:1px solid var(--border,#e5e7eb); border-radius:12px;
                padding:12px 14px; margin-bottom:10px; opacity:0.75;">
      <div style="display:flex; align-items:center; gap:8px;">
        <strong>${_esc(esquema.nombre)}</strong>
        <span style="font-size:12px; color:var(--muted);">⏳ Esperando grupos…</span>
      </div>
      ${contenido}
    </div>
  `;
}

// ============================================================
// Eventos
// ============================================================

function _wireStatusEvents(container, esquemas, propuestasPorEsquema, standingsData, onRefresh) {

  // ---- Confirmar Decisión 1 (clasificados) ----
  container.querySelectorAll('.btn-confirmar-d1').forEach(btn => {
    btn.addEventListener('click', async () => {
      const esquemaId = btn.dataset.esquemaId;
      const swap = _state.swapTemp[esquemaId];

      if (swap) {
        // Hay un intercambio pendiente: actualizar la propuesta en DB
        btn.disabled = true;
        btn.textContent = '⏳ Guardando…';

        const propEsq = propuestasPorEsquema[esquemaId] || [];
        const propuesta = propEsq.find(p =>
          p.estado === 'pendiente' &&
          (p.pareja_a?.id === swap.oldId || p.pareja_b?.id === swap.oldId)
        );

        if (propuesta) {
          const newA = propuesta.pareja_a?.id === swap.oldId ? swap.newId : propuesta.pareja_a?.id;
          const newB = propuesta.pareja_b?.id === swap.oldId ? swap.newId : propuesta.pareja_b?.id;
          const { ok, msg } = await modificarPropuesta(supabase, propuesta.id, newA, newB);
          if (!ok) {
            logMsg(`❌ Error guardando intercambio: ${msg}`);
            btn.disabled = false;
            btn.textContent = '✓ Confirmar clasificados';
            return;
          }
        }
        delete _state.swapTemp[esquemaId];
      }

      _state.d1Confirmado[esquemaId] = true;
      onRefresh?.();
    });
  });

  // ---- Intercambiar (zona gris → clasificados) ----
  container.querySelectorAll('.btn-intercambiar').forEach(btn => {
    btn.addEventListener('click', () => {
      const esquemaId = btn.dataset.esquemaId;
      const newParejaId   = btn.dataset.parejaId;
      const newParejaNombre = btn.dataset.parejaNombre;

      // Calcular el último clasificado (que no esté ya aprobado)
      const propEsq  = propuestasPorEsquema[esquemaId] || [];
      const aprobadas = propEsq.filter(p => p.estado === 'aprobado');
      const d1 = calcularClasificadosConWarnings(standingsData,
        esquemas.find(e => e.id === esquemaId) || {},
        aprobadas
      );

      // El último clasificado no aprobado es el candidato para el swap
      const ultimoNoAprobado = [...d1.clasificados].reverse().find(c => !c.aprobado);
      if (!ultimoNoAprobado) {
        logMsg('⚠️ No hay clasificados disponibles para intercambiar');
        return;
      }

      // Guardar en estado temporal
      _state.swapTemp[esquemaId] = {
        oldId:   ultimoNoAprobado.pareja_id,
        newId:   newParejaId,
        oldNombre: ultimoNoAprobado.nombre,
        newNombre: newParejaNombre
      };

      // Feedback visual (sin re-render completo)
      btn.textContent = `✓ Seleccionado (${newParejaNombre} ↔ ${ultimoNoAprobado.nombre})`;
      btn.disabled = true;
      btn.style.color = '#16a34a';
      btn.style.borderColor = '#16a34a';

      // Habilitar el botón confirmar si estaba deshabilitado
      const confirmBtn = container.querySelector(
        `.btn-confirmar-d1[data-esquema-id="${esquemaId}"]`
      );
      if (confirmBtn) confirmBtn.disabled = false;
    });
  });

  // ---- Editar cruces ----
  container.querySelectorAll('.btn-editar-cruces').forEach(btn => {
    btn.addEventListener('click', () => {
      const esquemaId = btn.dataset.esquemaId;
      _state.modoEdicion[esquemaId] = true;
      // Inicializar crucesEditados con copia de los cruces actuales
      const propEsq = propuestasPorEsquema[esquemaId] || [];
      const d2 = calcularCrucesConWarnings(propEsq, standingsData);
      _state.crucesEditados[esquemaId] = d2.cruces.map(c => ({ ...c }));
      onRefresh?.();
    });
  });

  // ---- Cambio en selectores de edición ----
  container.querySelectorAll('.cruce-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const esquemaId = sel.dataset.esquemaId;
      const cruceIdx  = parseInt(sel.dataset.cruceIdx);
      const slot      = sel.dataset.slot; // 'a' o 'b'
      const newId     = sel.value || null;

      const cruces = _state.crucesEditados[esquemaId];
      if (!cruces) return;

      // Encontrar el equipo seleccionado
      const propEsq = propuestasPorEsquema[esquemaId] || [];
      const d2 = calcularCrucesConWarnings(propEsq, standingsData);
      const todasParejas = d2.cruces
        .flatMap(c => [c.parejaA, c.parejaB])
        .filter((p, i, arr) => p && arr.findIndex(x => x?.id === p.id) === i);

      const equipoSeleccionado = newId ? todasParejas.find(p => p.id === newId) : null;

      // Si el equipo ya estaba en otro slot, sacarlo de ahí (auto-dedup)
      if (equipoSeleccionado) {
        for (let i = 0; i < cruces.length; i++) {
          if (i === cruceIdx) continue;
          if (cruces[i].parejaA?.id === newId) cruces[i] = { ...cruces[i], parejaA: null };
          if (cruces[i].parejaB?.id === newId) cruces[i] = { ...cruces[i], parejaB: null };
        }
        // También sacarlo del otro slot del mismo cruce
        const otroSlot = slot === 'a' ? 'parejaB' : 'parejaA';
        if (cruces[cruceIdx][otroSlot]?.id === newId) {
          cruces[cruceIdx] = { ...cruces[cruceIdx], [otroSlot]: null };
        }
      }

      // Asignar en el slot correspondiente
      const thisSlot = slot === 'a' ? 'parejaA' : 'parejaB';
      cruces[cruceIdx] = { ...cruces[cruceIdx], [thisSlot]: equipoSeleccionado || null };

      // Re-calcular mismoGrupo para warnings en tiempo real
      cruces[cruceIdx].mismoGrupo = !!(
        cruces[cruceIdx].parejaA?.grupoId &&
        cruces[cruceIdx].parejaB?.grupoId &&
        cruces[cruceIdx].parejaA.grupoId === cruces[cruceIdx].parejaB.grupoId
      );

      _state.crucesEditados[esquemaId] = cruces;
      // No re-render completo: solo actualizar el badge de warning en ese cruce
      _refreshCruceWarningBadge(container, esquemaId, cruceIdx, cruces[cruceIdx]);
    });
  });

  // ---- Guardar cruces (modo edición) ----
  container.querySelectorAll('.btn-guardar-cruces').forEach(btn => {
    btn.addEventListener('click', async () => {
      const esquemaId = btn.dataset.esquemaId;
      btn.disabled = true;
      btn.textContent = '⏳ Guardando…';

      const cruces   = _state.crucesEditados[esquemaId] || [];
      const propEsq  = propuestasPorEsquema[esquemaId] || [];
      const pendientes = propEsq.filter(p => p.estado === 'pendiente');

      let allOk = true;
      for (const cruce of cruces) {
        if (cruce.aprobado) continue;
        const propuesta = pendientes.find(p => p.orden === cruce.orden);
        if (!propuesta) continue;

        const newA = cruce.parejaA?.id ?? null;
        const newB = cruce.parejaB?.id ?? null;
        const oldA = propuesta.pareja_a?.id ?? null;
        const oldB = propuesta.pareja_b?.id ?? null;

        if (newA !== oldA || newB !== oldB) {
          const { ok, msg } = await modificarPropuesta(supabase, propuesta.id, newA, newB);
          if (!ok) { logMsg(`❌ Error guardando cruce: ${msg}`); allOk = false; break; }
        }
      }

      if (allOk) {
        _state.modoEdicion[esquemaId] = false;
        delete _state.crucesEditados[esquemaId];
        logMsg('✅ Cruces actualizados');
        onRefresh?.();
      } else {
        btn.disabled = false;
        btn.textContent = '💾 Guardar cruces';
      }
    });
  });

  // ---- Cancelar edición ----
  container.querySelectorAll('.btn-cancelar-edicion').forEach(btn => {
    btn.addEventListener('click', () => {
      const esquemaId = btn.dataset.esquemaId;
      _state.modoEdicion[esquemaId] = false;
      delete _state.crucesEditados[esquemaId];
      onRefresh?.();
    });
  });

  // ---- Aprobar propuesta individual ----
  container.querySelectorAll('.btn-aprobar-individual').forEach(btn => {
    btn.addEventListener('click', async () => {
      const esquemaId   = btn.dataset.esquemaId;
      const propuestaId = btn.dataset.propuestaId;
      btn.disabled = true;
      btn.textContent = '⏳';

      const { ok, partidos_creados, msg } = await aprobarPropuestaIndividual(
        supabase, esquemaId, propuestaId
      );

      if (ok) {
        logMsg(`✅ Partido aprobado`);
        _state.d1Confirmado[esquemaId] = true; // mantener D1 confirmado tras refresh
        onRefresh?.();
      } else {
        logMsg(`❌ Error: ${msg}`);
        btn.disabled = false;
        btn.textContent = '✅ Aprobar';
      }
    });
  });

  // ---- Aprobar todos (los completos) ----
  container.querySelectorAll('.btn-aprobar-todos').forEach(btn => {
    btn.addEventListener('click', async () => {
      const esquemaId = btn.dataset.esquemaId;
      btn.disabled = true;
      btn.textContent = '⏳ Aprobando…';

      const { ok, partidos_creados, msg } = await aprobarPropuestas(supabase, esquemaId);
      if (ok) {
        logMsg(`✅ Propuestas aprobadas — ${partidos_creados} partidos creados`);
        onRefresh?.();
      } else {
        logMsg(`❌ Error: ${msg}`);
        btn.disabled = false;
        btn.textContent = '✅ Aprobar todos';
      }
    });
  });

  // ---- Proponer ahora ----
  container.querySelector('#btn-proponer-ahora')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-proponer-ahora');
    btn.disabled = true;
    btn.textContent = '⏳ Evaluando…';

    const { ok, propuestas_creadas, msg } = await invocarMotorPropuestas(supabase, TORNEO_ID);
    if (ok) {
      logMsg(propuestas_creadas > 0
        ? `✅ ${propuestas_creadas} nueva${propuestas_creadas > 1 ? 's propuestas' : ' propuesta'} generada${propuestas_creadas > 1 ? 's' : ''}`
        : 'ℹ️ No hay nuevas propuestas disponibles (grupos incompletos)');
      onRefresh?.();
    } else {
      logMsg(`❌ Error: ${msg}`);
      btn.disabled = false;
      btn.textContent = '🔄 Proponer ahora';
    }
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
            <div style="font-size:12px;color:#6b7280;margin-top:3px;">Limpia scores de partidos de copa. Mantiene partidos, cruces y plan.</div>
          </button>
          <button id="dlg-todo-copas" style="text-align:left;padding:12px 14px;border:1px solid #fca5a5;border-radius:8px;background:#fff7f7;cursor:pointer;">
            <div style="font-weight:600;font-size:14px;color:#dc2626;">Todo (partidos + plan)</div>
            <div style="font-size:12px;color:#6b7280;margin-top:3px;">Borra partidos de copa, copas, propuestas y esquemas. Vuelve al paso "Definir plan".</div>
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
      btn.disabled = true;
      btn.textContent = '⏳ Limpiando…';

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
        .eq('torneo_id', TORNEO_ID)
        .not('copa_id', 'is', null);

      if (error) {
        logMsg(`❌ Error limpiando resultados de copas: ${error.message}`);
      } else {
        logMsg('✅ Resultados de copas limpiados — partidos y plan conservados');
        onRefresh?.();
      }
      btn.disabled = false;
      btn.textContent = '🗑 Reset copas';
    });

    dialog.querySelector('#dlg-todo-copas').addEventListener('click', async () => {
      closeDialog();
      btn.disabled = true;
      btn.textContent = '⏳ Reseteando…';

      const result = await resetCopas(supabase, TORNEO_ID);
      if (result.ok) {
        // Limpiar todo el estado al hacer reset completo
        Object.keys(_state).forEach(k => { _state[k] = {}; });
        logMsg(`✅ Reset listo — ${result.partidos_borrados} partidos y ${result.copas_borradas} copas borradas`);
        onRefresh?.();
      } else {
        logMsg(`❌ Error en reset: ${result.msg}`);
        btn.disabled = false;
        btn.textContent = '🗑 Reset copas';
      }
    });
  });
}

// ============================================================
// Helpers
// ============================================================

/**
 * Actualiza el badge de warning "mismo grupo" de un cruce específico
 * sin re-renderizar todo el componente (usado en edición de cruces).
 */
function _refreshCruceWarningBadge(container, esquemaId, cruceIdx, cruce) {
  const crucesList = container.querySelector(`.copa-cruces-list[data-esquema-id="${esquemaId}"]`);
  if (!crucesList) return;
  const cruceDivs = crucesList.querySelectorAll('[data-cruce-idx]');
  // Buscar la fila del cruce por índice
  const rows = crucesList.querySelectorAll('div[style*="border-bottom"]');
  // Simpler: just toggle a data attribute and CSS class based on state
  // For now: add/remove the badge span after the last select in the row
  if (rows[cruceIdx]) {
    const existingBadge = rows[cruceIdx].querySelector('.warning-mismo-grupo-badge');
    if (cruce.mismoGrupo) {
      if (!existingBadge) {
        const badge = document.createElement('span');
        badge.className = 'warning-mismo-grupo-badge';
        badge.style.cssText = 'font-size:11px; color:#d97706;';
        badge.textContent = '⚠️ mismo grupo';
        rows[cruceIdx].appendChild(badge);
      }
    } else {
      existingBadge?.remove();
    }
  }
}

/**
 * Tabla collapsible con TODOS los equipos del torneo rankeados globalmente,
 * marcando ✅ a los que clasifican para este esquema.
 */
function _renderTablaCompleta(standingsData, clasificados) {
  const { standings } = standingsData || {};
  if (!standings || standings.length === 0) return '';

  const clasificadosIds = new Set((clasificados || []).map(c => c.pareja_id));

  const sorted = [...standings].sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.ds     !== a.ds)     return b.ds     - a.ds;
    if (b.gf     !== a.gf)     return b.gf     - a.gf;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''));
  });

  // Índice del último clasificado en el ranking global (para trazar el corte)
  let lastClasifIdx = -1;
  sorted.forEach((t, i) => { if (clasificadosIds.has(t.pareja_id)) lastClasifIdx = i; });

  const rows = sorted.map((team, idx) => {
    const esClasif  = clasificadosIds.has(team.pareja_id);
    const cutAfter  = idx === lastClasifIdx && lastClasifIdx < sorted.length - 1;
    return `
      <div style="display:flex; align-items:center; gap:8px; padding:3px 0; font-size:12px;
                  ${!esClasif ? 'opacity:0.5;' : ''}">
        <span style="min-width:18px; color:var(--muted); font-size:11px; text-align:right;">${idx + 1}.</span>
        <span style="min-width:14px;">${esClasif ? '✅' : ''}</span>
        <span style="flex:1; font-weight:${esClasif ? '500' : '400'};">${_esc(team.nombre)}</span>
        <span style="color:var(--muted); white-space:nowrap;">${team.puntos} pts</span>
        <span style="color:var(--muted); white-space:nowrap;">DS ${_signo(team.ds)}${Math.abs(team.ds || 0)}</span>
        <span style="color:var(--muted); font-size:11px; white-space:nowrap;">${_esc(team.grupoNombre)} ${team.posicion_en_grupo}°</span>
      </div>
      ${cutAfter ? '<div style="border-top:1px dashed #d1d5db; margin:4px 0;"></div>' : ''}
    `;
  }).join('');

  return `
    <details style="margin:6px 0 2px;">
      <summary style="cursor:pointer; font-size:12px; color:var(--muted); user-select:none; padding:2px 0;">
        Ver tabla completa (${sorted.length} equipos)
      </summary>
      <div style="margin-top:6px; padding:8px; background:#f9fafb;
                  border-radius:8px; border:1px solid var(--border);">
        <div style="display:flex; gap:8px; padding-bottom:4px; margin-bottom:4px;
                    font-size:11px; font-weight:600; color:var(--muted);
                    border-bottom:1px solid var(--border);">
          <span style="min-width:18px;">#</span>
          <span style="min-width:14px;"></span>
          <span style="flex:1;">Pareja</span>
          <span>Pts</span>
          <span style="min-width:52px;">DS</span>
          <span style="min-width:60px;">Grupo</span>
        </div>
        ${rows}
      </div>
    </details>
  `;
}

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _signo(n) { return (n >= 0) ? '+' : ''; }
