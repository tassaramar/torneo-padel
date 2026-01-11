import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

console.log('ADMIN JS CARGADO');

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const log = document.getElementById('log');
const contGrupos = document.getElementById('grupos-admin');

function logMsg(msg) {
  const p = document.createElement('p');
  p.textContent = msg;
  log.appendChild(p);
}

function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (html) node.innerHTML = html;
  return node;
}

/* =========================
   STATE
========================= */

const state = {
  // groupId -> {
  //   grupo: {id, nombre},
  //   meta: {totalPartidos, jugados, faltan},
  //   rows: [ ... ],
  //   editableBase: boolean,
  //   unlocked: boolean
  // }
  groups: {}
};

function isEditable(groupId) {
  const g = state.groups[groupId];
  return !!g && (g.editableBase || g.unlocked);
}

/* =========================
   BOTONES: RESET / GENERAR
========================= */

document.getElementById('reset-grupos').onclick = async () => {
  logMsg('🧹 Eliminando partidos de grupos…');

  const { error } = await supabase
    .from('partidos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .is('copa_id', null);

  if (error) {
    console.error(error);
    logMsg('❌ Error eliminando partidos de grupos');
    return;
  }

  logMsg('🧹 Partidos de grupos eliminados');
  await cargarCierreGrupos();
};

document.getElementById('gen-grupos').onclick = async () => {
  logMsg('🎾 Generando partidos de grupos…');

  const { data: grupos, error: errGrupos } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errGrupos || !grupos || grupos.length === 0) {
    console.error(errGrupos);
    logMsg('❌ No hay grupos');
    return;
  }

  const { data: parejas, error: errParejas } = await supabase
    .from('parejas')
    .select('id')
    .eq('torneo_id', TORNEO_ID)
    .order('created_at');

  if (errParejas || !parejas || parejas.length < 2) {
    console.error(errParejas);
    logMsg('❌ No hay suficientes parejas');
    return;
  }

  if (parejas.length % grupos.length !== 0) {
    logMsg(`❌ Formato inválido: ${parejas.length} parejas / ${grupos.length} grupos`);
    logMsg('❌ No se pueden repartir parejas equitativamente');
    return;
  }

  const parejasPorGrupo = parejas.length / grupos.length;

  let cursor = 0;
  const gruposMap = {};
  for (const grupo of grupos) {
    gruposMap[grupo.id] = parejas.slice(cursor, cursor + parejasPorGrupo);
    cursor += parejasPorGrupo;
  }

  let total = 0;

  for (const grupo of grupos) {
    const ps = gruposMap[grupo.id];
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const { error } = await supabase
          .from('partidos')
          .insert({
            torneo_id: TORNEO_ID,
            grupo_id: grupo.id,
            pareja_a_id: ps[i].id,
            pareja_b_id: ps[j].id,
            copa_id: null
          });

        if (!error) total++;
        else console.error(error);
      }
    }
  }

  logMsg(`🎾 ${total} partidos de grupos creados`);
  await cargarCierreGrupos();
};

/* =========================
   CIERRE DE GRUPOS (OVERRIDES)
========================= */

async function cargarCierreGrupos() {
  contGrupos.innerHTML = '';
  state.groups = {};

  const { data: grupos, error: errGrupos } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errGrupos) {
    console.error(errGrupos);
    contGrupos.textContent = 'Error cargando grupos';
    return;
  }

  if (!grupos || grupos.length === 0) {
    contGrupos.textContent = 'No hay grupos.';
    return;
  }

  for (const grupo of grupos) {
    await cargarGrupoCierre(grupo);
  }
}

async function cargarGrupoCierre(grupo) {
  const { data: partidos, error: errPartidos } = await supabase
    .from('partidos')
    .select(`
      id,
      games_a,
      games_b,
      pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
    `)
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupo.id)
    .is('copa_id', null);

  if (errPartidos) {
    console.error(errPartidos);
    renderGrupoError(grupo, 'Error cargando partidos del grupo');
    return;
  }

  const totalPartidos = (partidos || []).length;
  const jugados = (partidos || []).filter(p => p.games_a !== null && p.games_b !== null).length;
  const faltan = totalPartidos - jugados;

  const rowsAuto = calcularTablaGrupo(partidos || []);

  // overrides guardados
  const { data: ov, error: errOv } = await supabase
    .from('posiciones_manual')
    .select('pareja_id, orden_manual')
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupo.id);

  if (errOv) console.error(errOv);

  const ovMap = {};
  (ov || []).forEach(x => {
    if (x.orden_manual !== null) ovMap[x.pareja_id] = x.orden_manual;
  });

  const rowsOrdenadas = ordenarConOverrides(rowsAuto, ovMap);

  state.groups[grupo.id] = {
    grupo,
    meta: { totalPartidos, jugados, faltan },
    rows: rowsOrdenadas,
    editableBase: faltan === 0,
    unlocked: false
  };

  renderOrUpdateGrupoCard(grupo.id);
}

