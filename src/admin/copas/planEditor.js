/**
 * Editor de plan de copas — wizard (Estado 1) y vista plan activo (Estado 2).
 *
 * Estado 1 — Sin plan:
 *   Panel 1: Lista acordeón de plantillas compatibles + "Crear nuevo"
 *   Panel 2: Wizard — ¿cuántas copas? + nombres
 *   Panel 3: Wizard — configurar cada copa (formato + seeding)
 *   Panel 4: Preview + guardar preset + aplicar
 *
 * Estado 2 — Plan definido (sin propuestas ni copas):
 *   renderPlanActivo: muestra bracket del plan vigente + Reset
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';
import {
  guardarEsquemas, esPlanBloqueado, cargarPresets, guardarPreset,
  eliminarPreset, resetCopas, detectarYSugerirPreset,
} from './planService.js';
import { labelRonda } from '../../utils/copaRondas.js';

// ─── Colores de copa (índice 0–5) ─────────────────────────────────────────────
const COPA_COLORS = [
  { bg: '#fef3c7', fg: '#92400e' },
  { bg: '#e5e7eb', fg: '#374151' },
  { bg: '#fed7aa', fg: '#9a3412' },
  { bg: '#e0e7ff', fg: '#3730a3' },
  { bg: '#d1fae5', fg: '#065f46' },
  { bg: '#fce7f3', fg: '#831843' },
];
const COPA_DEFAULTS = ['Copa Oro', 'Copa Plata', 'Copa Bronce', 'Copa Madera', 'Copa Cartón', 'Copa Papel'];

// ─── Módule-level state ────────────────────────────────────────────────────────
let _c       = null;  // container HTMLElement
let _onSaved = null;
let _ctx     = { numGrupos: 0, equiposPorGrupo: 0 };
let _dbPresets = [];  // todos los presets cargados desde BD

// Wizard state
let _wiz = null;   // { numCopas, copas: [{nombre, equipos, modo, posiciones, desde, hasta}] }

// ─── Entry point — Estado 1 ───────────────────────────────────────────────────
/**
 * @param {HTMLElement} container
 * @param {Function}    onSaved - callback para re-render tras aplicar el plan
 */
export async function renderPlanEditor(container, onSaved) {
  _c       = container;
  _onSaved = onSaved;

  container.innerHTML = '<p style="color:var(--muted);padding:12px 0;">⏳ Cargando…</p>';

  const [info, bloqueado, dbPresets] = await Promise.all([
    detectarYSugerirPreset(supabase, TORNEO_ID),
    esPlanBloqueado(supabase, TORNEO_ID),
    cargarPresets(supabase),
  ]);

  if (bloqueado) {
    container.innerHTML = `
      <div style="margin:12px 0; padding:14px; background:var(--bg);
           border-radius:8px; border:1px solid var(--border);">
        <p style="margin:0 0 12px 0;">
          🔒 El plan de copas es de un ciclo anterior. Hacé Reset para empezar de nuevo.
        </p>
        <button type="button" id="btn-reset-bloqueado" class="btn-sm btn-danger">
          🗑 Reset copas (borrar plan anterior)
        </button>
      </div>`;

    container.querySelector('#btn-reset-bloqueado')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btn-reset-bloqueado');
      btn.disabled = true;
      btn.textContent = '⏳ Reseteando...';
      const result = await resetCopas(supabase, TORNEO_ID);
      if (result.ok) {
        logMsg('✅ Plan anterior borrado — podés definir un nuevo plan');
        _onSaved?.();
      } else {
        logMsg(`❌ Error: ${result.msg}`);
        btn.disabled = false;
        btn.textContent = '🗑 Reset copas (borrar plan anterior)';
      }
    });
    return;
  }

  _dbPresets = dbPresets;
  _ctx = {
    numGrupos:       info.numGrupos,
    equiposPorGrupo: Math.round(info.parejasPorGrupo),
  };

  _initWiz(2);
  _showPresets();
}

// ─── Entry point — Estado 2 ───────────────────────────────────────────────────
/**
 * Muestra el plan vigente con diagrama de bracket + botón Reset.
 * Usada cuando hay esquemas definidos pero aún no hay propuestas ni copas.
 *
 * @param {HTMLElement} container
 * @param {Array}       esquemas  - Esquemas del torneo (desde BD)
 * @param {number}      numGrupos - Cantidad de grupos del torneo
 * @param {Function}    onReload  - Callback para recargar tras Reset
 */
