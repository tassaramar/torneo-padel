import { state } from './state.js';
import { crearCardEditable } from './cardEditable.js';

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

export async function cargarPartidosGrupos({ supabase, torneoId, msgCont, listCont, onAfterSave }) {
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
    .eq('torneo_id', torneoId)
    .is('copa_id', null);

  if (state.modo === 'pendientes') {
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
  renderPartidosGrupos({ partidos: data || [], supabase, onAfterSave, listCont });
}

function renderPartidosGrupos({ partidos, supabase, onAfterSave, listCont }) {
  listCont.innerHTML = '';

  if (partidos.length === 0) {
    listCont.innerHTML =
      state.modo === 'pendientes'
        ? '<p>No hay partidos pendientes 🎉</p>'
        : '<p>No hay partidos jugados todavía.</p>';
    return;
  }

  partidos.forEach((p, idx) => {
    const grupo = p.grupos?.nombre ?? '-';
    const a = p.pareja_a?.nombre ?? 'Pareja A';
    const b = p.pareja_b?.nombre ?? 'Pareja B';

    const card = crearCardEditable({
      headerLeft: `Grupo <strong>${grupo}</strong>`,
      headerRight: (p.games_a !== null && p.games_b !== null) ? 'Jugado' : 'Pendiente',
      nombreA: a,
      nombreB: b,
      gamesA: p.games_a,
      gamesB: p.games_b,
      onSave: async (ga, gb) => {
        const ok = await guardarResultado(supabase, p.id, ga, gb);
        if (ok) await onAfterSave?.();
        return ok;
      }
    });

    // ✅ Zebra visible (no depende de CSS, no lo pisa el border inline)
    const even = idx % 2 === 0;
    card.style.borderLeft = even
      ? '10px solid rgba(0, 255, 204, 0.25)'
      : '10px solid rgba(0, 255, 204, 0.55)';

    listCont.appendChild(card);
  });
}
