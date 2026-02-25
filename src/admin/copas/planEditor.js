/**
 * Editor de plan de copas — Estado 1
 * Renderiza las cards de esquemas y permite definir/editar el plan.
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';
import { cargarEsquemas, guardarEsquemas, esPlanBloqueado } from './planService.js';
import { detectarYSugerirPreset } from './presets.js';

/**
 * Renderiza el editor de plan dentro de `container`.
 * @param {HTMLElement} container
 * @param {Function} onSaved - callback para re-render tras guardar
 */
export async function renderPlanEditor(container, onSaved) {
  const [esquemas, sugerencia, bloqueado] = await Promise.all([
    cargarEsquemas(supabase, TORNEO_ID),
    detectarYSugerirPreset(supabase, TORNEO_ID),
    esPlanBloqueado(supabase, TORNEO_ID)
  ]);

  // Estado mutable para las cards (independiente de la BD)
  const estado = { cards: esquemas.map(e => ({ ...e })) };

  _render(container, estado, sugerencia, bloqueado, onSaved);
}

function _render(container, estado, sugerencia, bloqueado, onSaved) {
  const { cards } = estado;

  const presetBadge = sugerencia
    ? `<span class="copa-preset-badge">Formato detectado: <strong>${sugerencia.clave}</strong></span>`
    : '';

  const aplicarPresetBtn = sugerencia && cards.length === 0 && !bloqueado
    ? `<button type="button" id="btn-aplicar-preset" class="btn-secondary btn-sm">
         ✨ Aplicar preset ${sugerencia.clave}
       </button>`
    : '';

  const cardsHtml = cards.length > 0
    ? cards.map((e, i) => _cardHtml(e, i, bloqueado)).join('')
    : `<p class="helper" style="text-align:center; padding:16px 0;">
         Sin plan definido.
         ${sugerencia ? `Aplicá el preset <strong>${sugerencia.clave}</strong> o creá las copas manualmente.` : 'Creá las copas manualmente.'}
       </p>`;

  const addBtn = !bloqueado
    ? `<button type="button" id="btn-add-copa" class="btn-sm" style="margin-top:8px;">
         + Agregar copa
       </button>`
    : '';

  const actionBar = bloqueado
    ? `<div class="helper-info" style="margin-top:12px;">
         🔒 Plan bloqueado — hay partidos de copa aprobados. Usá Reset para empezar de nuevo.
       </div>`
    : `<div class="admin-actions" style="margin-top:12px;">
         ${aplicarPresetBtn}
         <button type="button" id="btn-save-plan" class="btn-primary btn-sm">
           💾 Guardar plan
         </button>
       </div>`;

  container.innerHTML = `
    <div class="copa-plan-section">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
        <strong>Plan de Copas</strong>
        ${presetBadge}
      </div>

      <div id="copa-cards-list">
        ${cardsHtml}
      </div>

      ${addBtn}
      ${actionBar}

      <p class="helper" style="margin-top:14px; font-size:13px;">
        ℹ️ Los cruces se propondrán automáticamente al confirmarse resultados de grupo.
      </p>
    </div>
  `;

  _wireEvents(container, estado, sugerencia, bloqueado, onSaved);
}