export function renderPlanActivo(container, esquemas, numGrupos, onReload) {
  const copasSections = (esquemas || []).map(copa => `
    <div style="margin-bottom:20px;">
      ${renderBracketDiagram(copa, numGrupos)}
      <hr class="wiz-divider" style="margin-top:0;">
    </div>
  `).join('');

  container.innerHTML = `
    <div class="wiz-panel">
      <div style="font-weight:600; font-size:15px; margin-bottom:16px;">Plan de copas vigente</div>
      ${copasSections}
      <button type="button" id="btn-reset-plan" class="btn-sm btn-danger" style="margin-top:4px; width:100%; padding:10px;">
        🗑 Reset — borrar plan y empezar de nuevo
      </button>
    </div>
  `;

  container.querySelector('#btn-reset-plan').addEventListener('click', async () => {
    if (!confirm('¿Borrar el plan de copas y empezar de nuevo?')) return;
    const btn = container.querySelector('#btn-reset-plan');
    btn.disabled = true;
    btn.textContent = '⏳ Reseteando...';
    const result = await resetCopas(supabase, TORNEO_ID);
    if (result.ok) {
      logMsg('✅ Plan borrado — podés definir un nuevo plan');
      onReload?.();
    } else {
      logMsg(`❌ Error: ${result.msg}`);
      btn.disabled = false;
      btn.textContent = '🗑 Reset — borrar plan y empezar de nuevo';
    }
  });
}

// ─── Componente compartido: Diagrama de bracket ───────────────────────────────
/**
 * Renderiza un diagrama ASCII del bracket de una copa.
 * Usada en Panel 1 (acordeón) Y en renderPlanActivo — función única, sin duplicación.
 *
 * @param {{ nombre, formato, reglas }} copa
 * @param {number} numGrupos
 * @returns {string} HTML string con el diagrama
 */
export function renderBracketDiagram(copa, numGrupos) {
  const labels  = _getTeamLabels(copa, numGrupos);
  const nTeams  = labels.length;
  const fmtLabel = copa.formato === 'direct' ? 'Cruce directo'
                 : nTeams <= 4              ? 'Bracket 4'
                 :                           'Bracket 8';

  const badgeHtml = `<span class="wiz-badge" style="font-size:11px;vertical-align:middle;">${fmtLabel}</span>`;

  let tree;

  if (copa.formato === 'direct' || nTeams <= 2) {
    const a = labels[0] || '?';
    const b = labels[1] || '?';
    const w = Math.max(a.length, b.length);
    tree = [
      `${a.padEnd(w)} ─┐`,
      `${' '.repeat(w)}  ├─→ Final → Campeón`,
      `${b.padEnd(w)} ─┘`,
    ].join('\n');

  } else if (nTeams <= 4) {
    // Semi 1: labels[0] vs labels[2]; Semi 2: labels[1] vs labels[3]
    // (orden visual natural: pos × grupo → agrupados por posicion, luego grupo)
    const t = [...labels];
    while (t.length < 4) t.push('?');
    const w = Math.max(...t.map(s => s.length));
    const p = s => s.padEnd(w);
    // "├─ Semi 1 ─┐" = 12 chars, starts at col w+2 → ┐ at col w+13
    // After label+" ─┘" (w+3 chars), gap to finalCol = 10
    const finalCol = w + 13;
    tree = [
      `${p(t[0])} ─┐`,
      `${' '.repeat(w)}  ├─ Semi 1 ─┐`,
      `${p(t[2])} ─┘${' '.repeat(10)}├─→ Final → Campeón`,
      `${' '.repeat(finalCol)}│`,
      `${p(t[1])} ─┐${' '.repeat(10)}│`,
      `${' '.repeat(w)}  ├─ Semi 2 ─┘`,
      `${p(t[3])} ─┘`,
    ].join('\n');

  } else {
    // 8 equipos: mostrar cuartos como lista
    const t = [...labels];
    while (t.length < 8) t.push('?');
    const pairs = [[0,7],[3,4],[1,6],[2,5]]; // seeding estándar: 1v8, 4v5, 2v7, 3v6
    const lines = pairs.map(([a, b], i) =>
      `  QF${i + 1}: ${t[a]} vs ${t[b]}`
    ).join('\n');
    tree = `Cuartos de final:\n${lines}\n\n→ Semis → Final → Campeón`;
  }

  return `
    <div style="margin:6px 0 12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <strong style="font-size:13px;">${_esc(copa.nombre)}</strong>
        ${badgeHtml}
      </div>
      <pre style="font-family:monospace;font-size:12px;line-height:1.7;overflow-x:auto;
                  background:#f8fafc;border-radius:6px;padding:8px 10px;margin:0;">${tree}</pre>
    </div>
  `;
}