function calcularTablaGrupo(partidos) {
  const map = {}; // parejaId -> row

  function init(p) {
    if (!map[p.id]) {
      map[p.id] = {
        pareja_id: p.id,
        nombre: p.nombre,
        PJ: 0, PG: 0, PP: 0,
        GF: 0, GC: 0, DG: 0,
        P: 0
      };
    }
    return map[p.id];
  }

  for (const m of partidos) {
    const a = init(m.pareja_a);
    const b = init(m.pareja_b);

    const jugado = m.games_a !== null && m.games_b !== null;
    if (!jugado) continue;

    const ga = Number(m.games_a);
    const gb = Number(m.games_b);

    a.PJ += 1; b.PJ += 1;
    a.GF += ga; a.GC += gb;
    b.GF += gb; b.GC += ga;
    a.DG = a.GF - a.GC;
    b.DG = b.GF - b.GC;

    // puntos: 2 ganar / 1 perder
    if (ga > gb) {
      a.PG += 1; b.PP += 1;
      a.P += 2; b.P += 1;
    } else if (gb > ga) {
      b.PG += 1; a.PP += 1;
      b.P += 2; a.P += 1;
    } else {
      // empate: no asignamos puntos
      console.warn('Empate (games iguales). No se asignan puntos.', m);
    }
  }

  return Object.values(map);
}

function ordenarAutomatico(rows) {
  return [...rows].sort((a, b) => {
    if (b.P !== a.P) return b.P - a.P;
    if (b.DG !== a.DG) return b.DG - a.DG;
    return b.GF - a.GF;
  });
}

function ordenarConOverrides(rows, ovMap) {
  const auto = ordenarAutomatico(rows);

  const keys = Object.keys(ovMap || {});
  if (!keys.length) return auto;

  const withOv = [];
  const withoutOv = [];

  for (const r of auto) {
    const om = ovMap[r.pareja_id];
    if (om !== undefined) withOv.push({ ...r, _om: om });
    else withoutOv.push(r);
  }

  withOv.sort((a, b) => a._om - b._om);

  return [...withOv.map(x => {
    const { _om, ...rest } = x;
    return rest;
  }), ...withoutOv];
}

/* =========================
   RENDER (sin refetch al mover)
========================= */

function renderGrupoError(grupo, msg) {
  const card = el('div', { class: 'admin-grupo' });
  card.appendChild(el('h3', {}, `Grupo ${grupo.nombre}`));
  card.appendChild(el('p', {}, msg));
  contGrupos.appendChild(card);
}

function renderOrUpdateGrupoCard(groupId) {
  const g = state.groups[groupId];
  if (!g) return;

  let card = contGrupos.querySelector(`.admin-grupo[data-grupo-id="${groupId}"]`);
  const firstRender = !card;

  if (firstRender) {
    card = el('div', { class: 'admin-grupo', 'data-grupo-id': groupId });
    card.innerHTML = `
      <div class="admin-grupo-header">
        <h3 style="margin:0;"></h3>
        <div class="admin-grupo-meta" style="font-size:14px;"></div>
      </div>

      <div class="admin-grupo-warn"></div>

      <table class="tabla-posiciones" style="width:100%; margin-top:10px;">
        <thead>
          <tr>
            <th>#</th>
            <th>Pareja</th>
            <th title="Partidos jugados">PJ</th>
            <th title="Partidos ganados">PG</th>
            <th title="Partidos perdidos">PP</th>
            <th title="Games a favor">GF</th>
            <th title="Games en contra">GC</th>
            <th title="Diferencia de games">DG</th>
            <th title="Puntos">P</th>
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
    contGrupos.appendChild(card);
  }

  // header
  card.querySelector('h3').textContent = `Grupo ${g.grupo.nombre}`;
  const { totalPartidos, jugados, faltan } = g.meta;
  card.querySelector('.admin-grupo-meta').innerHTML =
    `Partidos: <strong>${jugados}/${totalPartidos}</strong> ${faltan > 0 ? `<span>(faltan ${faltan})</span>` : '✅'}`;

  // warn + unlock
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

  // table body
  updateTablaBody(groupId);

  // actions
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
    };

    btnReset.onclick = async () => {
      btnReset.disabled = true;
      const prev = btnReset.textContent;
      btnReset.textContent = 'Reseteando…';
      await resetOrdenGrupo(groupId);
      btnReset.textContent = prev;
      btnReset.disabled = false;

      // recargar solo este grupo desde DB (para volver al automático)
      await cargarGrupoCierre(state.groups[groupId].grupo);
      // cargarGrupoCierre ya rerenderiza
    };
  }
}

function updateTablaBody(groupId) {
  const g = state.groups[groupId];
  const card = contGrupos.querySelector(`.admin-grupo[data-grupo-id="${groupId}"]`);
  if (!g || !card) return;

  const tbody = card.querySelector('tbody');
  tbody.innerHTML = '';

  const editable = isEditable(groupId);

  g.rows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${r.nombre}</td>
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

  // IMPORTANTE: no refetch, no limpiar pantalla
  updateTablaBody(groupId);
}

/* =========================
   PERSISTENCIA OVERRIDES
========================= */

async function guardarOrdenGrupo(groupId) {
  const g = state.groups[groupId];
  if (!g) return;

  const payload = g.rows.map((r, i) => ({
    torneo_id: TORNEO_ID,
    grupo_id: groupId,
    pareja_id: r.pareja_id,
    orden_manual: i + 1
  }));

  const { error } = await supabase
    .from('posiciones_manual')
    .upsert(payload, { onConflict: 'torneo_id,grupo_id,pareja_id' });

  if (error) {
    console.error(error);
    logMsg('❌ Error guardando orden manual');
    return;
  }

  logMsg(`✅ Orden manual guardado para grupo ${g.grupo.nombre}`);
}

async function resetOrdenGrupo(groupId) {
  const g = state.groups[groupId];
  if (!g) return;

  const { error } = await supabase
    .from('posiciones_manual')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', groupId);

  if (error) {
    console.error(error);
    logMsg('❌ Error reseteando orden manual');
    return;
  }

  logMsg(`🧽 Orden manual reseteado para grupo ${g.grupo.nombre}`);
}

/* init */
cargarCierreGrupos();