function _cardHtml(esquema, index, bloqueado) {
  const formatoLabel = esquema.formato === 'bracket' ? 'Semi + Final' : 'Cruce directo';
  const reglasDesc = _describirReglas(esquema.reglas);

  return `
    <div class="copa-card" data-index="${index}"
         style="border:1px solid var(--border); border-radius:12px; padding:10px 12px;
                margin-bottom:8px; background:var(--surface,#fff);">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        ${bloqueado
          ? `<span style="font-weight:600;">${_escHtml(esquema.nombre)}</span>`
          : `<input type="text" class="copa-nombre-input"
                   value="${_escHtml(esquema.nombre)}"
                   placeholder="Nombre de la copa"
                   style="flex:1; min-width:120px; padding:6px 10px;
                          border:1px solid var(--border); border-radius:8px;
                          font-size:14px;" />`
        }
        <select class="copa-formato-select"
                ${bloqueado ? 'disabled' : ''}
                style="padding:6px 8px; border:1px solid var(--border);
                       border-radius:8px; font-size:13px;">
          <option value="bracket" ${esquema.formato === 'bracket' ? 'selected' : ''}>Semi + Final</option>
          <option value="direct"  ${esquema.formato === 'direct'  ? 'selected' : ''}>Cruce directo</option>
        </select>
        ${!bloqueado
          ? `<button type="button" class="btn-remove-copa btn-sm"
                     data-index="${index}"
                     style="padding:4px 10px; font-size:12px; border-radius:8px;
                            border:1px solid var(--border); background:transparent; cursor:pointer;"
                     title="Eliminar copa">✕</button>`
          : ''
        }
      </div>
      <div style="font-size:12px; color:var(--muted); margin-top:4px;">
        ${reglasDesc}
      </div>
    </div>
  `;
}

function _wireEvents(container, estado, sugerencia, bloqueado, onSaved) {
  if (bloqueado) return;

  // Aplicar preset
  container.querySelector('#btn-aplicar-preset')?.addEventListener('click', async () => {
    if (!sugerencia) return;
    const btn = container.querySelector('#btn-aplicar-preset');
    btn.disabled = true;
    btn.textContent = '⏳ Aplicando...';

    const result = await guardarEsquemas(supabase, TORNEO_ID, sugerencia.esquemas);
    if (result.ok) {
      logMsg(`✅ Preset ${sugerencia.clave} aplicado`);
      onSaved?.();
    } else {
      logMsg(`❌ ${result.msg}`);
      btn.disabled = false;
      btn.textContent = `✨ Aplicar preset ${sugerencia.clave}`;
    }
  });

  // Agregar copa vacía
  container.querySelector('#btn-add-copa')?.addEventListener('click', () => {
    const list = container.querySelector('#copa-cards-list');
    const idx = list.querySelectorAll('.copa-card').length;
    const nuevo = {
      nombre: `Copa ${idx + 1}`,
      formato: 'bracket',
      reglas: [{ posicion: idx + 1 }],
      orden: idx + 1
    };
    estado.cards.push(nuevo);
    // Re-render la lista
    list.innerHTML = estado.cards.map((e, i) => _cardHtml(e, i, false)).join('');
    _wireCardEvents(container, estado);
  });

  _wireCardEvents(container, estado);

  // Guardar plan
  container.querySelector('#btn-save-plan')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-save-plan');
    const cards = container.querySelectorAll('.copa-card');

    const nuevos = Array.from(cards).map((card, i) => {
      const nombre  = card.querySelector('.copa-nombre-input')?.value?.trim() || `Copa ${i + 1}`;
      const formato = card.querySelector('.copa-formato-select')?.value || 'bracket';
      const idx     = parseInt(card.dataset.index);
      const reglas  = estado.cards[idx]?.reglas || [{ posicion: i + 1 }];
      return { nombre, orden: i + 1, formato, reglas };
    });

    btn.disabled = true;
    btn.textContent = '⏳ Guardando...';

    const result = await guardarEsquemas(supabase, TORNEO_ID, nuevos);
    if (result.ok) {
      logMsg('✅ Plan guardado');
      onSaved?.();
    } else {
      logMsg(`❌ ${result.msg}`);
      btn.disabled = false;
      btn.textContent = '💾 Guardar plan';
    }
  });
}

function _wireCardEvents(container, estado) {
  container.querySelectorAll('.btn-remove-copa').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      estado.cards.splice(idx, 1);
      const list = container.querySelector('#copa-cards-list');
      list.innerHTML = estado.cards.map((e, i) => _cardHtml(e, i, false)).join('');
      _wireCardEvents(container, estado);
    });
  });
}

function _describirReglas(reglas) {
  if (!reglas || reglas.length === 0) return '<em>Sin reglas definidas</em>';
  return reglas.map(r => {
    if (!r.criterio) return `${r.posicion}° de cada grupo`;
    const k = r.cantidad ? `${r.cantidad} ` : '';
    return `${k}${r.posicion}° (${r.criterio === 'mejor' ? 'mejor' : 'peor'})`;
  }).join(' + ');
}

function _escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
