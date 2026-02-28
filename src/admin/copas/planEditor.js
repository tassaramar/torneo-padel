/**
 * Editor de plan de copas — wizard (Estado 1).
 *
 * Flujo:
 *   Panel 1: Lista de presets compatibles + "Crear personalizado"
 *   Panel 2: Wizard — ¿cuántas copas? + nombres
 *   Panel 3: Wizard — configurar cada copa (formato + seeding)
 *   Panel 4: Preview + guardar preset + aplicar
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';
import { guardarEsquemas, esPlanBloqueado } from './planService.js';
import { detectarYSugerirPreset, obtenerPresetsCompatibles } from './presets.js';

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
const LOCAL_PRESETS_KEY = 'copa_presets_custom';

// ─── Módule-level state ────────────────────────────────────────────────────────
let _c      = null;  // container HTMLElement
let _onSaved = null;
let _ctx    = { numGrupos: 0, equiposPorGrupo: 0 };
let _presets = [];   // compatible presets from presets.js

// Wizard state
let _wiz = null;   // { numCopas, copas: [{nombre, equipos, modo, posiciones, desde, hasta}] }

// ─── Entry point ──────────────────────────────────────────────────────────────
/**
 * @param {HTMLElement} container
 * @param {Function} onSaved - callback para re-render tras aplicar el plan
 */
export async function renderPlanEditor(container, onSaved) {
  _c       = container;
  _onSaved = onSaved;

  container.innerHTML = '<p style="color:var(--muted);padding:12px 0;">⏳ Cargando…</p>';

  const [info, bloqueado] = await Promise.all([
    detectarYSugerirPreset(supabase, TORNEO_ID),
    esPlanBloqueado(supabase, TORNEO_ID),
  ]);

  if (bloqueado) {
    container.innerHTML = `
      <p class="helper" style="margin:12px 0; padding:10px 12px; background:var(--bg);
         border-radius:8px; border:1px solid var(--border);">
        🔒 Plan bloqueado — hay copas aprobadas. Usá <strong>Reset</strong> para empezar de nuevo.
      </p>`;
    return;
  }

  _ctx = {
    numGrupos:      info.numGrupos,
    equiposPorGrupo: Math.round(info.parejasPorGrupo),
  };
  _presets = obtenerPresetsCompatibles(info.numGrupos, info.parejasPorGrupo);

  _initWiz(2);
  _showPresets();
}

// ─── Wizard state helpers ──────────────────────────────────────────────────────
function _initWiz(n) {
  const totalEquipos = _ctx.numGrupos * _ctx.equiposPorGrupo || 4;
  _wiz = {
    numCopas: n,
    copas: Array.from({ length: n }, (_, i) => ({
      nombre:    COPA_DEFAULTS[i] ?? `Copa ${i + 1}`,
      equipos:   4,
      modo:      'grupo',
      posiciones: [],
      desde:     1,
      hasta:     Math.min(totalEquipos, 4),
    })),
  };

}

