import { state } from './state.js';
import { crearCardEditable } from './cardEditable.js';
import { obtenerFraseFechaLibre } from '../utils/frasesFechaLibre.js';

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
 * Circle Method: Genera pairings óptimos para round-robin.
 * Algoritmo estándar de Berger para minimizar rondas y maximizar paralelismo.
 * @param {Array<string>} equipos - Lista de nombres de equipos
 * @returns {Array<Array<[string, string]>>} - Array de rondas, cada ronda con pairings
 */
function circleMethod(equipos) {
  let teams = [...equipos];
  const n = teams.length;
  
  // Si hay número impar de equipos, agregar dummy para hacer par
  if (n % 2 === 1) {
    teams.push('BYE');
  }
  
  const rounds = [];
  const totalRounds = teams.length - 1;
  const fixed = teams[0]; // Equipo fijo en posición estática
  let rotating = teams.slice(1); // Equipos que rotan
  
  for (let r = 0; r < totalRounds; r++) {
    const roundPairings = [];
    
    // Emparejar equipo fijo con primer equipo del círculo
    roundPairings.push([fixed, rotating[0]]);
    
    // Emparejar resto en posiciones opuestas del círculo
    for (let i = 1; i < rotating.length / 2; i++) {
      roundPairings.push([
        rotating[i],
        rotating[rotating.length - i]
      ]);
    }
    
    rounds.push(roundPairings);
    
    // Rotar círculo: mover último elemento al principio
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  
  return rounds;
}

/**
 * Crea un mapa para búsqueda rápida de partidos por parejas.
 * @param {Array} partidos - Lista de partidos
 * @returns {Map} - Mapa con key "equipoA|equipoB" -> partido
 */
function crearMapaPartidos(partidos) {
  const mapa = new Map();
  
  partidos.forEach(p => {
    const nombreA = p.pareja_a?.nombre;
    const nombreB = p.pareja_b?.nombre;
    
    if (nombreA && nombreB) {
      // Crear claves en ambas direcciones para lookup bidireccional
      const key1 = `${nombreA}|${nombreB}`;
      const key2 = `${nombreB}|${nombreA}`;
      mapa.set(key1, p);
      mapa.set(key2, p);
    }
  });
  
  return mapa;
}

/**
 * Busca un partido en el mapa por nombres de equipos.
 * @param {Map} mapa - Mapa de partidos
 * @param {string} eq1 - Nombre equipo 1
 * @param {string} eq2 - Nombre equipo 2
 * @returns {Object|null} - Partido encontrado o null
 */
function buscarPartido(mapa, eq1, eq2) {
  const key = `${eq1}|${eq2}`;
  return mapa.get(key) || null;
}

/**
 * Ordena partidos usando Circle Method (Berger Tables) para óptimo paralelismo.
 * Agrupa en "rondas" con mínimo número de rondas y máximo paralelismo.
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
    
    // 1. Extraer equipos únicos del grupo
    const equiposSet = new Set();
    partidosGrupo.forEach(p => {
      if (p.pareja_a?.nombre) equiposSet.add(p.pareja_a.nombre);
      if (p.pareja_b?.nombre) equiposSet.add(p.pareja_b.nombre);
    });
    const equipos = Array.from(equiposSet).sort();
    
    // 2. Crear mapa de partidos para búsqueda rápida
    const mapaPartidos = crearMapaPartidos(partidosGrupo);
    
    // 3. Aplicar Circle Method para generar pairings óptimos
    const pairings = circleMethod(equipos);
    
    // 4. Convertir pairings a rondas con partidos reales
    pairings.forEach(rondaPairings => {
      const partidosRonda = [];
      const parejasEnUso = new Set();
      
      rondaPairings.forEach(([eq1, eq2]) => {
        // Ignorar pairings con BYE (equipo dummy)
        if (eq1 !== 'BYE' && eq2 !== 'BYE') {
          const partido = buscarPartido(mapaPartidos, eq1, eq2);
          if (partido) {
            partidosRonda.push(partido);
            parejasEnUso.add(eq1);
            parejasEnUso.add(eq2);
          }
        }
      });
      
      // Calcular parejas libres (no juegan en esta ronda)
      const parejasLibres = equipos
        .filter(e => !parejasEnUso.has(e))
        .sort();
      
      if (partidosRonda.length > 0 || parejasLibres.length > 0) {
        rondas.push({
          grupo: nombreGrupo,
          partidos: partidosRonda,
          parejasLibres: parejasLibres
        });
      }
    });
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
              <div style="color: var(--muted); font-style: italic;">${obtenerFraseFechaLibre()}</div>
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