// ─── Panel 1: Acordeón de plantillas ──────────────────────────────────────────
function _showPresets() {
  _setLogVisible(true);

  if (_ctx.numGrupos === 0) {
    _c.innerHTML = `
      <div class="wiz-panel">
        <div style="padding:14px; background:#fffbeb; border:1px solid #fcd34d; border-radius:8px;
                    font-size:14px;">
          ⚠️ Configurá los grupos primero (tab Grupos) antes de definir las copas.
        </div>
      </div>`;
    return;
  }

  const ctxLabel    = `${_ctx.numGrupos} grupos × ${_ctx.equiposPorGrupo} equipos`;
  const compatibles = _filterDbCompatible(_dbPresets, _ctx.numGrupos, _ctx.equiposPorGrupo);

  const listHtml = compatibles.length === 0
    ? `<p style="text-align:center;padding:16px 8px;color:var(--muted);font-size:13px;line-height:1.5;">
         No hay plantillas guardadas para este formato (${_esc(ctxLabel)}).<br>
         Creá una desde cero con el asistente.
       </p>`
    : compatibles.map(p => `
        <div class="wiz-accordion-item">
          <div class="wiz-accordion-header" data-preset-id="${_esc(p.id)}"
               style="display:flex;align-items:center;justify-content:space-between;
                      padding:13px 14px;cursor:pointer;border-radius:8px;
                      background:var(--bg);border:1px solid var(--border);
                      transition:background 0.15s;">
            <span style="font-size:14px;font-weight:500;">${_esc(p.nombre)}</span>
            <span class="wiz-accordion-icon" style="font-size:16px;color:var(--muted);
                  transition:transform 0.2s;">›</span>
          </div>
          <div class="wiz-accordion-body" style="display:none;padding:12px 14px 14px;
               border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;
               background:#fff;margin-bottom:10px;">
            ${(p.esquemas || []).map(copa => renderBracketDiagram(copa, _ctx.numGrupos)).join('')}
            <div style="display:flex;gap:8px;margin-top:4px;">
              <button type="button" class="btn-sm btn-primary wiz-acc-apply"
                      data-preset-id="${_esc(p.id)}"
                      style="flex:1;padding:10px;">✓ Aplicar</button>
              <button type="button" class="btn-sm wiz-acc-del"
                      data-preset-id="${_esc(p.id)}"
                      style="padding:10px 14px;border-color:#fca5a5;color:#dc2626;background:transparent;">
                🗑 Borrar
              </button>
            </div>
          </div>
        </div>
      `).join('');

  _c.innerHTML = `
    <div class="wiz-panel">
      <div style="font-size:13px;color:var(--muted);margin-bottom:14px;">
        Formato del torneo: <strong style="color:var(--text);">${_esc(ctxLabel)}</strong>
      </div>

      <div id="wiz-accordion-list" style="display:flex;flex-direction:column;gap:0;">
        ${listHtml}
      </div>

      <button type="button" class="wiz-add-btn" id="wiz-btn-nuevo" style="margin-top:12px;">
        <span style="font-size:18px;line-height:1;">+</span>
        Crear nuevo
      </button>

      <p class="helper" style="margin-top:14px;font-size:13px;">
        ℹ️ Los cruces se propondrán automáticamente al confirmarse resultados de grupo.
      </p>
    </div>
  `;

  // Acordeón: toggle individual, múltiples pueden estar abiertos simultáneamente
  _c.querySelectorAll('.wiz-accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = header.nextElementSibling;
      const icon = header.querySelector('.wiz-accordion-icon');
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      icon.style.transform = isOpen ? '' : 'rotate(90deg)';
    });
  });

  // Aplicar
  _c.querySelectorAll('.wiz-acc-apply').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = _dbPresets.find(x => x.id === btn.dataset.presetId);
      if (!p) return;
      btn.disabled = true;
      btn.textContent = '⏳';
      await _applyEsquemas(p.esquemas, btn);
    });
  });

  // Borrar
  _c.querySelectorAll('.wiz-acc-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Borrar esta plantilla?')) return;
      const result = await eliminarPreset(supabase, btn.dataset.presetId);
      if (!result.ok) {
        logMsg(`❌ Error borrando plantilla: ${result.msg}`);
        return;
      }
      _dbPresets = _dbPresets.filter(x => x.id !== btn.dataset.presetId);
      _showPresets();
    });
  });

  _c.querySelector('#wiz-btn-nuevo').addEventListener('click', () => {
    _initWiz(2);
    _showWizNum();
  });
}

