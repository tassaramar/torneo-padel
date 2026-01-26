import { state } from './state.js';
import { crearCardEditable } from './cardEditable.js';

function labelRonda(r) {
  if (!r) return '';
  if (r === 'SF') return 'Semi';
  if (r === 'F') return 'Final';
  if (r === '3P') return '3/4';
  return r;
}

async function guardarResultado(supabase, partidoId, gamesA, gamesB) {
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

export async function cargarCopas({ supabase, torneoId, copasCont, onAfterSave }) {
  if (!copasCont) return;

  copasCont.innerHTML = `<p style="opacity:0.8;">Cargando copas…</p>`;

  let q = supabase
    .from('partidos')
    .select(`
      id,
      games_a,
      games_b,
      ronda_copa,
      orden_copa,
      set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
      copas ( id, nombre, orden ),
      pareja_a:parejas!partidos_pareja_a_id_fkey ( nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( nombre )
    `)
    .eq('torneo_id', torneoId)
    .not('copa_id', 'is', null);

  if (state.modo === 'pendientes') {
    q = q.or('games_a.is.null,games_b.is.null');
  } else {
    q = q.not('games_a', 'is', null).not('games_b', 'is', null);
  }

  q = q.order('orden_copa', { ascending: true });

  const { data, error } = await q;

  if (error) {
    console.error(error);
    copasCont.innerHTML = `<p>❌ Error cargando partidos de copas</p>`;
    return;
  }

  renderCopas({ supabase, copasCont, partidos: data || [], onAfterSave });
}

function renderCopas({ supabase, copasCont, partidos, onAfterSave }) {
  copasCont.innerHTML = '';

  if (!partidos.length) {
    copasCont.innerHTML =
      state.modo === 'pendientes'
        ? '<p>No hay partidos de copas pendientes (todavía) 🎉</p>'
        : '<p>No hay partidos de copas jugados todavía.</p>';
    return;
  }

  // agrupar por copa
  const map = new Map(); // key -> { nombre, orden, partidos: [] }
  for (const p of partidos) {
    const nombre = p.copas?.nombre ?? 'Copa';
    const orden = p.copas?.orden ?? 99;
    const key = `${orden}|${nombre}`;
    if (!map.has(key)) map.set(key, { nombre, orden, partidos: [] });
    map.get(key).partidos.push(p);
  }

  const copasList = Array.from(map.values()).sort((a, b) => a.orden - b.orden);

  copasList.forEach(c => {
    const h = document.createElement('h3');
    h.textContent = c.nombre;
    h.style.margin = '14px 0 8px';
    copasCont.appendChild(h);

    c.partidos
      .sort((a, b) => (a.orden_copa ?? 999) - (b.orden_copa ?? 999))
      .forEach(p => {
        const header = `<strong>${c.nombre}</strong> · ${labelRonda(p.ronda_copa) || 'Partido'}`;

        const card = crearCardEditable({
          headerLeft: header,
          headerRight: (p.games_a !== null && p.games_b !== null) ? 'Jugado' : 'Pendiente',
          nombreA: p.pareja_a?.nombre ?? 'Pareja A',
          nombreB: p.pareja_b?.nombre ?? 'Pareja B',
          gamesA: p.games_a,
          gamesB: p.games_b,
          onSave: async (ga, gb) => {
            const ok = await guardarResultado(supabase, p.id, ga, gb);
            if (ok) {
              await onAfterSave?.();
            }
            return ok;
          }
        });

        copasCont.appendChild(card);
      });
  });
}
