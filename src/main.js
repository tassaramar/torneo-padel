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
    .is('copa_id', null); // solo fase grupos (MVP miércoles)

  if (modo === 'pendientes') {
    q = q.is('games_a', null);
  } else {
    q = q.not('games_a', 'is', null);
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
        <strong>${p.pareja_a?.nombre ?? 'Pareja A'}</strong>
        <input
          type="number"
          inputmode="numeric"
          pattern="[0-9]*"
          min="0"
          style="width:80px; font-size:18px; padding:8px; text-align:center;"
        />
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>${p.pareja_b?.nombre ?? 'Pareja B'}</strong>
        <input
          type="number"
          inputmode="numeric"
          pattern="[0-9]*"
          min="0"
          style="width:80px; font-size:18px; padding:8px; text-align:center;"
        />
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; align-items:center; margin-top:10px;">
        <span class="save-msg" style="font-size:13px;"></span>
        <button type="button" style="padding:10px 14px; font-size:16px;">${labelBtn}</button>
      </div>
    `;

    const [inputA, inputB] = div.querySelectorAll('input');
    const btn = div.querySelector('button');
    const saveMsg = div.querySelector('.save-msg');

    // precargar si estamos en jugados
    if (modo === 'jugados') {
      inputA.value = p.games_a ?? '';
      inputB.value = p.games_b ?? '';
    }

    btn.onclick = async () => {
      // Validación mínima “decente”: no convertir vacío a 0 por accidente
      if (inputA.value === '' || inputB.value === '') {
        alert('Completá ambos resultados');
        return;
      }

      const gamesA = Number(inputA.value);
      const gamesB = Number(inputB.value);

      if (Number.isNaN(gamesA) || Number.isNaN(gamesB)) {
        alert('Resultado inválido');
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
        // refrescar lista (para que el pendiente desaparezca o el jugado quede actualizado)
        await cargarPartidos();
        // refrescar tabla posiciones
        await cargarPosiciones();
      } else {
        saveMsg.textContent = '❌ Error';
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

// ===== Posiciones (grupos) =====
function calcularPosiciones(partidos) {
  const grupos = {};

  partidos.forEach(p => {
    const grupoNombre = p.grupos?.nombre ?? '?';

    if (!grupos[grupoNombre]) grupos[grupoNombre] = {};

    const parejas = [
      { id: p.pareja_a.id, nombre: p.pareja_a.nombre, gf: p.games_a, gc: p.games_b, esA: true },
      { id: p.pareja_b.id, nombre: p.pareja_b.nombre, gf: p.games_b, gc: p.games_a, esA: false }
    ];

    // asegurar registros
    parejas.forEach(par => {
      if (!grupos[grupoNombre][par.id]) {
        grupos[grupoNombre][par.id] = {
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
      const r = grupos[grupoNombre][par.id];
      r.PJ += 1;
      r.GF += Number(par.gf);
      r.GC += Number(par.gc);
      r.DG = r.GF - r.GC;
    });

    // puntos 2/1
    const ga = Number(p.games_a);
    const gb = Number(p.games_b);

    if (ga > gb) {
      grupos[grupoNombre][p.pareja_a.id].P += 2;
      grupos[grupoNombre][p.pareja_a.id].PG += 1;

      grupos[grupoNombre][p.pareja_b.id].P += 1;
      grupos[grupoNombre][p.pareja_b.id].PP += 1;
    } else if (gb > ga) {
      grupos[grupoNombre][p.pareja_b.id].P += 2;
      grupos[grupoNombre][p.pareja_b.id].PG += 1;

      grupos[grupoNombre][p.pareja_a.id].P += 1;
      grupos[grupoNombre][p.pareja_a.id].PP += 1;
    } else {
      // empate: no asignamos puntos (lo dejamos así, validación vendrá después si querés)
      console.warn('Partido con empate de games, no asigna puntos', p.id);
    }
  });

  return grupos;
}

function renderPosiciones(grupos) {
  posicionesCont.innerHTML = '';

  Object.entries(grupos).forEach(([grupoNombre, parejasObj]) => {
    const lista = Object.values(parejasObj);

    lista.sort((a, b) => {
      if (b.P !== a.P) return b.P - a.P;
      if (b.DG !== a.DG) return b.DG - a.DG;
      return b.GF - a.GF;
    });

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.marginBottom = '20px';
    table.style.borderCollapse = 'collapse';

    table.innerHTML = `
      <thead>
        <tr>
          <th colspan="8" style="text-align:left; padding:6px 0;">Grupo ${grupoNombre}</th>
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
  const { data, error } = await supabase
    .from('partidos')
    .select(`
      games_a,
      games_b,
      grupos ( nombre ),
      pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
    `)
    .eq('torneo_id', TORNEO_ID)
    .is('copa_id', null)
    .not('games_a', 'is', null);

  if (error) {
    console.error('Error cargando posiciones', error);
    return;
  }

  const grupos = calcularPosiciones(data || []);
  renderPosiciones(grupos);
}

// ===== INIT =====
pintarToggle();
cargarPartidos();
cargarPosiciones();
