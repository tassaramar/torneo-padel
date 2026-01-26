import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const statusEl = document.getElementById('fixture-status');
const gridEl = document.getElementById('fixture-grid');

// Auto-refresh cada 30s
let pollingInterval = null;
const POLLING_INTERVAL_MS = 30000;

function setStatus(txt) {
  if (statusEl) statusEl.textContent = txt;
}

function nowStr() {
  const d = new Date();
  return d.toLocaleTimeString();
}

/**
 * Inicializa la vista de fixture
 */
async function init(mostrarSkeleton = true) {
  try {
    setStatus('Cargando fixture...');

    // Fetch datos en paralelo
    const [partidosRes, gruposRes, parejasRes] = await Promise.all([
      supabase
        .from('partidos')
        .select(`
          id, games_a, games_b, estado, ronda,
          grupos ( nombre ),
          pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
          pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
        `)
        .eq('torneo_id', TORNEO_ID)
        .is('copa_id', null),
      
      supabase
        .from('grupos')
        .select('id, nombre')
        .eq('torneo_id', TORNEO_ID)
        .order('nombre'),
      
      supabase
        .from('parejas')
        .select('id, nombre, orden')
        .eq('torneo_id', TORNEO_ID)
        .order('orden')
    ]);

    if (partidosRes.error) throw partidosRes.error;
    if (gruposRes.error) throw gruposRes.error;
    if (parejasRes.error) throw parejasRes.error;

    const partidos = partidosRes.data || [];
    const grupos = gruposRes.data || [];
    const parejas = parejasRes.data || [];

    // Asignar grupo a cada pareja
    const parejasConGrupo = agregarGrupoAParejas(parejas, grupos);

    // Agrupar por ronda y grupo
    const data = agruparPorRondaYGrupo(partidos, grupos, parejasConGrupo);

    // Renderizar
    renderFixtureGrid(data);

    setStatus(`Actualizado ${nowStr()}`);
  } catch (error) {
    console.error('Error cargando fixture:', error);
    setStatus('❌ Error cargando fixture');
    if (gridEl) gridEl.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">Error cargando datos</p>';
  }
}

/**
 * Agrupa partidos por ronda y grupo, detectando fechas libres
 */
function agruparPorRondaYGrupo(partidos, grupos, parejas) {
  // Determinar rondas únicas
  const rondasSet = new Set();
  partidos.forEach(p => {
    if (p.ronda) rondasSet.add(p.ronda);
  });
  const rondas = Array.from(rondasSet).sort((a, b) => a - b);

  // Grupos ordenados alfabéticamente
  const gruposOrdenados = grupos.map(g => g.nombre).sort();

  // Crear mapa de parejas por grupo
  const parejasPorGrupo = {};
  parejas.forEach(p => {
    if (!parejasPorGrupo[p.grupo]) {
      parejasPorGrupo[p.grupo] = [];
    }
    parejasPorGrupo[p.grupo].push(p);
  });

  // Crear matriz: key = "ronda-grupo", value = array de items (partidos o fechas libres)
  const matriz = {};

  // Poblar matriz con partidos
  partidos.forEach(p => {
    const grupo = p.grupos?.nombre || 'Sin Grupo';
    const ronda = p.ronda || 0;
    const key = `${ronda}-${grupo}`;
    
    if (!matriz[key]) {
      matriz[key] = [];
    }
    
    matriz[key].push({
      tipo: 'partido',
      partido: p
    });
  });

  // Detectar fechas libres
  rondas.forEach(ronda => {
    gruposOrdenados.forEach(grupo => {
      const key = `${ronda}-${grupo}`;
      const items = matriz[key] || [];
      const partidosEnCelda = items.filter(i => i.tipo === 'partido');
      
      // Obtener parejas que juegan en esta celda
      const parejasJugando = new Set();
      partidosEnCelda.forEach(item => {
        const p = item.partido;
        if (p.pareja_a?.id) parejasJugando.add(p.pareja_a.id);
        if (p.pareja_b?.id) parejasJugando.add(p.pareja_b.id);
      });
      
      // Parejas del grupo que NO juegan = tienen fecha libre
      const parejasDelGrupo = parejasPorGrupo[grupo] || [];
      const parejasLibres = parejasDelGrupo.filter(p => !parejasJugando.has(p.id));
      
      // Agregar fechas libres a la matriz
      parejasLibres.forEach(pareja => {
        if (!matriz[key]) {
          matriz[key] = [];
        }
        matriz[key].push({
          tipo: 'fechaLibre',
          pareja: pareja
        });
      });
    });
  });

  return {
    rondas,
    grupos: gruposOrdenados,
    matriz
  };
}

/**
 * Asigna grupo a cada pareja basado en orden
 */