// ─── Panel 2: ¿Cuántas copas? ─────────────────────────────────────────────────
function _showWizNum() {
  _setLogVisible(false);
  _c.innerHTML = `
    <div class="wiz-panel">
      <div class="wiz-topbar">
        <button type="button" class="wiz-back" id="wiz-back-num">‹</button>
        <span class="wiz-topbar-title">Nuevo esquema</span>
      </div>
      <div class="wiz-progress" id="wiz-prog-num"></div>

      <label class="wiz-label" style="margin-top:12px;">¿Cuántas copas?</label>
      <div class="wiz-num-grid" id="wiz-num-grid"></div>

      <hr class="wiz-divider" />
      <label class="wiz-label">Nombres</label>
      <div class="wiz-copa-names" id="wiz-copa-names"></div>

      <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
        <button type="button" class="btn-primary" style="width:100%;padding:12px;" id="wiz-num-next">
          Siguiente →
        </button>
        <button type="button" class="btn-sm" style="width:100%;padding:10px;" id="wiz-num-cancel">
          Cancelar
        </button>
      </div>
    </div>
  `;

  _renderProgressDots('wiz-prog-num', 0, _wiz.numCopas + 2);
  _renderNumGrid();
  _renderCopaNames();

  _c.querySelector('#wiz-back-num').addEventListener('click', _showPresets);
  _c.querySelector('#wiz-num-cancel').addEventListener('click', _showPresets);
  _c.querySelector('#wiz-num-next').addEventListener('click', () => {
    _c.querySelectorAll('.wiz-copa-name-input').forEach((inp, i) => {
      if (_wiz.copas[i]) {
        _wiz.copas[i].nombre = inp.value.trim() || (COPA_DEFAULTS[i] ?? `Copa ${i + 1}`);
      }
    });
    _showWizCopa(0);
  });
}

function _renderNumGrid() {
  const grid = _c.querySelector('#wiz-num-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let n = 1; n <= 6; n++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wiz-num-btn' + (n === _wiz.numCopas ? ' active' : '');
    btn.textContent = n;
    btn.addEventListener('click', () => {
      _wiz.numCopas = n;
      const totalEquipos = _ctx.numGrupos * _ctx.equiposPorGrupo || 4;
      while (_wiz.copas.length < n) {
        const i    = _wiz.copas.length;
        const prev = _wiz.copas[i - 1];
        _wiz.copas.push({
          nombre:     COPA_DEFAULTS[i] ?? `Copa ${i + 1}`,
          equipos:    prev?.equipos ?? 4,
          modo:       prev?.modo    ?? 'grupo',
          posiciones: [],
          desde:      prev?.desde ?? 1,
          hasta:      prev?.hasta ?? Math.min(totalEquipos, 4),
        });
      }
      _wiz.copas = _wiz.copas.slice(0, n);
      _renderProgressDots('wiz-prog-num', 0, n + 2);
      _renderNumGrid();
      _renderCopaNames();
    });
    grid.appendChild(btn);
  }
}

function _renderCopaNames() {
  const el = _c.querySelector('#wiz-copa-names');
  if (!el) return;
  el.innerHTML = '';
  _wiz.copas.forEach((copa, i) => {
    const { bg, fg } = COPA_COLORS[i] ?? COPA_COLORS[0];
    const row = document.createElement('div');
    row.className = 'wiz-copa-name-row';
    row.innerHTML = `
      <div class="wiz-copa-bullet" style="background:${bg}; color:${fg};">${i + 1}</div>
      <input class="wiz-copa-name-input" type="text"
             value="${_esc(copa.nombre)}"
             placeholder="${_esc(COPA_DEFAULTS[i] ?? `Copa ${i + 1}`)}" />
    `;
    el.appendChild(row);
  });
}

// ─── Panel 3: Configurar copa ─────────────────────────────────────────────────
function _showWizCopa(idx) {
  if (idx >= _wiz.numCopas) {
    _showPreview(() => _showWizCopa(_wiz.numCopas - 1));
    return;
  }

  const copa  = _wiz.copas[idx];
  const isLast = idx === _wiz.numCopas - 1;
  const { bg, fg } = COPA_COLORS[idx] ?? COPA_COLORS[0];

  _c.innerHTML = `
    <div class="wiz-panel">
      <div class="wiz-topbar">
        <button type="button" class="wiz-back" id="wiz-back-copa">‹</button>
        <div>
          <div class="wiz-topbar-title">${_esc(copa.nombre)}</div>
          <div style="font-size:12px; color:var(--muted);">Copa ${idx + 1} de ${_wiz.numCopas}</div>
        </div>
      </div>
      <div class="wiz-progress" id="wiz-prog-copa"></div>

      <div class="wiz-copa-step-header" style="margin-top:12px;">
        <div class="wiz-copa-bullet" style="background:${bg}; color:${fg}; width:28px; height:28px;">${idx + 1}</div>
        <strong style="font-size:15px;">${_esc(copa.nombre)}</strong>
      </div>

      <div id="wiz-copa-content"></div>
      <div id="wiz-copa-err" style="display:none; margin-top:8px; padding:8px 12px;
           background:#fef2f2; border:1px solid #fca5a5; border-radius:8px;
           font-size:13px; font-weight:600; color:var(--danger);"></div>

      <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
        <button type="button" class="btn-primary" style="width:100%;padding:12px;" id="wiz-copa-next">
          ${isLast ? 'Ver resumen →' : 'Siguiente →'}
        </button>
        <button type="button" class="btn-sm" style="width:100%;padding:10px;" id="wiz-copa-cancel">
          Cancelar
        </button>
      </div>
    </div>
  `;

  _renderProgressDots('wiz-prog-copa', idx + 1, _wiz.numCopas + 2);
  _renderCopaContent(idx);

  _c.querySelector('#wiz-back-copa').addEventListener('click', () => {
    if (idx === 0) _showWizNum();
    else _showWizCopa(idx - 1);
  });
  _c.querySelector('#wiz-copa-cancel').addEventListener('click', _showPresets);

  _c.querySelector('#wiz-copa-next').addEventListener('click', () => {
    const copa = _wiz.copas[idx];
    const nG   = _ctx.numGrupos || 1;
    const teams = copa.modo === 'global'
      ? Math.max(0, (copa.hasta ?? 1) - (copa.desde ?? 1) + 1)
      : copa.posiciones.length * nG;
    if (teams !== copa.equipos) {
      const errEl = _c.querySelector('#wiz-copa-err');
      if (errEl) {
        errEl.textContent = `Seleccioná exactamente ${copa.equipos} equipos — tenés ${teams} seleccionados.`;
        errEl.style.display = 'block';
      }
      return;
    }
    _showWizCopa(idx + 1);
  });
}

