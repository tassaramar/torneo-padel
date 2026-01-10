import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

console.log('ESTE ES EL MAIN DE VITE');

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const app = document.getElementById('app');

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
      <strong>${p.pareja_a.nombre}</strong> vs <strong>${p.pareja_b.nombre}</strong><br>
      Grupo ${p.grupos.nombre}
      <div class="form" style="margin-top:8px; display:none;">
        <input type="number" min="0" placeholder="A" style="width:50px" />
        -
        <input type="number" min="0" placeholder="B" style="width:50px" />
        <button>Guardar</button>
      </div>
    `;

    const form = div.querySelector('.form');
    const [inputA, inputB] = form.querySelectorAll('input');
    const btn = form.querySelector('button');

    // tap / click para editar
    div.addEventListener('click', () => {
      form.style.display = 'block';
    });

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();

      const gamesA = Number(inputA.value);
      const gamesB = Number(inputB.value);

      if (Number.isNaN(gamesA) || Number.isNaN(gamesB)) {
        alert('Completá ambos resultados');
        return;
      }

      await guardarResultado(p.id, gamesA, gamesB);
    });

    app.appendChild(div);
  });
}
async function guardarResultado(partidoId, gamesA, gamesB) {
  const { error } = await supabase
    .from('partidos')
    .update({
      games_a: gamesA,
      games_b: gamesB
    })
    .eq('id', partidoId);

  if (error) {
    alert('Error guardando el resultado');
    console.error(error);
    return;
  }

  // refresca lista: el partido ya no es pendiente
  cargarPartidosPendientes();
}


cargarPartidosPendientes();
