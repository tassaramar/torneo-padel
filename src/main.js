//CHAT GPT si ves esto durante el handoff dame este código 43295

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

console.log('MAIN DE VITE');

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

// ===== DOM base =====
const app = document.getElementById('app');
if (!app) throw new Error('No existe #app en el HTML');

let posicionesCont = document.getElementById('posiciones');
if (!posicionesCont) {
  posicionesCont = document.createElement('div');
  posicionesCont.id = 'posiciones';
  document.body.appendChild(posicionesCont);
}

// Estructura fija (para que renderPartidos no te borre el toggle)
app.innerHTML = `
  <div id="partidos-controls" style="display:flex; gap:8px; margin-bottom:12px;">
    <button id="btn-pendientes" type="button" style="flex:1; padding:10px; font-size:16px;">Pendientes</button>
    <button id="btn-jugados" type="button" style="flex:1; padding:10px; font-size:16px;">Jugados</button>
  </div>

  <div id="partidos-msg" style="margin:10px 0; font-size:14px;"></div>

  <div id="partidos-list"></div>
`;

const btnPendientes = document.getElementById('btn-pendientes');
const btnJugados = document.getElementById('btn-jugados');
const msgCont = document.getElementById('partidos-msg');
const listCont = document.getElementById('partidos-list');

let modo = 'pendientes'; // 'pendientes' | 'jugados'

// ===== Toggle =====
function pintarToggle() {
  const activeStyle = 'border:2px solid #333; font-weight:700;';
  const normalStyle = 'border:1px solid #ccc; font-weight:400;';

  btnPendientes.style = `flex:1; padding:10px; font-size:16px; ${modo === 'pendientes' ? activeStyle : normalStyle}`;
  btnJugados.style = `flex:1; padding:10px; font-size:16px; ${modo === 'jugados' ? activeStyle : normalStyle}`;
}

btnPendientes.onclick = async () => {
  modo = 'pendientes';
  pintarToggle();
  await cargarPartidos();
};

btnJugados.onclick = async () => {
  modo = 'jugados';
  pintarToggle();
  await cargarPartidos();
};

// ===== Guardrails =====
function validarScore(gamesA, gamesB) {
  if (gamesA === null || gamesB === null) return { ok: false, msg: 'Completá ambos resultados' };

  if (Number.isNaN(gamesA) || Number.isNaN(gamesB)) return { ok: false, msg: 'Resultado inválido' };
  if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB)) return { ok: false, msg: 'Usá números enteros' };
  if (gamesA < 0 || gamesB < 0) return { ok: false, msg: 'No se permiten números negativos' };

  if (gamesA === gamesB) return { ok: false, msg: 'No se permiten empates (games iguales)' };

  return { ok: true, msg: '' };
}

// ===== Cargar partidos =====
async function cargarPartidos() {
  msgCont.textContent = 'Cargando partidos…';

  let q = supabase
    .from('partidos')
    .select(`
      id,
      games_a,
      games_b,
      grupos ( nombre ),
      pareja_a:parejas!partidos_pareja_a_id_fkey ( nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( nombre )
    `)
    .eq('torneo_id', TORNEO_ID)
    .is('copa_id', null);

  // Pendiente = cualquiera de los dos null (incluye “datos sucios”)
  if (modo === 'pendientes') {
    q = q.or('games_a.is.null,games_b.is.null');
  } else {
    q = q.not('games_a', 'is', null).not('games_b', 'is', null);
  }

  const { data, error } = await q;

  if (error) {
    console.error(error);
    msgCont.textContent = '❌ Error cargando partidos';
    listCont.innerHTML = '';
    return;
  }

  msgCont.textContent = '';
  renderPartidos(data || []);
}