function _renderCopaContent(idx) {
  const copa   = _wiz.copas[idx];
  const nG     = _ctx.numGrupos || 1;
  const maxPos = _ctx.equiposPorGrupo || 4;
  const content = _c.querySelector('#wiz-copa-content');
  if (!content) return;

  const errEl = _c.querySelector('#wiz-copa-err');
  if (errEl) errEl.style.display = 'none';

  const taken = new Set();
  _wiz.copas.forEach((c, i) => {
    if (i !== idx && c.modo === 'grupo') c.posiciones.forEach(p => taken.add(p));
  });

  const calcTeams = () => {
    if (copa.modo === 'global') return Math.max(0, (copa.hasta ?? 1) - (copa.desde ?? 1) + 1);
    return copa.posiciones.length * nG;
  };

  const segHtml = [2, 4, 8].map(n => {
    const sub = n === 2 ? '1 partido' : n === 4 ? `${labelRonda('SF', true)}+${labelRonda('F', true)}` : labelRonda('QF', true);
    return `
      <button type="button" class="wiz-seg-opt${copa.equipos === n ? ' active' : ''}" data-eq="${n}">
        <div style="font-weight:600;">${n}</div>
        <div style="font-size:11px;">${sub}</div>
      </button>`;
  }).join('');

  let posHtml = '';
  if (copa.modo === 'grupo') {
    const teams = calcTeams();
    for (let pos = 1; pos <= maxPos; pos++) {
      const checked      = copa.posiciones.includes(pos);
      const takenByOther = taken.has(pos) && !checked;
      const wouldExceed  = !checked && (teams + nG) > copa.equipos;
      const disabled     = takenByOther || wouldExceed;
      const checkIcon    = checked
        ? '<svg width="11" height="11" viewBox="0 0 11 11"><polyline points="1.5,5.5 4.5,8.5 9.5,2.5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '';
      posHtml += `
        <div class="wiz-pos-item${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}"
             data-pos="${pos}" ${disabled ? 'aria-disabled="true"' : ''}>
          <div class="wiz-pos-checkbox">${checkIcon}</div>
          <div class="wiz-pos-label">
            ${pos}° de cada grupo
            ${takenByOther ? '<span style="color:var(--muted); font-size:12px;">— ya asignado</span>' : ''}
          </div>
          <div style="font-size:13px; color:var(--muted);">×${nG}</div>
        </div>`;
    }
  }

  let globalHtml = '';
  if (copa.modo === 'global') {
    const totalEquipos = nG * maxPos;
    const d = copa.desde ?? 1;
    const h = copa.hasta ?? copa.equipos;
    const count = Math.max(0, h - d + 1);
    const ok = count === copa.equipos;
    let optD = '', optH = '';
    for (let i = 1; i <= totalEquipos; i++) {
      optD += `<option value="${i}"${i === d ? ' selected' : ''}>${i}°</option>`;
      optH += `<option value="${i}"${i === h ? ' selected' : ''}>${i}°</option>`;
    }
    globalHtml = `
      <div class="wiz-range-row">
        <span style="font-size:14px; color:var(--muted);">Del puesto</span>
        <select class="wiz-range-select" id="wiz-desde">${optD}</select>
        <span style="font-size:14px; color:var(--muted);">al</span>
        <select class="wiz-range-select" id="wiz-hasta">${optH}</select>
        <span style="font-size:13px; font-weight:600; ${ok ? 'color:var(--success)' : 'color:var(--danger)'};">
          ${count} eq${ok ? ' ✓' : ''}
        </span>
      </div>
      <div class="wiz-warn-box">
        ⚠️ <strong>Arranque diferido</strong>: esta copa no puede empezar hasta que
        <em>todos</em> los grupos terminen (necesitamos el ranking completo del torneo).
      </div>`;
  }

  const teams = calcTeams();
  const badgeStyle = teams === copa.equipos ? 'color:var(--success)'
                   : teams > copa.equipos   ? 'color:var(--danger)'
                   :                          'color:var(--warning)';
  const badgeIcon = teams === copa.equipos ? '✓' : teams < copa.equipos ? '⚠' : '✗';

  content.innerHTML = `
    <label class="wiz-label" style="margin-top:14px;">Equipos que compiten</label>
    <div class="wiz-seg">${segHtml}</div>
    <p class="helper" style="margin-top:6px;">
      ${copa.equipos === 2 ? '1 partido — cruce directo'
      : copa.equipos === 4 ? '2 semis + 1 final + 3er puesto'
      :                      '4 cuartos de final + semis + final'}
    </p>

    <hr class="wiz-divider" />

    <label class="wiz-label">¿Cómo clasifican los ${copa.equipos} equipos?</label>
    <div class="wiz-radio-group">
      <div class="wiz-radio-item${copa.modo === 'grupo' ? ' selected' : ''}" data-modo="grupo">
        <div class="wiz-radio-dot"></div>
        <div>
          <div class="wiz-radio-label">Por posición en su grupo</div>
          <div class="wiz-radio-desc">Los N-ésimos de cada grupo (ej: "los primeros de cada grupo")</div>
        </div>
      </div>
      <div class="wiz-radio-item${copa.modo === 'global' ? ' selected' : ''}" data-modo="global">
        <div class="wiz-radio-dot"></div>
        <div>
          <div class="wiz-radio-label">Por tabla general del torneo</div>
          <div class="wiz-radio-desc">Los mejor rankeados del torneo, sin importar el grupo</div>
        </div>
      </div>
    </div>

    ${copa.modo === 'grupo' ? `
      <hr class="wiz-divider" />
      <label class="wiz-label">Posiciones que clasifican</label>
      <p class="helper" style="margin-bottom:10px;">
        Los equipos sin copa simplemente no juegan — está bien dejar posiciones sin seleccionar.
      </p>
      ${posHtml}
      <div style="margin-top:8px; font-size:13px; font-weight:600; ${badgeStyle};">
        ${badgeIcon} ${teams} de ${copa.equipos} equipos seleccionados
      </div>
    ` : `
      <hr class="wiz-divider" />
      <label class="wiz-label">Rango del ranking del torneo</label>
      ${globalHtml}
    `}
  `;

  content.querySelectorAll('.wiz-seg-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      copa.equipos = parseInt(btn.dataset.eq);
      copa.posiciones = [];
      if (copa.modo === 'global') copa.hasta = (copa.desde ?? 1) + copa.equipos - 1;
      _renderCopaContent(idx);
    });
  });

  content.querySelectorAll('.wiz-radio-item').forEach(item => {
    item.addEventListener('click', () => {
      copa.modo = item.dataset.modo;
      if (copa.modo === 'global') {
        copa.posiciones = [];
        copa.desde = copa.desde ?? 1;
        copa.hasta = copa.hasta ?? copa.equipos;
      }
      _renderCopaContent(idx);
    });
  });

  content.querySelectorAll('.wiz-pos-item:not(.disabled)').forEach(item => {
    item.addEventListener('click', () => {
      const pos = parseInt(item.dataset.pos);
      const i   = copa.posiciones.indexOf(pos);
      if (i >= 0) {
        copa.posiciones.splice(i, 1);
      } else {
        if ((copa.posiciones.length + 1) * nG > copa.equipos) return;
        copa.posiciones.push(pos);
        copa.posiciones.sort((a, b) => a - b);
      }
      _renderCopaContent(idx);
    });
  });

  content.querySelector('#wiz-desde')?.addEventListener('change', e => {
    copa.desde = parseInt(e.target.value);
    _renderCopaContent(idx);
  });
  content.querySelector('#wiz-hasta')?.addEventListener('change', e => {
    copa.hasta = parseInt(e.target.value);
    _renderCopaContent(idx);
  });
}

