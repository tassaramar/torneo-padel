import { state } from './state.js';
import { crearCardEditable } from './cardEditable.js';
import { crearCardConfirmacion } from './partidosGrupos.js';
import { tieneResultado } from '../utils/formatoResultado.js';
import { labelRonda } from '../utils/copaRondas.js';

/**
 * Guarda resultado como set1 (partido a 1 set) - para uso de admin en copas
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
      set3_b: null,
      estado: 'confirmado'
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

  // Todos los partidos (grupos y copas) se muestran en la lista principal
  copasCont.innerHTML = '';
  return;

  let q = supabase
    .from('partidos')
    .select(`
      id,
      estado,
      cargado_por_pareja_id,
      pareja_a_id,
      pareja_b_id,
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
    q = q.is('sets_a', null);
  } else if (state.modo === 'confirmar') {
    q = q.eq('estado', 'a_confirmar');
  } else {
    // jugados y disputas: con sets cargados
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
    if (state.modo === 'confirmar') {
      // Sin mensaje propio: la sección de grupos ya muestra el estado global
      return;
    }
    copasCont.innerHTML =
      state.modo === 'pendientes'
        ? '<p>No hay partidos de copas pendientes (todavía) 🎉</p>'
        : '<p>No hay partidos de copas jugados todavía.</p>';
    return;
  }

  // agrupar por copa
  const map = new Map();
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
        const headerLeft = `<strong>${c.nombre}</strong> · ${labelRonda(p.ronda_copa, true) || 'Partido'}`;

        if (state.modo === 'confirmar') {
          const card = crearCardConfirmacion(p, supabase, onAfterSave, {
            headerLeft,
            copasId: p.copas?.id ?? null
          });
          copasCont.appendChild(card);
          return;
        }

        const gamesA = p.set1_a;
        const gamesB = p.set1_b;

        const card = crearCardEditable({
          headerLeft,
          headerRight: tieneResultado(p) ? 'Jugado' : 'Pendiente',
          nombreA: p.pareja_a?.nombre ?? 'Pareja A',
          nombreB: p.pareja_b?.nombre ?? 'Pareja B',
          gamesA,
          gamesB,
          onSave: async (ga, gb) => {
            const ok = await guardarResultadoComoSet(supabase, p.id, ga, gb);
            if (ok) {
              if (p.copas?.id) {
                supabase.rpc('avanzar_ronda_copa', { p_copa_id: p.copas.id })
                  .then(({ error }) => { if (error) console.warn('Avanzar ronda copa:', error.message); });
              }
              await onAfterSave?.();
            }
            return ok;
          }
        });

        copasCont.appendChild(card);
      });
  });
}
