import { dom, el } from '../context.js';
import { state, isEditable } from '../state.js';
import { guardarOrdenGrupo, resetOrdenGrupo, cargarGrupoCierre } from './service.js';

export function renderGrupoError(grupo, msg) {
  const card = el('div', { class: 'admin-grupo' });
  card.appendChild(el('h3', {}, `Grupo ${grupo.nombre}`));
  card.appendChild(el('p', {}, msg));
  dom.contGrupos.appendChild(card);
}

export function renderOrUpdateGrupoCard(groupId) {
  const g = state.groups[groupId];
  if (!g) return;

  let card = dom.contGrupos.querySelector(`.admin-grupo[data-grupo-id="${groupId}"]`);
  const firstRender = !card;

  if (firstRender) {
    card = el('div', { class: 'admin-grupo', 'data-grupo-id': groupId });
    card.innerHTML = `
      <div class="admin-grupo-header">
        <div>
          <h3 style="margin:0;"></h3>
          <div class="admin-grupo-flags" style="margin-top:6px;"></div>
        </div>
        <div class="admin-grupo-meta" style="font-size:14px;"></div>
      </div>

      <div class="admin-grupo-warn"></div>

      <table class="tabla-posiciones" style="width:100%; margin-top:10px;">
        <thead>
          <tr>
            <th>#</th>
            <th>Pareja</th>
            <th>PJ</th>
            <th>PG</th>
            <th>PP</th>
            <th>GF</th>
            <th>GC</th>
            <th>DG</th>
            <th>P</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>

      <div class="admin-actions" style="margin-top:10px;">
        <button type="button" data-action="save">Guardar orden final</button>
        <button type="button" data-action="reset">Reset orden manual</button>
      </div>
    `;
    dom.contGrupos.appendChild(card);
  }

  card.querySelector('h3').textContent = `Grupo ${g.grupo.nombre}`;
  const { totalPartidos, jugados, faltan } = g.meta;
  card.querySelector('.admin-grupo-meta').innerHTML =
    `Partidos: <strong>${jugados}/${totalPartidos}</strong> ${faltan > 0 ? `<span>(faltan ${faltan})</span>` : '✅'}`;

  const flags = card.querySelector('.admin-grupo-flags');
  flags.innerHTML = '';

  if (g.tieLabel) {
    flags.appendChild(
      el('span', {}, `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #d39e00; background:#fff3cd;">⚠️ ${g.tieLabel}</span>`)
    );
  }

  if (g.hasSavedOverride) {
    flags.appendChild(
      el('span', { style: 'margin-left:8px;' }, `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #0b7285; background:#e6fcff;">📌 Orden manual</span>`)
    );
  }

  const warn = card.querySelector('.admin-grupo-warn');
  warn.innerHTML = '';
  if (!isEditable(groupId)) {
    warn.appendChild(el('p', {}, 'Edición bloqueada hasta que estén cargados todos los partidos del grupo.'));
    const btnUnlock = el('button', { type: 'button' }, 'Desbloquear edición (no recomendado)');
    btnUnlock.onclick = () => {
      state.groups[groupId].unlocked = true;
      renderOrUpdateGrupoCard(groupId);
    };
    warn.appendChild(btnUnlock);
  }

  updateTablaBody(groupId);

  const btnSave = card.querySelector('button[data-action="save"]');
  const btnReset = card.querySelector('button[data-action="reset"]');

  btnSave.disabled = !isEditable(groupId);
  btnReset.disabled = false;

  if (firstRender) {
    btnSave.onclick = async () => {
      btnSave.disabled = true;
      const prev = btnSave.textContent;
      btnSave.textContent = 'Guardando…';

      await guardarOrdenGrupo(groupId);

      btnSave.textContent = prev;
      btnSave.disabled = !isEditable(groupId);
      renderOrUpdateGrupoCard(groupId);
    };

    btnReset.onclick = async () => {
      btnReset.disabled = true;
      const prev = btnReset.textContent;
      btnReset.textContent = 'Reseteando…';

      await resetOrdenGrupo(groupId);

      btnReset.textContent = prev;
      btnReset.disabled = false;

      await cargarGrupoCierre(state.groups[groupId].grupo);
      renderOrUpdateGrupoCard(groupId);
    };
  }
}

function updateTablaBody(groupId) {
  const g = state.groups[groupId];
  const card = dom.contGrupos.querySelector(`.admin-grupo[data-grupo-id="${groupId}"]`);
  if (!g || !card) return;

  const tbody = card.querySelector('tbody');
  tbody.innerHTML = '';

  const editable = isEditable(groupId);

  g.rows.forEach((r, idx) => {
    const posActual = idx + 1;
    const posAuto = g.autoPosMap[r.pareja_id] ?? posActual;
    const delta = posAuto - posActual;

    let sup = '';
    if (delta !== 0) {
      const txt = delta > 0 ? `+${delta}` : `${delta}`;
      const color = delta > 0 ? '#1a7f37' : '#d1242f';
      sup = ` <sup style="font-size:12px; color:${color}; font-weight:700; margin-left:6px;">${txt}</sup>`;
    }

    const tr = document.createElement('tr');

    if (g.tieSet && g.tieSet.has(r.pareja_id)) {
      tr.style.background = '#fff3cd';
      tr.style.borderLeft = '4px solid #d39e00';
    }

    tr.innerHTML = `
      <td>${posActual}</td>
      <td>${r.nombre}${sup}</td>
      <td style="text-align:center;">${r.PJ}</td>
      <td style="text-align:center;">${r.PG}</td>
      <td style="text-align:center;">${r.PP}</td>
      <td style="text-align:center;">${r.GF}</td>
      <td style="text-align:center;">${r.GC}</td>
      <td style="text-align:center;">${r.DG}</td>
      <td style="text-align:center;"><strong>${r.P}</strong></td>
      <td style="white-space:nowrap;">
        <button type="button" data-move="up" style="margin-right:6px;">▲</button>
        <button type="button" data-move="down">▼</button>
      </td>
    `;

    const btnUp = tr.querySelector('button[data-move="up"]');
    const btnDown = tr.querySelector('button[data-move="down"]');

    btnUp.disabled = !editable || idx === 0;
    btnDown.disabled = !editable || idx === g.rows.length - 1;

    btnUp.onclick = () => mover(groupId, idx, -1);
    btnDown.onclick = () => mover(groupId, idx, +1);

    tbody.appendChild(tr);
  });
}

function mover(groupId, idx, delta) {
  const g = state.groups[groupId];
  if (!g) return;

  const nuevo = idx + delta;
  if (nuevo < 0 || nuevo >= g.rows.length) return;

  [g.rows[idx], g.rows[nuevo]] = [g.rows[nuevo], g.rows[idx]];
  updateTablaBody(groupId);
}