// ─── Panel 1: Presets ──────────────────────────────────────────────────────────
function _showPresets() {
  _setLogVisible(true);
  const ctxLabel = _ctx.numGrupos > 0
    ? `${_ctx.numGrupos} grupos · ${_ctx.equiposPorGrupo} eq c/u`
    : 'Formato desconocido';

  const presetsHtml = _presets.length === 0
    ? `<p class="helper" style="text-align:center; padding:12px 0;">
         No hay presets para este formato (${_esc(ctxLabel)}).
       </p>`
    : _presets.map(p => `
        <div class="wiz-card${p.recomendado ? ' wiz-card--featured' : ''}">
          <div class="wiz-card-header">
            <div class="wiz-card-title">${_esc(p.nombre)}</div>
            ${p.recomendado ? '<span class="wiz-badge">Recomendado</span>' : ''}
          </div>
          <p class="wiz-card-desc">${_esc(p.descripcion)}</p>
          <div class="wiz-card-actions">
            <button type="button" class="btn-sm wiz-btn-edit" data-clave="${_esc(p.clave)}">✏️ Editar</button>
            <button type="button" class="btn-sm btn-primary wiz-btn-apply" data-clave="${_esc(p.clave)}">✓ Aplicar</button>
          </div>
        </div>
      `).join('');

  const localPresets = _loadLocalPresets();
  const localHtml = localPresets.length === 0
    ? `<p class="helper" style="text-align:center; padding:8px 0; opacity:0.65;">
         No hay presets guardados todavía.
       </p>`
    : localPresets.map((p, i) => `
        <div class="wiz-card">
          <div class="wiz-card-header">
            <div class="wiz-card-title">${_esc(p.nombre)}</div>
          </div>
          <div class="wiz-card-actions">
            <button type="button" class="btn-sm wiz-btn-local-edit" data-idx="${i}">✏️ Editar</button>
            <button type="button" class="btn-sm btn-primary wiz-btn-local-apply" data-idx="${i}">✓ Aplicar</button>
            <button type="button" class="btn-sm wiz-btn-local-del" data-idx="${i}"
              style="border-color:#fca5a5; color:#dc2626; background:transparent;">✕</button>
          </div>
        </div>
      `).join('');

  _c.innerHTML = `
    <div class="wiz-panel">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <strong style="font-size:15px;">Plan de Copas</strong>
        ${_ctx.numGrupos > 0 ? `<span class="wiz-ctx-badge">${_esc(ctxLabel)}</span>` : ''}
      </div>

      ${_presets.length > 0 ? '<div class="wiz-section-label">Presets compatibles</div>' : ''}
      ${presetsHtml}

      <div class="wiz-section-label" style="margin-top:14px;">Mis presets guardados</div>
      ${localHtml}

      <button type="button" class="wiz-add-btn" id="wiz-btn-custom">
        <span style="font-size:18px; line-height:1;">+</span>
        Crear esquema personalizado
      </button>

      <p class="helper" style="margin-top:14px; font-size:13px;">
        ℹ️ Los cruces se propondrán automáticamente al confirmarse resultados de grupo.
      </p>
    </div>
  `;

  _c.querySelector('#wiz-btn-custom').addEventListener('click', () => {
    _initWiz(2);
    _showWizNum();
  });

  _c.querySelectorAll('.wiz-btn-apply').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '⏳';
      const preset = _presets.find(p => p.clave === btn.dataset.clave);
      if (preset) await _applyEsquemas(preset.esquemas, btn);
    });
  });

  _c.querySelectorAll('.wiz-btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = _presets.find(p => p.clave === btn.dataset.clave);
      if (!preset) return;
      _fromEsquemasToWiz(preset.esquemas);
      _showPreview(() => _showPresets());
    });
  });

  _c.querySelectorAll('.wiz-btn-local-apply').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = localPresets[parseInt(btn.dataset.idx)];
      btn.disabled = true;
      btn.textContent = '⏳';
      if (p) await _applyEsquemas(p.esquemas, btn);
    });
  });

  _c.querySelectorAll('.wiz-btn-local-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = localPresets[parseInt(btn.dataset.idx)];
      if (!p) return;
      _fromEsquemasToWiz(p.esquemas);
      _showPreview(() => _showPresets());
    });
  });

  _c.querySelectorAll('.wiz-btn-local-del').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('¿Borrar este preset guardado?')) return;
      _deleteLocalPreset(parseInt(btn.dataset.idx));
      _showPresets();
    });
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

      <div style="margin-top:14px;">
        <button type="button" class="btn-primary" style="width:100%; padding:12px;" id="wiz-num-next">
          Siguiente →
        </button>
      </div>
    </div>
  `;

  _renderProgressDots('wiz-prog-num', 0, _wiz.numCopas + 2);
  _renderNumGrid();
  _renderCopaNames();

  _c.querySelector('#wiz-back-num').addEventListener('click', _showPresets);
  _c.querySelector('#wiz-num-next').addEventListener('click', () => {
    // Persist names from inputs
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
        const i = _wiz.copas.length;
        _wiz.copas.push({
          nombre: COPA_DEFAULTS[i] ?? `Copa ${i + 1}`,
          equipos: 4, modo: 'grupo', posiciones: [],
          desde: 1, hasta: Math.min(totalEquipos, 4),
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

  const copa = _wiz.copas[idx];
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

      <div style="margin-top:14px;">
        <button type="button" class="btn-primary" style="width:100%; padding:12px;" id="wiz-copa-next">
          ${isLast ? 'Ver resumen →' : 'Siguiente →'}
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

  _c.querySelector('#wiz-copa-next').addEventListener('click', () => {
    _showWizCopa(idx + 1);
  });
}

function _renderCopaContent(idx) {
  const copa  = _wiz.copas[idx];
  const nG    = _ctx.numGrupos || 1;
  const maxPos = _ctx.equiposPorGrupo || 4;
  const content = _c.querySelector('#wiz-copa-content');
  if (!content) return;

  // Positions already taken by other copas
  const taken = new Set();
  _wiz.copas.forEach((c, i) => {
    if (i !== idx && c.modo === 'grupo') c.posiciones.forEach(p => taken.add(p));
  });

  const calcTeams = () => {
    if (copa.modo === 'global') return Math.max(0, (copa.hasta ?? 1) - (copa.desde ?? 1) + 1);
    return copa.posiciones.length * nG;
  };

  // ── Format selector (2 / 4 / 8 teams) ──────────────────────────────────────
  const segHtml = [2, 4, 8].map(n => {
    const sub = n === 2 ? '1 partido' : n === 4 ? 'semi+final' : 'cuartos';
    return `
      <button type="button" class="wiz-seg-opt${copa.equipos === n ? ' active' : ''}" data-eq="${n}">
        <div style="font-weight:600;">${n}</div>
        <div style="font-size:11px;">${sub}</div>
      </button>`;
  }).join('');

  // ── Position checkboxes ──────────────────────────────────────────────────────
  let posHtml = '';
  if (copa.modo === 'grupo') {
    const teams = calcTeams();
    for (let pos = 1; pos <= maxPos; pos++) {
      const checked = copa.posiciones.includes(pos);
      const takenByOther = taken.has(pos) && !checked;
      const wouldExceed  = !checked && (teams + nG) > copa.equipos;
      const disabled     = takenByOther || wouldExceed;
      const ordinal      = `${pos}°`;
      const checkIcon    = checked
        ? '<svg width="11" height="11" viewBox="0 0 11 11"><polyline points="1.5,5.5 4.5,8.5 9.5,2.5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '';
      posHtml += `
        <div class="wiz-pos-item${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}"
             data-pos="${pos}" ${disabled ? 'aria-disabled="true"' : ''}>
          <div class="wiz-pos-checkbox">${checkIcon}</div>
          <div class="wiz-pos-label">
            ${ordinal} de cada grupo
            ${takenByOther ? '<span style="color:var(--muted); font-size:12px;">— ya asignado</span>' : ''}
          </div>
          <div style="font-size:13px; color:var(--muted);">×${nG}</div>
        </div>`;
    }
  }

  // ── Global range ─────────────────────────────────────────────────────────────
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

  // ── Team count badge ──────────────────────────────────────────────────────────
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

  // Wire: format segment
  content.querySelectorAll('.wiz-seg-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      copa.equipos = parseInt(btn.dataset.eq);
      copa.posiciones = [];
      if (copa.modo === 'global') copa.hasta = (copa.desde ?? 1) + copa.equipos - 1;
      _renderCopaContent(idx);
    });
  });

  // Wire: mode radio
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

  // Wire: position checkboxes
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

  // Wire: global selects
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
            <div style="font-weight:600; font-size:14px;">💾 Guardar como preset</div>
            <div style="font-size:12px; color:var(--muted); margin-top:2px;">Para reutilizar en futuros torneos</div>
          </div>
          <div class="wiz-toggle-switch" id="wiz-toggle-sw"><div class="wiz-toggle-knob"></div></div>
        </div>
        <div id="wiz-preset-name-area" style="display:none; margin-top:10px;">
          <input type="text" id="wiz-preset-name-input" class="wiz-preset-name-input"
                 placeholder="Nombre del preset (ej: 2x4 mis brackets)" />
        </div>
      </div>

      <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">
        <button type="button" class="btn-primary" style="padding:12px;" id="wiz-btn-confirm">
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

  // Toggle save preset
  const toggleSw  = _c.querySelector('#wiz-toggle-sw');
  const nameArea  = _c.querySelector('#wiz-preset-name-area');
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
    if (saveOn) {
      const nombre = _c.querySelector('#wiz-preset-name-input').value.trim();
      if (nombre) _saveLocalPreset(nombre, _wizToEsquemas());
    }
    btn.disabled = true;
    btn.textContent = '⏳ Guardando…';
    await _applyEsquemas(_wizToEsquemas(), btn);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function _applyEsquemas(esquemas, btn) {
  const result = await guardarEsquemas(supabase, TORNEO_ID, esquemas);
  if (result.ok) {
    logMsg('✅ Plan de copas guardado');
    _setLogVisible(true);
    _onSaved?.();
  } else {
    logMsg(`❌ ${result.msg}`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✓ Aplicar este plan';
    }
    _showPresets();
  }
}

/** Converts wizard state copas → esquemas_copa rows. */
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

/** Loads existing esquemas into wizard state (best-effort, for "Editar"). */
function _fromEsquemasToWiz(esquemas) {
  const nG = _ctx.numGrupos || 2;
  _wiz = {
    numCopas: esquemas.length,
    copas: esquemas.map(e => {
      const r0 = e.reglas?.[0];
      if (r0?.modo === 'global') {
        return {
          nombre:    e.nombre,
          equipos:   Math.max(2, (r0.hasta ?? 4) - (r0.desde ?? 1) + 1),
          modo:      'global',
          posiciones: [],
          desde:     r0.desde ?? 1,
          hasta:     r0.hasta ?? 4,
        };
      }
      // Simple posicion-based (ignores criterio rules gracefully)
      const posiciones = (e.reglas ?? [])
        .filter(r => r.posicion && !r.criterio)
        .map(r => r.posicion);
      const equiposInferred = posiciones.length * nG;
      const equipos = e.formato === 'direct' ? 2
                    : equiposInferred <= 4    ? 4
                    :                          8;
      return {
        nombre: e.nombre,
        equipos,
        modo:   'grupo',
        posiciones,
        desde:  1,
        hasta:  4,
      };
    }),
  };

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

// ─── Local preset storage (localStorage) ─────────────────────────────────────
function _loadLocalPresets() {
  try { return JSON.parse(localStorage.getItem(LOCAL_PRESETS_KEY) || '[]'); }
  catch { return []; }
}

function _saveLocalPreset(nombre, esquemas) {
  const list = _loadLocalPresets();
  list.push({ nombre, esquemas });
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(list));
}

function _deleteLocalPreset(idx) {
  const list = _loadLocalPresets();
  list.splice(idx, 1);
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(list));
}

// ─── Log visibility ──────────────────────────────────────────────────────────
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