function agregarGrupoAParejas(parejas, grupos) {
  if (!grupos.length || !parejas.length) {
    return parejas.map(p => ({ ...p, grupo: '?' }));
  }
  
  const n = grupos.length;
  const per = parejas.length / n;
  
  if (!Number.isInteger(per)) {
    return parejas.map(p => ({ ...p, grupo: '?' }));
  }
  
  const orderedGroups = [...grupos].map(g => g.nombre).sort();
  
  return parejas.map((p, idx) => {
    const grupoIdx = Math.floor(idx / per);
    const grupo = orderedGroups[grupoIdx] || '?';
    return { ...p, grupo };
  });
}

/**
 * Renderiza el grid completo del fixture
 */
function renderFixtureGrid(data) {
  const { rondas, grupos, matriz } = data;

  if (!rondas.length || !grupos.length) {
    gridEl.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">No hay datos para mostrar</p>';
    return;
  }

  let html = '<table class="fixture-table">';
  
  // Header con nombres de grupos
  html += '<thead><tr>';
  html += '<th class="fixture-ronda-header">Ronda</th>';
  grupos.forEach(grupo => {
    html += `<th>Grupo ${escapeHtml(grupo)}</th>`;
  });
  html += '</tr></thead>';
  
  // Body con rondas
  html += '<tbody>';
  rondas.forEach(ronda => {
    html += '<tr>';
    html += `<td class="fixture-ronda-header" data-ronda="${ronda}">${ronda}</td>`;
    
    grupos.forEach(grupo => {
      const key = `${ronda}-${grupo}`;
      const items = matriz[key] || [];
      
      html += `<td data-grupo="${escapeHtml(grupo)}"><div class="fixture-cell">`;
      
      if (items.length === 0) {
        html += '<div style="color: #ccc; text-align: center; padding: 20px;">—</div>';
      } else {
        // Ordenar: partidos primero, luego fechas libres
        const partidos = items.filter(i => i.tipo === 'partido');
        const fechasLibres = items.filter(i => i.tipo === 'fechaLibre');
        
        // Renderizar partidos
        partidos.forEach(item => {
          html += renderPartidoCard(item.partido);
        });
        
        // Renderizar fechas libres
        fechasLibres.forEach(item => {
          html += renderFechaLibreCard(item.pareja);
        });
      }
      
      html += '</div></td>';
    });
    
    html += '</tr>';
  });
  html += '</tbody>';
  
  html += '</table>';
  
  gridEl.innerHTML = html;
}

/**
 * Renderiza una card de partido
 */
function renderPartidoCard(partido) {
  const jugado = partido.games_a !== null && partido.games_b !== null;
  const claseEstado = jugado ? 'fixture-partido-jugado' : 'fixture-partido-pendiente';
  
  const nombreA = partido.pareja_a?.nombre || '—';
  const nombreB = partido.pareja_b?.nombre || '—';
  
  let html = `<div class="fixture-partido-card ${claseEstado}">`;
  
  if (jugado) {
    // Jugado: mostrar en línea con resultado
    html += `<div class="fixture-vs">`;
    html += `<span class="fixture-equipo">${escapeHtml(nombreA)}</span>`;
    html += `<span class="fixture-resultado">${partido.games_a}-${partido.games_b}</span>`;
    html += `<span class="fixture-equipo">${escapeHtml(nombreB)}</span>`;
    html += `</div>`;
  } else {
    // Pendiente: mostrar en línea con vs
    html += `<div class="fixture-vs">`;
    html += `<span class="fixture-equipo">${escapeHtml(nombreA)}</span>`;
    html += `<span style="font-size: 0.65rem; color: #999; flex: 0 0 auto; margin: 0 2px;">vs</span>`;
    html += `<span class="fixture-equipo">${escapeHtml(nombreB)}</span>`;
    html += `</div>`;
  }
  
  html += '</div>';
  return html;
}

/**
 * Renderiza una card de fecha libre
 */
function renderFechaLibreCard(pareja) {
  return `
    <div class="fixture-partido-card fixture-fecha-libre">
      <div style="font-size: 0.7rem; font-weight: 600; margin-bottom: 2px;">Libre</div>
      <div style="font-size: 0.75rem; line-height: 1.2;">${escapeHtml(pareja.nombre)}</div>
    </div>
  `;
}

/**
 * Escapa HTML
 */
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Inicia auto-refresh sin skeleton
 */
function startPolling() {
  stopPolling();
  
  pollingInterval = setInterval(() => {
    console.log('[Polling] Auto-refresh fixture...');
    init(false); // false = no skeleton
  }, POLLING_INTERVAL_MS);
  
  // Pausar polling cuando tab no está visible
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    console.log('[Polling] Tab oculto - pausando polling');
    stopPolling();
  } else {
    console.log('[Polling] Tab visible - reiniciando polling');
    startPolling();
  }
}

// Inicializar
init().then(() => startPolling());