// ─── Panel 4: Preview + guardar ───────────────────────────────────────────────
function _showPreview(backFn) {
  _setLogVisible(false);
  const nG = _ctx.numGrupos || 1;

  const previewHtml = _wiz.copas.map((copa, i) => {
    const { bg, fg } = COPA_COLORS[i] ?? COPA_COLORS[0];
    const teams = copa.modo === 'global'
      ? Math.max(0, (copa.hasta ?? 1) - (copa.desde ?? 1) + 1)
      : copa.posiciones.length * nG;
    const formatLabel = copa.equipos === 2 ? 'Cruce directo'
                      : copa.equipos === 4 ? 'Bracket de 4' : 'Bracket de 8';
    const reglaDesc = copa.modo === 'global'
      ? `📊 Tabla general: puestos ${copa.desde}° a ${copa.hasta}° (${teams} eq)`
      : copa.posiciones.length > 0
        ? `👥 ${copa.posiciones.map(p => `${p}°`).join(' + ')} de cada grupo → ${teams} equipos`
        : '⚠️ Sin posiciones seleccionadas';
    const globalWarn = copa.modo === 'global'
      ? `<div style="font-size:12px; color:var(--warning); margin-top:4px;">
           ⚠️ Todos los grupos deben terminar antes de que arranque
         </div>`
      : '';

    return `
      <div class="wiz-preview-copa">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <div class="wiz-copa-bullet" style="background:${bg}; color:${fg}; width:26px; height:26px;">${i + 1}</div>
          <strong style="font-size:15px;">${_esc(copa.nombre)}</strong>
          <span style="font-size:12px; padding:2px 8px; border-radius:10px;
                       background:var(--primary-soft); color:var(--primary-900); font-weight:500;">
            ${formatLabel}
          </span>
        </div>
        <div style="font-size:13px; color:var(--muted);">📌 ${reglaDesc}</div>
        ${globalWarn}
      </div>`;
  }).join('');

  const copasInvalidas = _wiz.copas.filter(c => c.modo === 'grupo' && c.posiciones.length === 0);

  _c.innerHTML = `
    <div class="wiz-panel">
      <div class="wiz-topbar">
        <button type="button" class="wiz-back" id="wiz-back-preview">‹</button>
        <span class="wiz-topbar-title">Resumen del plan</span>
      </div>
      <div class="wiz-progress" id="wiz-prog-preview"></div>

      <div style="margin-top:12px;">
        ${previewHtml}
      </div>

      <div class="wiz-save-preset-section">
        <div class="wiz-save-toggle" id="wiz-save-toggle">
          <div>
            <div style="font-weight:600; font-size:14px;">💾 Guardar como plantilla</div>
            <div style="font-size:12px; color:var(--muted); margin-top:2px;">Para reutilizar en futuros torneos</div>
          </div>
          <div class="wiz-toggle-switch" id="wiz-toggle-sw"><div class="wiz-toggle-knob"></div></div>
        </div>
        <div id="wiz-preset-name-area" style="display:none; margin-top:10px;">
          <input type="text" id="wiz-preset-name-input" class="wiz-preset-name-input"
                 placeholder="Nombre de la plantilla (ej: 2x4 mis brackets)" />
        </div>
      </div>

      ${copasInvalidas.length > 0 ? `
        <div style="margin-top:12px; padding:10px 12px; background:#fef2f2;
             border:1px solid #fca5a5; border-radius:8px; font-size:13px; color:#dc2626;">
          ⚠️ ${copasInvalidas.map(c => `${_esc(c.nombre)}: sin posiciones seleccionadas`).join(' · ')}
        </div>` : ''}

      <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">
        <button type="button" class="btn-primary" style="padding:12px;" id="wiz-btn-confirm"
                ${copasInvalidas.length > 0 ? 'disabled' : ''}>
          ✓ Aplicar este plan
        </button>
        <button type="button" class="btn-sm" style="padding:10px;" id="wiz-btn-cancel">
          Cancelar
        </button>
      </div>
    </div>
  `;

  _renderProgressDots('wiz-prog-preview', _wiz.numCopas + 1, _wiz.numCopas + 2);

  _c.querySelector('#wiz-back-preview').addEventListener('click', backFn ?? _showPresets);
  _c.querySelector('#wiz-btn-cancel').addEventListener('click', _showPresets);

  const toggleSw = _c.querySelector('#wiz-toggle-sw');
  const nameArea = _c.querySelector('#wiz-preset-name-area');
  _c.querySelector('#wiz-save-toggle').addEventListener('click', () => {
    toggleSw.classList.toggle('on');
    nameArea.style.display = toggleSw.classList.contains('on') ? 'block' : 'none';
    if (toggleSw.classList.contains('on')) {
      _c.querySelector('#wiz-preset-name-input').focus();
    }
  });

  _c.querySelector('#wiz-btn-confirm').addEventListener('click', async () => {
    const btn    = _c.querySelector('#wiz-btn-confirm');
    const saveOn = _c.querySelector('#wiz-toggle-sw').classList.contains('on');
    btn.disabled = true;
    btn.textContent = '⏳ Guardando…';
    if (saveOn) {
      const nombre = _c.querySelector('#wiz-preset-name-input').value.trim();
      if (nombre) {
        const claveCtx = `${_ctx.numGrupos}x${_ctx.equiposPorGrupo}-custom`;
        const esquemas = _wizToEsquemas();
        const result = await guardarPreset(supabase, { nombre, clave: claveCtx, esquemas });
        if (result.ok) {
          _dbPresets.push({ id: result.id, nombre, clave: claveCtx, descripcion: null, esquemas });
        } else {
          logMsg(`⚠️ No se pudo guardar la plantilla: ${result.msg}`);
        }
      }
    }
    await _applyEsquemas(_wizToEsquemas(), btn);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function _applyEsquemas(esquemas, btn) {
  const result = await guardarEsquemas(supabase, TORNEO_ID, esquemas);
  if (result.ok) {
    logMsg('✅ Plan de copas guardado');
    try {
      const { data } = await supabase.rpc('verificar_y_proponer_copas', { p_torneo_id: TORNEO_ID });
      if (data?.propuestas_generadas > 0) {
        logMsg(`✅ ${data.propuestas_generadas} propuesta(s) generada(s) automáticamente`);
      }
    } catch (_) {
      // fire-and-forget
    }
    _setLogVisible(true);
    _onSaved?.();
  } else {
    logMsg(`❌ ${result.msg}`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✓ Aplicar este plan';
    }
  }
}

function _wizToEsquemas() {
  return _wiz.copas.map((copa, i) => ({
    nombre:  copa.nombre || COPA_DEFAULTS[i] || `Copa ${i + 1}`,
    orden:   i + 1,
    formato: copa.equipos === 2 ? 'direct' : 'bracket',
    reglas:  copa.modo === 'global'
      ? [{ modo: 'global', desde: copa.desde, hasta: copa.hasta }]
      : copa.posiciones.map(p => ({ posicion: p })),
  }));
}

// ─── Wizard state helpers ──────────────────────────────────────────────────────
function _initWiz(n) {
  const totalEquipos = _ctx.numGrupos * _ctx.equiposPorGrupo || 4;
  _wiz = {
    numCopas: n,
    copas: Array.from({ length: n }, (_, i) => ({
      nombre:     COPA_DEFAULTS[i] ?? `Copa ${i + 1}`,
      equipos:    4,
      modo:       'grupo',
      posiciones: [],
      desde:      1,
      hasta:      Math.min(totalEquipos, 4),
    })),
  };
}

// ─── Team labels para bracket diagram ─────────────────────────────────────────
function _getTeamLabels(copa, numGrupos) {
  if (!copa.reglas || copa.reglas.length === 0) return [];
  const r0 = copa.reglas[0];

  if (r0.modo === 'global') {
    const desde = r0.desde || 1;
    const hasta = r0.hasta || 4;
    return Array.from({ length: hasta - desde + 1 }, (_, i) => `Tabla ${desde + i}°`);
  }

  // Modo grupo: posiciones × grupos
  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const posiciones = copa.reglas
    .filter(r => r.posicion && !r.criterio)
    .map(r => r.posicion)
    .sort((a, b) => a - b);

  const labels = [];
  for (const pos of posiciones) {
    for (let g = 0; g < numGrupos; g++) {
      labels.push(`${pos}°Gr${LETRAS[g]}`);
    }
  }
  return labels;
}

// ─── DB preset filter ─────────────────────────────────────────────────────────
/**
 * Filtra presets de BD compatibles con el formato actual del torneo.
 * Todas las plantillas se tratan igual — sin distinción de ningún tipo.
 */
function _filterDbCompatible(dbPresets, numGrupos, ppg) {
  const ppgR   = Math.round(ppg);
  const prefix = `${numGrupos}x${ppgR}`;
  return dbPresets.filter(p =>
    p.clave === prefix || p.clave.startsWith(prefix + '-')
  );
}

// ─── Progress dots ────────────────────────────────────────────────────────────
function _renderProgressDots(containerId, currentStep, totalSteps) {
  const el = _c.querySelector(`#${containerId}`);
  if (!el) return;
  let html = '';
  for (let i = 0; i < totalSteps; i++) {
    const cls = i < currentStep  ? 'wiz-dot done'
              : i === currentStep ? 'wiz-dot active'
              :                     'wiz-dot';
    html += `<div class="${cls}"></div>`;
  }
  el.innerHTML = html;
}

// ─── Log visibility ───────────────────────────────────────────────────────────
function _setLogVisible(visible) {
  const details = document.querySelector('.admin-log-details');
  if (!details) return;
  if (visible) details.setAttribute('open', '');
  else details.removeAttribute('open');
}

// ─── HTML escape ──────────────────────────────────────────────────────────────
function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
