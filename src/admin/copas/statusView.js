/**
 * Vista de estado de copas — Estados 2 y 3
 * Renderiza propuestas pendientes + copas en curso.
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';
import {
  invocarMotorPropuestas,
  aprobarPropuestas,
  modificarPropuesta,
  resetCopas
} from './planService.js';
import { formatearResultado } from '../../utils/formatoResultado.js';

/**
 * Renderiza el estado actual de las copas.
 * @param {HTMLElement} container
 * @param {Array}    esquemas   - Esquemas del torneo
 * @param {Array}    propuestas - Todas las propuestas (con datos enriquecidos)
 * @param {Array}    copas      - Copas existentes
 * @param {Function} onRefresh  - Callback para re-render
 */
export async function renderStatusView(container, esquemas, propuestas, copas, onRefresh) {
  // Cargar partidos de copa para mostrar estado
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

  // Agrupar propuestas por esquema_copa_id
  const propuestasPorEsquema = {};
  (propuestas || []).forEach(p => {
    const eid = p.esquema?.id;
    if (!eid) return;
    if (!propuestasPorEsquema[eid]) propuestasPorEsquema[eid] = [];
    propuestasPorEsquema[eid].push(p);
  });

  // Mapa copa por esquema_copa_id
  const copaPorEsquema = {};
  (copas || []).forEach(c => {
    if (c.esquema_copa_id) copaPorEsquema[c.esquema_copa_id] = c;
  });

  // Contar propuestas pendientes totales
  const totalPendientes = (propuestas || []).filter(p => p.estado === 'pendiente').length;

  const titulo = totalPendientes > 0
    ? `Copas — <span style="color:var(--warning,#d97706);">${totalPendientes} propuesta${totalPendientes > 1 ? 's' : ''} para revisar</span>`
    : 'Copas — En curso';

  const seccionesHtml = esquemas.map(esq => {
    const propEsq     = propuestasPorEsquema[esq.id] || [];
    const pendientes  = propEsq.filter(p => p.estado === 'pendiente');
    const copa        = copaPorEsquema[esq.id];
    const partidos    = copa ? (partidosPorCopa[copa.id] || []) : [];

    if (pendientes.length > 0) {
      return _renderEsquemaPropuestas(esq, pendientes);
    } else if (partidos.length > 0) {
      return _renderEsquemaEnCurso(esq, copa, partidos);
    } else {
      return _renderEsquemaEsperando(esq);
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

  _wireStatusEvents(container, esquemas, propuestasPorEsquema, onRefresh);
}

function _renderEsquemaPropuestas(esquema, propuestas) {
  const formatoLabel = esquema.formato === 'direct' ? 'cruce directo' : `${propuestas.length} semi${propuestas.length > 1 ? 's' : ''}`;
  const crucesHtml = propuestas.map((p, i) => `
    <div class="copa-propuesta-fila" data-propuesta-id="${p.id}"
         style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;
                padding:6px 0; border-bottom:1px solid var(--border,#e5e7eb);">
      <span style="font-size:13px; color:var(--muted); min-width:40px;">
        ${esquema.formato === 'direct' ? '⚔️' : `Semi ${i + 1}`}
      </span>
      <span class="copa-prop-a" style="font-size:14px; font-weight:500;">
        ${_esc(p.pareja_a?.nombre || '?')}
      </span>
      <span style="color:var(--muted); font-size:12px;">vs</span>
      <span class="copa-prop-b" style="font-size:14px; font-weight:500;">
        ${_esc(p.pareja_b?.nombre || '?')}
      </span>
      <button type="button" class="btn-swap-propuesta btn-sm"
              data-index="${i}"
              style="font-size:11px; padding:3px 8px; border:1px solid var(--border);
                     border-radius:6px; background:transparent; cursor:pointer; margin-left:4px;"
              title="Invertir A y B en este cruce">
        ⇄
      </button>
    </div>
  `).join('');

  return `
    <div class="copa-seccion" data-esquema-id="${esquema.id}"
         style="border:1px solid #f59e0b; border-radius:12px; padding:12px 14px;
                margin-bottom:10px; background:rgba(251,191,36,0.06);">
      <div style="display:flex; justify-content:space-between; align-items:center;
                  margin-bottom:8px; flex-wrap:wrap; gap:8px;">
        <div>
          <strong>${_esc(esquema.nombre)}</strong>
          <span style="font-size:12px; color:var(--muted); margin-left:6px;">
            ${formatoLabel} propuesto${propuestas.length > 1 ? 's' : ''}
          </span>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-aprobar-propuesta btn-primary btn-sm"
                  data-esquema-id="${esquema.id}">
            ✅ Aprobar
          </button>
        </div>
      </div>
      <div class="copa-cruces-list">
        ${crucesHtml}
      </div>
    </div>
  `;
}

function _renderEsquemaEnCurso(esquema, copa, partidos) {
  const semis  = partidos.filter(p => p.ronda_copa === 'SF').sort((a, b) => (a.orden_copa||0) - (b.orden_copa||0));
  const final  = partidos.find(p => p.ronda_copa === 'F');
  const tercer = partidos.find(p => p.ronda_copa === '3P');
  const directo = partidos.find(p => p.ronda_copa === 'direct');

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
    ...semis.map((s, i) => renderPartido(s, `Semi ${i + 1}`)),
    renderPartido(directo, '⚔️'),
    renderPartido(final, 'Final'),
    renderPartido(tercer, '3° Puesto')
  ].filter(Boolean).join('');

  // Indicador de si la final se va a generar automáticamente
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

function _renderEsquemaEsperando(esquema) {
  return `
    <div class="copa-seccion"
         style="border:1px solid var(--border,#e5e7eb); border-radius:12px;
                padding:12px 14px; margin-bottom:10px; opacity:0.7;">
      <div style="display:flex; align-items:center; gap:8px;">
        <strong>${_esc(esquema.nombre)}</strong>
        <span style="font-size:12px; color:var(--muted);">⏳ Esperando grupos…</span>
      </div>
    </div>
  `;
}

function _wireStatusEvents(container, esquemas, propuestasPorEsquema, onRefresh) {
  // Aprobar propuestas
  container.querySelectorAll('.btn-aprobar-propuesta').forEach(btn => {
    btn.addEventListener('click', async () => {
      const esquemaId = btn.dataset.esquemaId;
      btn.disabled = true;
      btn.textContent = '⏳ Aprobando...';

      const { ok, partidos_creados, msg } = await (await import('./planService.js')).aprobarPropuestas(supabase, esquemaId);
      if (ok) {
        logMsg(`✅ Propuestas aprobadas — ${partidos_creados} partidos creados`);
        onRefresh?.();
      } else {
        logMsg(`❌ Error: ${msg}`);
        btn.disabled = false;
        btn.textContent = '✅ Aprobar';
      }
    });
  });

  // Swap de propuesta (invertir A y B dentro de un cruce)
  container.querySelectorAll('.copa-seccion').forEach(seccion => {
    const esquemaId = seccion.dataset.esquemaId;
    const propEsq = propuestasPorEsquema[esquemaId] || [];

    seccion.querySelectorAll('.btn-swap-propuesta').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.index);
        const propuesta = propEsq[idx];
        if (!propuesta) return;

        btn.disabled = true;
        const { ok, msg } = await modificarPropuesta(
          supabase, propuesta.id,
          propuesta.pareja_b?.id, propuesta.pareja_a?.id
        );

        if (ok) {
          logMsg('✅ Cruce invertido');
          onRefresh?.();
        } else {
          logMsg(`❌ Error: ${msg}`);
          btn.disabled = false;
        }
      });
    });
  });

  // Proponer ahora (forzar motor)
  container.querySelector('#btn-proponer-ahora')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-proponer-ahora');
    btn.disabled = true;
    btn.textContent = '⏳ Evaluando...';

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

  // Editar plan
  container.querySelector('#btn-editar-plan')?.addEventListener('click', async () => {
    const { renderPlanEditor } = await import('./planEditor.js');
    const co = document.getElementById('copas-admin');
    if (co) renderPlanEditor(co, onRefresh, esquemas);
  });

  // Reset copas — dialog con dos opciones de alcance
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
      btn.textContent = '⏳ Limpiando...';

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
      btn.textContent = '⏳ Reseteando...';

      const { resetCopas } = await import('./planService.js');
      const result = await resetCopas(supabase, TORNEO_ID);
      if (result.ok) {
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

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
