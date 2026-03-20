import { dom, el } from '../context.js';
import { state, isEditable } from '../state.js';
import { guardarOrdenGrupo, resetOrdenGrupo, cargarGrupoCierre, cargarTablaGeneral, guardarSorteoInterGrupo, resetSorteoInterGrupo } from './service.js';

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
            <th>SF</th>
            <th>SC</th>
            <th>DS</th>
            <th>GF</th>
            <th>GC</th>
            <th>DG</th>
            <th>P</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div class="sorteo-legend" style="display:none; margin-top:6px; font-size:12px; color:#666;"></div>

      <div class="admin-actions" style="margin-top:10px;">
        <button type="button" data-action="save">💾 Guardar sorteo</button>
        <button type="button" data-action="reset">🧽 Reset sorteo</button>
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
    if (g.editableBase && !g.hasSavedOverride) {
      flags.appendChild(
        el('p', { style: 'margin:6px 0 0; font-size:13px; color:#856404;' },
          '🎲 Realizá un sorteo físico, ordená los empatados con ▲▼ y guardá el resultado.')
      );
    }
  }

  if (g.hasSavedOverride) {
    flags.appendChild(
      el('span', { style: 'margin-left:8px;' }, `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #0b7285; background:#e6fcff;">🎲 Sorteo guardado</span>`)
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

  const legend = card.querySelector('.sorteo-legend');
  if (legend) {
    const parts = [];
    if (g.hasSavedOverride) parts.push('🎲 = Posición definida por sorteo');
    if (g.h2hWinners && g.h2hWinners.size > 0) parts.push('H2H = Desempate por enfrentamiento directo');
    if (parts.length) {
      legend.style.display = '';
      legend.textContent = parts.join('  ·  ');
    } else {
      legend.style.display = 'none';
    }
  }

  const btnSave = card.querySelector('button[data-action="save"]');
  const btnReset = card.querySelector('button[data-action="reset"]');

  const showSave = (g.tieSet?.size > 0 || g.hasSavedOverride) && isEditable(groupId);
  const showReset = g.hasSavedOverride;

  btnSave.style.display = showSave ? '' : 'none';
  btnReset.style.display = showReset ? '' : 'none';
  btnSave.disabled = !isEditable(groupId);

  if (firstRender) {
    btnSave.onclick = async () => {
      btnSave.disabled = true;
      const prev = btnSave.textContent;
      btnSave.textContent = 'Guardando…';

      await guardarOrdenGrupo(groupId);
      await cargarGrupoCierre(state.groups[groupId].grupo);

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

/**
 * Determina si dos filas adyacentes pertenecen al mismo cluster de empate.
 */
function isSameCluster(g, idxA, idxB) {
  const a = g.rows[idxA];
  const b = g.rows[idxB];
  if (!a || !b) return false;

  const aIsTied = g.tieSet?.has(a.pareja_id) || (g.ovMap && g.ovMap[a.pareja_id] !== undefined);
  const bIsTied = g.tieSet?.has(b.pareja_id) || (g.ovMap && g.ovMap[b.pareja_id] !== undefined);
  if (!aIsTied || !bIsTied) return false;

  return a.P === b.P && a.DS === b.DS && a.DG === b.DG && a.GF === b.GF;
}

function updateTablaBody(groupId) {
  const g = state.groups[groupId];
  const card = dom.contGrupos.querySelector(`.admin-grupo[data-grupo-id="${groupId}"]`);
  if (!g || !card) return;

  const tbody = card.querySelector('tbody');
  tbody.innerHTML = '';

  const editable = isEditable(groupId);

  // Crear mapa de pareja_id a color de empate
  const tieColorMap = {};
  if (g.tieGroups) {
    g.tieGroups.forEach(group => {
      group.parejaIds.forEach(parejaId => {
        tieColorMap[parejaId] = group.color;
      });
    });
  }

  g.rows.forEach((r, idx) => {
    const posActual = idx + 1;

    // Superíndice: sorteo guardado o H2H
    let sup = '';
    if (g.ovMap && g.ovMap[r.pareja_id] !== undefined) {
      const ordenSorteo = g.ovMap[r.pareja_id];
      sup = ` <sup style="font-size:11px; color:#0b7285; font-weight:700; margin-left:3px;">🎲${ordenSorteo}</sup>`;
    } else if (g.h2hWinners && g.h2hWinners.has(r.pareja_id)) {
      sup = ` <sup style="font-size:10px; color:#2563eb; font-weight:700; margin-left:3px;">H2H</sup>`;
    }

    const tr = document.createElement('tr');

    // Aplicar color específico de empate si existe
    if (tieColorMap[r.pareja_id]) {
      const tieColor = tieColorMap[r.pareja_id];
      tr.style.background = tieColor.bg;
      tr.style.borderLeft = `4px solid ${tieColor.border}`;
    }

    // Flechas solo para equipos empatados o con sorteo guardado
    const showArrows = tieColorMap[r.pareja_id] || (g.ovMap && g.ovMap[r.pareja_id] !== undefined);

    tr.innerHTML = `
      <td>${posActual}</td>
      <td>${r.nombre}${sup}</td>
      <td style="text-align:center;">${r.PJ}</td>
      <td style="text-align:center;">${r.PG}</td>
      <td style="text-align:center;">${r.PP}</td>
      <td style="text-align:center;">${r.SF}</td>
      <td style="text-align:center;">${r.SC}</td>
      <td style="text-align:center;">${r.DS}</td>
      <td style="text-align:center;">${r.GF}</td>
      <td style="text-align:center;">${r.GC}</td>
      <td style="text-align:center;">${r.DG}</td>
      <td style="text-align:center;"><strong>${r.P}</strong></td>
      <td style="white-space:nowrap;">
        ${showArrows
          ? `<button type="button" data-move="up" style="margin-right:6px;">▲</button>
             <button type="button" data-move="down">▼</button>`
          : ''}
      </td>
    `;

    const btnUp = tr.querySelector('button[data-move="up"]');
    const btnDown = tr.querySelector('button[data-move="down"]');

    if (btnUp) {
      const prevIsSameCluster = idx > 0 && isSameCluster(g, idx - 1, idx);
      btnUp.disabled = !editable || !prevIsSameCluster;
      btnUp.onclick = () => mover(groupId, idx, -1);
    }
    if (btnDown) {
      const nextIsSameCluster = idx < g.rows.length - 1 && isSameCluster(g, idx, idx + 1);
      btnDown.disabled = !editable || !nextIsSameCluster;
      btnDown.onclick = () => mover(groupId, idx, +1);
    }

    tbody.appendChild(tr);
  });
}

function moverInterGrupo(parejaId, delta) {
  const gen = state.general;
  if (!gen) return;

  const idx = gen.standings.findIndex(s => s.pareja_id === parejaId);
  if (idx < 0) return;

  const nuevo = idx + delta;
  if (nuevo < 0 || nuevo >= gen.standings.length) return;

  const a = gen.standings[idx];
  const b = gen.standings[nuevo];
  if (a.posicion_en_grupo !== b.posicion_en_grupo) return;
  if (a.puntos !== b.puntos || a.ds !== b.ds || (a.dg || 0) !== (b.dg || 0) || a.gf !== b.gf) return;

  [gen.standings[idx], gen.standings[nuevo]] = [gen.standings[nuevo], gen.standings[idx]];
  renderTablaGeneralCard();

  const card = dom.contGrupos.querySelector('.admin-grupo[data-grupo-id="general"]');
  flashRow(card, nuevo);
}

export function renderTablaGeneralCard() {
  const gen = state.general;
  if (!gen || !gen.standings.length) return;

  let card = dom.contGrupos.querySelector('.admin-grupo[data-grupo-id="general"]');
  if (!card) {
    card = el('div', { class: 'admin-grupo', 'data-grupo-id': 'general' });
    dom.contGrupos.appendChild(card);
  }

  const { standings, gruposMap, tieGroupsInter, tieSetInter, interOvMap, hasSavedInterOverride } = gen;

  let flagsHtml = '';
  if (tieGroupsInter.length > 0 && !hasSavedInterOverride) {
    const labels = tieGroupsInter.map(tg =>
      `${tg.parejaIds.length} equipos en posición ${tg.posicion}°`
    ).join(', ');
    flagsHtml += `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #7c3aed; background:#ede9fe;">⚠️ Empate inter-grupo: ${labels}</span>`;
    flagsHtml += `<p style="margin:6px 0 0; font-size:13px; color:#6d28d9;">🎲 Realizá un sorteo físico, ordená los empatados con ▲▼ y guardá el resultado.</p>`;
  }
  if (hasSavedInterOverride) {
    flagsHtml += `<span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid #7c3aed; background:#ede9fe; margin-left:8px;">🎲 Sorteo inter-grupo guardado</span>`;
  }

  let prevPos = null;
  let rowsHtml = '';
  standings.forEach((s, idx) => {
    if (prevPos !== null && s.posicion_en_grupo !== prevPos) {
      rowsHtml += `<tr><td colspan="10" style="border:none; height:4px; background:#e5e7eb;"></td></tr>`;
    }

    const isTied = tieSetInter.has(s.pareja_id) || (interOvMap[s.pareja_id] !== undefined);

    let sup = '';
    if (interOvMap[s.pareja_id] !== undefined) {
      sup = ` <sup style="font-size:11px; color:#7c3aed; font-weight:700; margin-left:3px;">🎲${interOvMap[s.pareja_id]}</sup>`;
    }

    const grupoNombre = gruposMap[s.grupo_id] || '?';
    const dsStr = s.ds > 0 ? `+${s.ds}` : `${s.ds}`;
    const dgStr = (s.dg || 0) > 0 ? `+${s.dg || 0}` : `${s.dg || 0}`;

    rowsHtml += `<tr>
      <td>${idx + 1}</td>
      <td>${s.nombre || '—'}${sup}</td>
      <td style="text-align:center;">${grupoNombre}</td>
      <td style="text-align:center;">${s.posicion_en_grupo}°</td>
      <td style="text-align:center;"><strong>${s.puntos}</strong></td>
      <td style="text-align:center;">${dsStr}</td>
      <td style="text-align:center;">${s.gf}</td>
      <td style="text-align:center;">${s.gc || 0}</td>
      <td style="text-align:center;">${dgStr}</td>
      <td style="white-space:nowrap;">
        ${isTied
          ? `<button type="button" data-move-inter="up" data-pareja="${s.pareja_id}" style="margin-right:4px;">▲</button>
             <button type="button" data-move-inter="down" data-pareja="${s.pareja_id}">▼</button>`
          : ''}
      </td>
    </tr>`;

    prevPos = s.posicion_en_grupo;
  });

  const showSave = tieGroupsInter.length > 0 || hasSavedInterOverride;
  const showReset = hasSavedInterOverride;

  card.innerHTML = `
    <div class="admin-grupo-header">
      <div>
        <h3 style="margin:0;">Tabla General</h3>
        <div class="admin-grupo-flags" style="margin-top:6px;">${flagsHtml}</div>
      </div>
    </div>
    <table class="tabla-posiciones" style="width:100%; margin-top:10px;">
      <thead>
        <tr>
          <th>#</th>
          <th>Pareja</th>
          <th>Grupo</th>
          <th>Pos.</th>
          <th>P</th>
          <th>DS</th>
          <th>GF</th>
          <th>GC</th>
          <th>DG</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${hasSavedInterOverride ? '<div style="margin-top:6px; font-size:12px; color:#666;">🎲 = Posición definida por sorteo inter-grupo</div>' : ''}
    <div class="admin-actions" style="margin-top:10px;">
      <button type="button" data-action="save-inter" style="display:${showSave ? '' : 'none'}">💾 Guardar sorteo inter-grupo</button>
      <button type="button" data-action="reset-inter" style="display:${showReset ? '' : 'none'}">🧽 Reset sorteo inter-grupo</button>
    </div>
  `;

  card.querySelectorAll('button[data-move-inter]').forEach(btn => {
    btn.onclick = () => {
      const parejaId = btn.dataset.pareja;
      const dir = btn.dataset.moveInter === 'up' ? -1 : 1;
      moverInterGrupo(parejaId, dir);
    };
  });

  const btnSave = card.querySelector('button[data-action="save-inter"]');
  if (btnSave) {
    btnSave.onclick = async () => {
      btnSave.disabled = true;
      btnSave.textContent = 'Guardando…';
      await guardarSorteoInterGrupo();
      await cargarTablaGeneral();
      renderTablaGeneralCard();
      btnSave.textContent = '💾 Guardar sorteo inter-grupo';
      btnSave.disabled = false;
    };
  }

  const btnReset = card.querySelector('button[data-action="reset-inter"]');
  if (btnReset) {
    btnReset.onclick = async () => {
      btnReset.disabled = true;
      btnReset.textContent = 'Reseteando…';
      await resetSorteoInterGrupo();
      await cargarTablaGeneral();
      renderTablaGeneralCard();
      btnReset.textContent = '🧽 Reset sorteo inter-grupo';
      btnReset.disabled = false;
    };
  }
}

function flashRow(card, rowIdx) {
  const tr = card?.querySelector(`tbody`)?.children[rowIdx];
  if (!tr) return;
  const orig = tr.style.background;
  tr.style.transition = 'background 0.3s';
  tr.style.background = '#bfdbfe';
  setTimeout(() => { tr.style.background = orig; }, 600);
}

function mover(groupId, idx, delta) {
  const g = state.groups[groupId];
  if (!g) return;

  const nuevo = idx + delta;
  if (nuevo < 0 || nuevo >= g.rows.length) return;

  [g.rows[idx], g.rows[nuevo]] = [g.rows[nuevo], g.rows[idx]];
  updateTablaBody(groupId);

  const card = dom.contGrupos.querySelector(`.admin-grupo[data-grupo-id="${groupId}"]`);
  flashRow(card, nuevo);
}
