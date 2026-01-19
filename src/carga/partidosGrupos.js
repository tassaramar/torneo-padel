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
 * Ordena partidos para maximizar paralelismo dentro de cada grupo.
 * Agrupa en "rondas" donde ninguna pareja se repite.
 * Retorna array de rondas con estructura:
 * [
 *   { grupo: 'A', partidos: [...], parejasLibres: [...] },
 *   { grupo: 'A', partidos: [...], parejasLibres: [...] },
 *   ...
 * ]
 */
export function agruparEnRondas(partidos) {
  const rondas = [];
  
  // Separar partidos por grupo
  const porGrupo = {};
  partidos.forEach(p => {
    const grupo = p.grupos?.nombre ?? 'Sin Grupo';
    if (!porGrupo[grupo]) porGrupo[grupo] = [];
    porGrupo[grupo].push(p);
  });
  
  // Procesar cada grupo independientemente
  Object.keys(porGrupo).sort().forEach(nombreGrupo => {
    const partidosGrupo = [...porGrupo[nombreGrupo]];
    
    // Obtener todas las parejas del grupo
    const todasLasParejas = new Set();
    partidosGrupo.forEach(p => {
      if (p.pareja_a?.nombre) todasLasParejas.add(p.pareja_a.nombre);
      if (p.pareja_b?.nombre) todasLasParejas.add(p.pareja_b.nombre);
    });
    
    // Agrupar partidos en rondas (greedy algorithm)
    while (partidosGrupo.length > 0) {
      const ronda = [];
      const parejasEnUso = new Set();
      
      // Buscar todos los partidos que no tienen conflictos entre sí
      for (let i = partidosGrupo.length - 1; i >= 0; i--) {
        const p = partidosGrupo[i];
        const parejaA = p.pareja_a?.nombre;
        const parejaB = p.pareja_b?.nombre;
        
        if (!parejasEnUso.has(parejaA) && !parejasEnUso.has(parejaB)) {
          ronda.unshift(p); // Agregar al inicio para mantener orden
          parejasEnUso.add(parejaA);
          parejasEnUso.add(parejaB);
          partidosGrupo.splice(i, 1);
        }
      }
      
      // Calcular parejas libres (no juegan en esta ronda)
      const parejasLibres = Array.from(todasLasParejas)
        .filter(p => !parejasEnUso.has(p))
        .sort();
      
      if (ronda.length > 0) {
        rondas.push({
          grupo: nombreGrupo,
          partidos: ronda,
          parejasLibres: parejasLibres
        });
      }
    }
  });
  
  return rondas;
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

  // Agrupar en rondas si es modo pendientes
  if (state.modo === 'pendientes') {
    const rondas = agruparEnRondas(partidos);
    
    let rondaCounter = 0;
    rondas.forEach((rondaData) => {
      rondaCounter++;
      
      // Separador de ronda
      const separator = document.createElement('div');
      separator.style.cssText = 'margin: 24px 0 8px; padding: 8px 12px; background: var(--primary-soft); border-left: 4px solid var(--primary); border-radius: 8px; font-weight: 700; font-size: 14px; color: var(--text);';
      
      let headerText = `Ronda ${rondaCounter} — Grupo ${rondaData.grupo} — ${rondaData.partidos.length} partido${rondaData.partidos.length > 1 ? 's' : ''} en paralelo`;
      separator.textContent = headerText;
      listCont.appendChild(separator);
      
      // Partidos de la ronda
      rondaData.partidos.forEach((p) => {
        const card = crearCardParaPartido(p, supabase, onAfterSave);
        listCont.appendChild(card);
      });
      
      // Parejas libres (fecha libre)
      if (rondaData.parejasLibres.length > 0) {
        rondaData.parejasLibres.forEach(parejaLibre => {
          const cardLibre = document.createElement('div');
          cardLibre.className = 'partido fecha-libre';
          cardLibre.style.cssText = 'padding: 12px; margin: 8px 0; background: var(--bg-soft); border: 1px dashed var(--border); border-radius: 8px; opacity: 0.7;';
          cardLibre.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-weight: 600;">${parejaLibre}</div>
              <div style="color: var(--muted); font-style: italic;">Fecha libre</div>
            </div>
          `;
          listCont.appendChild(cardLibre);
        });
      }
    });
  } else {
    // Modo jugados: orden normal
    partidos.forEach((p) => {
      const card = crearCardParaPartido(p, supabase, onAfterSave);
      listCont.appendChild(card);
    });
  }

  // zebra inicial (sin filtro)
  aplicarZebraVisible(listCont);
}

function crearCardParaPartido(p, supabase, onAfterSave) {
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
  
  return card;
}
