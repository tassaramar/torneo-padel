import '../style.css';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

console.log('MAIN DE VITE');

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const app = document.getElementById('app');
const posicionesDiv = document.getElementById('posiciones');
const copasDiv = document.getElementById('copas');

/* =========================
   PARTIDOS PENDIENTES
========================= */

async function cargarPartidosPendientes() {
  const { data, error } = await supabase
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
    .is('games_a', null);

  if (error) {
    app.innerHTML = `<p>Error cargando partidos</p>`;
    console.error(error);
    return;
  }

  renderPartidos(data);
}

function renderPartidos(partidos, container = app) {
  container.innerHTML = '';

  if (partidos.length === 0) {
    container.innerHTML = '<p>No hay partidos pendientes 🎉</p>';
    return;
  }

  partidos.forEach(p => {
    const div = document.createElement('div');
    div.className = 'partido pendiente';

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong>${p.pareja_a.nombre}</strong>
        <input type="number" inputmode="numeric" min="0" style="width:70px; font-size:18px;" />
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong>${p.pareja_b.nombre}</strong>
        <input type="number" inputmode="numeric" min="0" style="width:70px; font-size:18px;" />
      </div>

      <div style="font-size:14px; margin-bottom:8px;">
        Grupo ${p.grupos.nombre}
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button style="padding:8px 16px; font-size:16px;">Guardar</button>
      </div>
    `;

    const [inputA, inputB] = div.querySelectorAll('input');
    const btn = div.querySelector('button');

    btn.addEventListener('click', async () => {
      const gamesA = Number(inputA.value);
      const gamesB = Number(inputB.value);

      if (Number.isNaN(gamesA) || Number.isNaN(gamesB)) {
        alert('Completá ambos resultados');
        return;
      }

      btn.disabled = true;
      btn.innerText = 'Guardando…';

      await guardarResultado(p.id, gamesA, gamesB);
    });

    container.appendChild(div);
  });
}

async function guardarResultado(partidoId, gamesA, gamesB) {
  const { error } = await supabase
    .from('partidos')
    .update({ games_a: gamesA, games_b: gamesB })
    .eq('id', partidoId);

  if (error) {
    alert('Error guardando resultado');
    console.error(error);
    return;
  }

  await cargarPartidosPendientes();
  await cargarPosiciones();
  await renderCopas();
}

/* =========================
   POSICIONES
========================= */

function calcularPosiciones(partidos) {
  // groups[groupId] = { nombre, parejas: { parejaId: row } }
  const groups = {};

  for (const p of partidos) {
    const groupId = p.grupos.id;
    const groupNombre = p.grupos.nombre;

    if (!groups[groupId]) {
      groups[groupId] = { nombre: groupNombre, parejas: {} };
    }

    const ga = p.games_a;
    const gb = p.games_b;

    const pa = p.pareja_a;
    const pb = p.pareja_b;

    // init rows
    if (!groups[groupId].parejas[pa.id]) {
      groups[groupId].parejas[pa.id] = {
        pareja_id: pa.id,
        nombre: pa.nombre,
        PJ: 0, PG: 0, PP: 0,
        GF: 0, GC: 0, DG: 0,
        P: 0
      };
    }
    if (!groups[groupId].parejas[pb.id]) {
      groups[groupId].parejas[pb.id] = {
        pareja_id: pb.id,
        nombre: pb.nombre,
        PJ: 0, PG: 0, PP: 0,
        GF: 0, GC: 0, DG: 0,
        P: 0
      };
    }

    // si no está jugado, no suma stats (pero ya queda la membresía)
    const jugado = ga !== null && gb !== null;
    if (!jugado) continue;

    const rA = groups[groupId].parejas[pa.id];
    const rB = groups[groupId].parejas[pb.id];

    rA.PJ += 1; rB.PJ += 1;
    rA.GF += ga; rA.GC += gb;
    rB.GF += gb; rB.GC += ga;
    rA.DG = rA.GF - rA.GC;
    rB.DG = rB.GF - rB.GC;

    if (ga > gb) {
      rA.PG += 1; rB.PP += 1;
      rA.P += 2; rB.P += 1;
    } else if (gb > ga) {
      rB.PG += 1; rA.PP += 1;
      rB.P += 2; rA.P += 1;
    } else {
      // empate: no asignamos puntos
      console.warn('Empate (games iguales) en partido', p);
    }
  }

  return groups;
}

function ordenarLista(lista, ovMapGrupo) {
  const auto = [...lista].sort((a, b) => {
    if (b.P !== a.P) return b.P - a.P;
    if (b.DG !== a.DG) return b.DG - a.DG;
    return b.GF - a.GF;
  });

  if (!ovMapGrupo || Object.keys(ovMapGrupo).length === 0) return auto;

  const withOv = [];
  const withoutOv = [];

  for (const r of auto) {
    const om = ovMapGrupo[r.pareja_id];
    if (om !== undefined && om !== null) withOv.push({ ...r, _om: om });
    else withoutOv.push(r);
  }

  withOv.sort((a, b) => a._om - b._om);

  return [...withOv.map(x => {
    const { _om, ...rest } = x;
    return rest;
  }), ...withoutOv];
}

function renderPosiciones(groups, overrides) {
  const cont = document.getElementById('posiciones');
  cont.innerHTML = '';

  Object.entries(groups).forEach(([groupId, g]) => {
    const lista = Object.values(g.parejas);
    const listaOrdenada = ordenarLista(lista, overrides[groupId]);

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.marginBottom = '20px';

    table.innerHTML = `
      <thead>
        <tr>
          <th colspan="9" style="text-align:left;">Grupo ${g.nombre}</th>
        </tr>
        <tr>
          <th>Pareja</th>
          <th title="Partidos jugados">PJ</th>
          <th title="Partidos ganados">PG</th>
          <th title="Partidos perdidos">PP</th>
          <th title="Games a favor">GF</th>
          <th title="Games en contra">GC</th>
          <th title="Diferencia de games">DG</th>
          <th title="Puntos">P</th>
        </tr>
      </thead>
      <tbody>
        ${listaOrdenada.map(p => `
          <tr>
            <td>${p.nombre}</td>
            <td style="text-align:center;">${p.PJ}</td>
            <td style="text-align:center;">${p.PG}</td>
            <td style="text-align:center;">${p.PP}</td>
            <td style="text-align:center;">${p.GF}</td>
            <td style="text-align:center;">${p.GC}</td>
            <td style="text-align:center;">${p.DG}</td>
            <td style="text-align:center;"><strong>${p.P}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    `;

    cont.appendChild(table);
  });
}

async function cargarPosiciones() {
  const { data, error } = await supabase
    .from('partidos')
    .select(`
      games_a,
      games_b,
      copa_id,
      grupos ( id, nombre ),
      pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
    `)
    .eq('torneo_id', TORNEO_ID)
    .is('copa_id', null); // solo fase grupos, jugados o no

  if (error) {
    console.error('Error cargando posiciones', error);
    return;
  }

  const groups = calcularPosiciones(data || []);

  // Trae overrides
  const { data: ov, error: errOv } = await supabase
    .from('posiciones_manual')
    .select('grupo_id, pareja_id, orden_manual')
    .eq('torneo_id', TORNEO_ID);

  if (errOv) console.error(errOv);

  const overrides = {};
  (ov || []).forEach(x => {
    if (!overrides[x.grupo_id]) overrides[x.grupo_id] = {};
    if (x.orden_manual !== null) overrides[x.grupo_id][x.pareja_id] = x.orden_manual;
  });

  renderPosiciones(groups, overrides);
}
/* =========================
   COPAS
========================= */
async function cargarCopas() {
  const { data, error } = await supabase
    .from('copas')
    .select('id, nombre, orden')
    .eq('torneo_id', TORNEO_ID)
    .order('orden');

  if (error) {
    console.error('Error cargando copas', error);
    return [];
  }

  return data;
}
async function cargarPartidosCopa(copaId) {
  const { data, error } = await supabase
    .from('partidos')
    .select(`
      id,
      grupos ( nombre ),
      pareja_a:parejas!partidos_pareja_a_id_fkey ( nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( nombre )
    `)
    .eq('torneo_id', TORNEO_ID)
    .eq('copa_id', copaId)
    .is('games_a', null);

  if (error) {
    console.error('Error cargando partidos de copa', error);
    return [];
  }

  return data;
}
async function renderCopas() {
  copasDiv.innerHTML = '';
  const copas = await cargarCopas();

  for (let i = 0; i < copas.length; i++) {
    const copa = copas[i];
    const nombreMostrado = copa.nombre ?? `Copa ${i + 1}`;

    const h3 = document.createElement('h3');
    h3.innerText = `🏆 ${nombreMostrado}`;
    copasDiv.appendChild(h3);

    const partidos = await cargarPartidosCopa(copa.id);

    if (partidos.length === 0) {
      const p = document.createElement('p');
      p.innerText = 'No hay partidos pendientes';
      copasDiv.appendChild(p);
      continue;
    }

    const cont = document.createElement('div');
    copasDiv.appendChild(cont);

    renderPartidos(partidos, cont);
  }
}


/* =========================
   INIT
========================= */
cargarPartidosPendientes();
cargarPosiciones();
renderCopas();