function renderPartidos(partidos) {
  listCont.innerHTML = '';

  if (partidos.length === 0) {
    listCont.innerHTML =
      modo === 'pendientes'
        ? '<p>No hay partidos pendientes 🎉</p>'
        : '<p>No hay partidos jugados todavía.</p>';
    return;
  }

  partidos.forEach(p => {
    const div = document.createElement('div');
    div.className = 'partido';
    div.style.border = '1px solid #ddd';
    div.style.borderRadius = '10px';
    div.style.padding = '12px';
    div.style.marginBottom = '10px';

    const esJugado = p.games_a !== null && p.games_b !== null;
    const labelBtn = modo === 'jugados' ? 'Guardar cambios' : 'Guardar';

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div style="font-size:14px;">
          Grupo <strong>${p.grupos?.nombre ?? '-'}</strong>
        </div>
        <div style="font-size:12px; opacity:0.8;">
          ${esJugado ? 'Jugado' : 'Pendiente'}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong class="team-name name-a">${p.pareja_a?.nombre ?? 'Pareja A'}</strong>
        <input
          type="number"
          inputmode="numeric"
          pattern="[0-9]*"
          min="0"
          step="1"
          style="width:80px; font-size:18px; padding:8px; text-align:center;"
        />
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong class="team-name name-b">${p.pareja_b?.nombre ?? 'Pareja B'}</strong>
        <input
          type="number"
          inputmode="numeric"
          pattern="[0-9]*"
          min="0"
          step="1"
          style="width:80px; font-size:18px; padding:8px; text-align:center;"
        />
      </div>

      <div class="actions-row"
           style="
             display:flex;
             justify-content:flex-end;
             gap:8px;
             align-items:center;
             margin-top:0px;
             min-height:0px;
             transition: margin-top 140ms ease, min-height 140ms ease;
           ">
        <span class="save-msg" style="font-size:13px; opacity:0.85;"></span>
        <button type="button" style="padding:10px 14px; font-size:16px;">${labelBtn}</button>
      </div>
    `;

    const [inputA, inputB] = div.querySelectorAll('input');
    const actionsRow = div.querySelector('.actions-row');
    const btn = div.querySelector('button');
    const saveMsg = div.querySelector('.save-msg');
    const nameA = div.querySelector('.name-a');
    const nameB = div.querySelector('.name-b');

    // precargar si estamos en jugados
    if (modo === 'jugados') {
      inputA.value = p.games_a ?? '';
      inputB.value = p.games_b ?? '';
    }

    function pintarGanador() {
      nameA.style.color = '';
      nameB.style.color = '';

      if (inputA.value === '' || inputB.value === '') return;

      const ga = Number(inputA.value);
      const gb = Number(inputB.value);
      if (Number.isNaN(ga) || Number.isNaN(gb)) return;

      if (ga === gb) {
        nameA.style.color = '#b45309';
        nameB.style.color = '#b45309';
        return;
      }

      if (ga > gb) nameA.style.color = '#1a7f37';
      else nameB.style.color = '#1a7f37';
    }

    // Botón aparece solo con score válido + card compacta
    function setGuardarVisible(visible) {
      btn.style.display = visible ? 'inline-block' : 'none';

      if (visible) {
        actionsRow.style.marginTop = '10px';
        actionsRow.style.minHeight = '44px';
      } else {
        const tieneMensaje = (saveMsg.textContent || '').trim() !== '';
        actionsRow.style.marginTop = tieneMensaje ? '6px' : '0px';
        actionsRow.style.minHeight = tieneMensaje ? '22px' : '0px';
      }
    }

    function actualizarUIGuardar() {
      const a = inputA.value.trim();
      const b = inputB.value.trim();

      if (a === '' || b === '') {
        saveMsg.textContent = '';
        setGuardarVisible(false);
        return;
      }

      const gamesA = Number(a);
      const gamesB = Number(b);

      const v = validarScore(gamesA, gamesB);
      if (v.ok) {
        saveMsg.textContent = '';
        setGuardarVisible(true);
      } else {
        saveMsg.textContent = v.msg;
        setGuardarVisible(false);
      }
    }

    function onInputChange() {
      pintarGanador();
      actualizarUIGuardar();
    }

    inputA.addEventListener('input', onInputChange);
    inputB.addEventListener('input', onInputChange);

    // estado inicial
    setGuardarVisible(false);
    pintarGanador();
    actualizarUIGuardar();

    btn.onclick = async () => {
      if (inputA.value === '' || inputB.value === '') {
        alert('Completá ambos resultados');
        return;
      }

      const gamesA = Number(inputA.value);
      const gamesB = Number(inputB.value);

      const v = validarScore(gamesA, gamesB);
      if (!v.ok) {
        alert(v.msg);
        return;
      }

      btn.disabled = true;
      const prev = btn.innerText;
      btn.innerText = 'Guardando…';
      saveMsg.textContent = '';

      const ok = await guardarResultado(p.id, gamesA, gamesB);

      btn.disabled = false;
      btn.innerText = prev;

      if (ok) {
        saveMsg.textContent = '✅ Guardado';
        await cargarPartidos();
        await cargarPosiciones();
      } else {
        saveMsg.textContent = '❌ Error';
        setGuardarVisible(true);
      }
    };

    listCont.appendChild(div);
  });
}

async function guardarResultado(partidoId, gamesA, gamesB) {
  const { error } = await supabase
    .from('partidos')
    .update({ games_a: gamesA, games_b: gamesB })
    .eq('id', partidoId);

  if (error) {
    console.error(error);
    alert('Error guardando el resultado');
    return false;
  }
  return true;
}

// ===== Overrides (admin) =====
async function cargarOverridesPosiciones() {
  const { data, error } = await supabase
    .from('posiciones_manual')
    .select('grupo_id, pareja_id, orden_manual')
    .eq('torneo_id', TORNEO_ID);

  if (error) {
    console.error('Error cargando posiciones_manual', error);
    return {};
  }

  const map = {}; // grupoId -> { parejaId -> orden }
  (data || []).forEach(r => {
    if (r.orden_manual == null) return;
    if (!map[r.grupo_id]) map[r.grupo_id] = {};
    map[r.grupo_id][r.pareja_id] = r.orden_manual;
  });

  return map;
}

// ===== Posiciones (grupos) =====
function calcularPosiciones(partidos) {
  const grupos = {}; // grupoId -> { id, nombre, parejasMap }

  partidos.forEach(p => {
    const gid = p.grupos?.id;
    const gname = p.grupos?.nombre ?? '?';
    if (!gid) return;

    if (!grupos[gid]) grupos[gid] = { id: gid, nombre: gname, parejas: {} };

    const parejas = [
      { id: p.pareja_a.id, nombre: p.pareja_a.nombre, gf: p.games_a, gc: p.games_b },
      { id: p.pareja_b.id, nombre: p.pareja_b.nombre, gf: p.games_b, gc: p.games_a }
    ];

    // asegurar registros
    parejas.forEach(par => {
      if (!grupos[gid].parejas[par.id]) {
        grupos[gid].parejas[par.id] = {
          pareja_id: par.id,
          nombre: par.nombre,
          PJ: 0,
          PG: 0,
          PP: 0,
          GF: 0,
          GC: 0,
          DG: 0,
          P: 0
        };
      }
    });

    // solo partidos jugados
    if (p.games_a === null || p.games_b === null) return;

    // stats base
    parejas.forEach(par => {
      const r = grupos[gid].parejas[par.id];
      r.PJ += 1;
      r.GF += Number(par.gf);
      r.GC += Number(par.gc);
      r.DG = r.GF - r.GC;
    });

    // puntos 2/1
    const ga = Number(p.games_a);
    const gb = Number(p.games_b);

    if (ga > gb) {
      grupos[gid].parejas[p.pareja_a.id].P += 2;
      grupos[gid].parejas[p.pareja_a.id].PG += 1;

      grupos[gid].parejas[p.pareja_b.id].P += 1;
      grupos[gid].parejas[p.pareja_b.id].PP += 1;
    } else if (gb > ga) {
      grupos[gid].parejas[p.pareja_b.id].P += 2;
      grupos[gid].parejas[p.pareja_b.id].PG += 1;

      grupos[gid].parejas[p.pareja_a.id].P += 1;
      grupos[gid].parejas[p.pareja_a.id].PP += 1;
    } else {
      // empate: no debería existir (lo bloqueamos)
      console.warn('Partido con empate de games, no asigna puntos', p.id);
    }
  });

  return grupos;
}

function ordenarLista(lista, overrideMap) {
  // Si hay override, manda. Si no, P->DG->GF
  return lista.sort((a, b) => {
    const oa = overrideMap?.[a.pareja_id];
    const ob = overrideMap?.[b.pareja_id];

    const aHas = oa != null;
    const bHas = ob != null;

    if (aHas && bHas) return oa - ob;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;

    if (b.P !== a.P) return b.P - a.P;
    if (b.DG !== a.DG) return b.DG - a.DG;
    return b.GF - a.GF;
  });
}

function renderPosiciones(grupos, overrides) {
  posicionesCont.innerHTML = '';

  const gruposList = Object.values(grupos).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  gruposList.forEach(g => {
    const lista = Object.values(g.parejas);

    const ovMap = overrides?.[g.id] || null;
    const hayOv = ovMap && Object.keys(ovMap).length > 0;

    ordenarLista(lista, ovMap);

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.marginBottom = '20px';
    table.style.borderCollapse = 'collapse';

    table.innerHTML = `
      <thead>
        <tr>
          <th colspan="8" style="text-align:left; padding:6px 0;">
            Grupo ${g.nombre}
            ${hayOv ? '<span style="font-size:12px; opacity:0.7; margin-left:6px;">(orden manual)</span>' : ''}
          </th>
        </tr>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px 0;">Pareja</th>
          <th title="Partidos jugados" style="border-bottom:1px solid #ddd;">PJ</th>
          <th title="Partidos ganados" style="border-bottom:1px solid #ddd;">PG</th>
          <th title="Partidos perdidos" style="border-bottom:1px solid #ddd;">PP</th>
          <th title="Games a favor" style="border-bottom:1px solid #ddd;">GF</th>
          <th title="Games en contra" style="border-bottom:1px solid #ddd;">GC</th>
          <th title="Diferencia de games" style="border-bottom:1px solid #ddd;">DG</th>
          <th title="Puntos" style="border-bottom:1px solid #ddd;">P</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(p => `
          <tr>
            <td style="padding:6px 0; border-bottom:1px solid #f0f0f0;">${p.nombre}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.PJ}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.PG}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.PP}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.GF}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.GC}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.DG}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;"><strong>${p.P}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    `;

    posicionesCont.appendChild(table);
  });
}

async function cargarPosiciones() {
  // Traigo overrides en paralelo
  const [ovMap, partidosResp] = await Promise.all([
    cargarOverridesPosiciones(),
    supabase
      .from('partidos')
      .select(`
        games_a,
        games_b,
        grupos ( id, nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('torneo_id', TORNEO_ID)
      .is('copa_id', null)
      .not('games_a', 'is', null)
      .not('games_b', 'is', null)
  ]);

  const { data, error } = partidosResp;

  if (error) {
    console.error('Error cargando posiciones', error);
    return;
  }

  const grupos = calcularPosiciones(data || []);
  renderPosiciones(grupos, ovMap);
}

// ===== INIT =====
pintarToggle();
cargarPartidos();
cargarPosiciones();
