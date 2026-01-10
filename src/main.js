import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

console.log('MAIN DE VITE');

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const app = document.getElementById('app');
const posicionesDiv = document.getElementById('posiciones');

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

function renderPartidos(partidos) {
  app.innerHTML = '';

  if (partidos.length === 0) {
    app.innerHTML = '<p>No hay partidos pendientes 🎉</p>';
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

    app.appendChild(div);
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
}

/* =========================
   POSICIONES
========================= */

function calcularPosiciones(partidos) {
  const grupos = {};

  partidos.forEach(p => {
    const grupo = p.grupos.nombre;
    grupos[grupo] ||= {};

    const pares = [
      { id: p.pareja_a.id, nombre: p.pareja_a.nombre, gf: p.games_a, gc: p.games_b },
      { id: p.pareja_b.id, nombre: p.pareja_b.nombre, gf: p.games_b, gc: p.games_a }
    ];

    pares.forEach(par => {
      grupos[grupo][par.id] ||= {
        nombre: par.nombre,
        PJ: 0,
        P: 0,
        GF: 0,
        GC: 0,
        DG: 0
      };

      const r = grupos[grupo][par.id];
      r.PJ++;
      r.GF += par.gf;
      r.GC += par.gc;
      r.DG = r.GF - r.GC;
    });

    // puntos: 2 ganar, 1 perder
    if (p.games_a > p.games_b) {
      grupos[grupo][p.pareja_a.id].P += 2;
      grupos[grupo][p.pareja_b.id].P += 1;
    } else {
      grupos[grupo][p.pareja_b.id].P += 2;
      grupos[grupo][p.pareja_a.id].P += 1;
    }
  });

  return grupos;
}

function renderPosiciones(grupos) {
  posicionesDiv.innerHTML = '';

  Object.entries(grupos).forEach(([grupo, parejas]) => {
    const lista = Object.values(parejas).sort((a, b) => {
      if (b.P !== a.P) return b.P - a.P;
      if (b.DG !== a.DG) return b.DG - a.DG;
      return b.GF - a.GF;
    });

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.marginBottom = '20px';

    table.innerHTML = `
      <thead>
        <tr><th colspan="6" style="text-align:left;">Grupo ${grupo}</th></tr>
        <tr>
          <th>Pareja</th><th>PJ</th><th>P</th><th>GF</th><th>GC</th><th>DG</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(p => `
          <tr>
            <td>${p.nombre}</td>
            <td>${p.PJ}</td>
            <td>${p.P}</td>
            <td>${p.GF}</td>
            <td>${p.GC}</td>
            <td>${p.DG}</td>
          </tr>
        `).join('')}
      </tbody>
    `;

    posicionesDiv.appendChild(table);
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
    .not('games_a', 'is', null);

  if (error) {
    console.error(error);
    return;
  }

  renderPosiciones(calcularPosiciones(data));
}

/* =========================
   INIT
========================= */

cargarPartidosPendientes();
cargarPosiciones();
