import { state } from './state.js';
import { crearCardEditable } from './cardEditable.js';
import { tieneResultado } from '../utils/formatoResultado.js';

function labelRonda(r) {
  if (!r) return '';
  if (r === 'SF') return 'Semi';
  if (r === 'F') return 'Final';
  if (r === '3P') return '3/4';
  return r;
}

/**
 * Guarda resultado como set1 (partido a 1 set) - para uso de admin en copas
 * NOTA: NO escribir directamente a games_totales_* (son derivados calculados por trigger)
 */
async function guardarResultadoComoSet(supabase, partidoId, gamesA, gamesB) {
  const { error } = await supabase
    .from('partidos')
    .update({ 
      set1_a: gamesA, 
      set1_b: gamesB,
      num_sets: 1,
      set2_a: null,
      set2_b: null,
      set3_a: null,
      set3_b: null
    })
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
      ronda_copa,
      orden_copa,
      set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
      sets_a, sets_b,
      games_totales_a, games_totales_b,
      copas ( id, nombre, orden ),
      pareja_a:parejas!partidos_pareja_a_id_fkey ( nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( nombre )
    `)
    .eq('torneo_id', torneoId)
    .not('copa_id', 'is', null);

  if (state.modo === 'pendientes') {
    // Pendientes = sin sets cargados (sets_a es derivado, si es null no hay resultado)
    q = q.is('sets_a', null);
  } else {
    // Jugados = con sets cargados
    q = q.not('sets_a', 'is', null);
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

        // Para la card editable, mostrar el set1 (o null si no hay resultado)
        const gamesA = p.set1_a;
        const gamesB = p.set1_b;

        const card = crearCardEditable({
          headerLeft: header,
          headerRight: tieneResultado(p) ? 'Jugado' : 'Pendiente',
          nombreA: p.pareja_a?.nombre ?? 'Pareja A',
          nombreB: p.pareja_b?.nombre ?? 'Pareja B',
          gamesA: gamesA,
          gamesB: gamesB,
          onSave: async (ga, gb) => {
            const ok = await guardarResultadoComoSet(supabase, p.id, ga, gb);
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
