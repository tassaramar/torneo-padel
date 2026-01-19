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

function aplicarZebraVisible(listCont) {
  const visibles = Array.from(listCont.querySelectorAll('.partido'))
    .filter(c => c.style.display !== 'none');

  visibles.forEach((c, i) => {
    c.classList.toggle('is-even', i % 2 === 0);
    c.classList.toggle('is-odd', i % 2 === 1);
  });
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

/**
 * Ordena partidos para maximizar paralelismo.
 * Agrupa en "rondas" donde ninguna pareja se repite.
 * Intenta balancear entre grupos para mejor distribución.
 */
function ordenarParaParalelismo(partidos) {
  const result = [];
  const remaining = [...partidos];
  
  // Separar por grupos para mejor distribución
  const porGrupo = {};
  remaining.forEach(p => {
    const grupo = p.grupos?.nombre ?? 'Sin Grupo';
    if (!porGrupo[grupo]) porGrupo[grupo] = [];
    porGrupo[grupo].push(p);
  });
  
  const grupos = Object.keys(porGrupo).sort();
  
  while (remaining.length > 0) {
    const ronda = [];
    const parejasEnUso = new Set();
    
    // Intentar tomar un partido de cada grupo (round-robin entre grupos)
    for (const grupo of grupos) {
      const partidosGrupo = porGrupo[grupo];
      if (!partidosGrupo || partidosGrupo.length === 0) continue;
      
      // Buscar primer partido del grupo que no tenga conflictos
      for (let i = 0; i < partidosGrupo.length; i++) {
        const p = partidosGrupo[i];
        const parejaANombre = p.pareja_a?.nombre;
        const parejaBNombre = p.pareja_b?.nombre;
        
        if (!parejasEnUso.has(parejaANombre) && !parejasEnUso.has(parejaBNombre)) {
          ronda.push(p);
          parejasEnUso.add(parejaANombre);
          parejasEnUso.add(parejaBNombre);
          partidosGrupo.splice(i, 1);
          const idx = remaining.indexOf(p);
          if (idx >= 0) remaining.splice(idx, 1);
          break;
        }
      }
    }
    
    // Si no se pudo armar ronda completa (ej: quedan pocos partidos), tomar lo que se pueda
    if (ronda.length === 0 && remaining.length > 0) {
      const p = remaining.shift();
      ronda.push(p);
      const grupo = p.grupos?.nombre ?? 'Sin Grupo';
      const idx = porGrupo[grupo]?.indexOf(p);
      if (idx >= 0) porGrupo[grupo].splice(idx, 1);
    }
    
    result.push(...ronda);
  }
  
  return result;
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

  // Ordenar para maximizar paralelismo
  const partidosOrdenados = state.modo === 'pendientes' 
    ? ordenarParaParalelismo(partidos)
    : partidos;

  partidosOrdenados.forEach((p) => {
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

    // Extra: ayuda al filtro (fallback), sin depender del DOM
    card.dataset.search = `${grupo} ${a} ${b}`;

    listCont.appendChild(card);
  });

  // zebra inicial (sin filtro)
  aplicarZebraVisible(listCont);
}
