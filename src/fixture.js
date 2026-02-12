import { createClient } from '@supabase/supabase-js';
import { esPartidoFinalizado, esPartidoPendiente, esPartidoYaJugado, calcularColaSugerida } from './utils/colaFixture.js';
import { tieneResultado, formatearResultado } from './utils/formatoResultado.js';
import { initPresentismo, marcarAmbosPresentes } from './viewer/presentismo.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const statusEl = document.getElementById('fixture-status');
const gridEl = document.getElementById('fixture-grid');

// Estado de la vista actual
let vistaActual = 'cola'; // 'tabla' | 'cola'
let cacheDatos = null;
let colaSearch = '';

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
    const [partidosRes, gruposRes, parejasRes, torneoRes] = await Promise.all([
      supabase
        .from('partidos')
        .select(`
          id, estado, ronda,
          set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
          sets_a, sets_b,
          games_totales_a, games_totales_b,
          stb_puntos_a, stb_puntos_b,
          grupos ( nombre ),
          pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre, presentes ),
          pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre, presentes )
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
        .select('id, nombre, orden, presentes')
        .eq('torneo_id', TORNEO_ID)
        .order('orden'),

      supabase
        .from('torneos')
        .select('presentismo_activo')
        .eq('id', TORNEO_ID)
        .single()
    ]);

    if (partidosRes.error) throw partidosRes.error;
    if (gruposRes.error) throw gruposRes.error;
    if (parejasRes.error) throw parejasRes.error;
    if (torneoRes.error) throw torneoRes.error;

    const partidos = partidosRes.data || [];
    const grupos = gruposRes.data || [];
    const parejas = parejasRes.data || [];
    const presentismoActivo = torneoRes.data?.presentismo_activo || false;

    // Inicializar módulo de presentismo
    initPresentismo(supabase);

    // Asignar grupo a cada pareja
    const parejasConGrupo = agregarGrupoAParejas(parejas, grupos);

    // Agrupar por ronda y grupo
    const data = agruparPorRondaYGrupo(partidos, grupos, parejasConGrupo);

    // Guardar en cache para uso en ambas vistas
    cacheDatos = {
      partidos,
      grupos,
      parejas: parejasConGrupo,
      data,
      presentismoActivo
    };

    // Renderizar según la vista actual
    if (vistaActual === 'cola') {
      renderColaFixture(partidos, grupos, parejasConGrupo);
    } else {
      renderFixtureGrid(data);
    }

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
  const jugado = tieneResultado(partido);
  const claseEstado = jugado ? 'fixture-partido-jugado' : 'fixture-partido-pendiente';
  
  const nombreA = partido.pareja_a?.nombre || '—';
  const nombreB = partido.pareja_b?.nombre || '—';
  
  let html = `<div class="fixture-partido-card ${claseEstado}">`;
  
  if (jugado) {
    // Jugado: mostrar en línea con resultado
    html += `<div class="fixture-vs">`;
    html += `<span class="fixture-equipo">${escapeHtml(nombreA)}</span>`;
    html += `<span class="fixture-resultado">${formatearResultado(partido)}</span>`;
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
 * Calcula estadísticas por grupo para el resumen
 * finalizado = con resultado + terminado (ya jugados)
 */
function calcularEstadisticasPorGrupo(partidos, grupos) {
  const gruposOrdenados = grupos.map(g => g.nombre).sort();
  const stats = {};
  
  gruposOrdenados.forEach(grupo => {
    const partidosDelGrupo = partidos.filter(p => p.grupos?.nombre === grupo);
    stats[grupo] = {
      pendiente: partidosDelGrupo.filter(p => esPartidoPendiente(p)).length,
      enJuego: partidosDelGrupo.filter(p => p.estado === 'en_juego').length,
      finalizado: partidosDelGrupo.filter(p => esPartidoYaJugado(p)).length,
      total: partidosDelGrupo.length
    };
  });
  
  return stats;
}

/**
 * Recarga partidos, actualiza cache y re-renderiza según vista actual
 */
async function refrescarYRenderizar() {
  if (!cacheDatos) return;
  try {
    const partidosRes = await supabase
      .from('partidos')
      .select(`
        id, estado, ronda,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
        stb_puntos_a, stb_puntos_b,
        grupos ( nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre, presentes ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre, presentes )
      `)
      .eq('torneo_id', TORNEO_ID)
      .is('copa_id', null);
    if (partidosRes.error) throw partidosRes.error;
    const partidosActualizados = partidosRes.data || [];
    cacheDatos.partidos = partidosActualizados;
    const data = agruparPorRondaYGrupo(partidosActualizados, cacheDatos.grupos, cacheDatos.parejas);
    cacheDatos.data = data;
    if (vistaActual === 'cola') {
      renderColaFixture(partidosActualizados, cacheDatos.grupos, cacheDatos.parejas);
    } else {
      renderFixtureGrid(data);
    }
  } catch (e) {
    console.error('Error refrescando fixture:', e);
  }
}

/**
 * Marca un partido como "en juego"
 */
async function marcarEnJuego(partidoId) {
  try {
    const { error } = await supabase.from('partidos').update({ estado: 'en_juego' }).eq('id', partidoId);
    if (error) throw error;
    await refrescarYRenderizar();
  } catch (error) {
    console.error('Error marcando partido como en juego:', error);
    alert('Error al marcar el partido como en juego');
  }
}

/**
 * Desmarca "en juego" -> vuelve a pendiente
 */
async function desmarcarEnJuego(partidoId) {
  try {
    const { error } = await supabase.from('partidos').update({ estado: 'pendiente' }).eq('id', partidoId);
    if (error) throw error;
    await refrescarYRenderizar();
  } catch (error) {
    console.error('Error desmarcando en juego:', error);
    alert('Error al desmarcar en juego');
  }
}

/**
 * Marca "en juego" como finalizado (va a Ya jugados, estado terminado)
 */
async function marcarComoFinalizado(partidoId) {
  try {
    const { error } = await supabase.from('partidos').update({ estado: 'terminado' }).eq('id', partidoId);
    if (error) throw error;
    await refrescarYRenderizar();
  } catch (error) {
    console.error('Error marcando como finalizado:', error);
    alert('Error al marcar como finalizado');
  }
}

/**
 * Vuelve a "en juego" un partido en Ya jugados sin resultado (terminado)
 */
async function siguenJugando(partidoId) {
  try {
    const { error } = await supabase.from('partidos').update({ estado: 'en_juego' }).eq('id', partidoId);
    if (error) throw error;
    await refrescarYRenderizar();
  } catch (error) {
    console.error('Error en siguen jugando:', error);
    alert('Error al marcar siguen jugando');
  }
}

function normSearch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Renderiza una card de partido para la cola (header + equipos + acciones opcionales)
 */
function renderColaItem(partido, gruposOrdenados, opts = {}) {
  const grupo = partido.grupos?.nombre || 'Sin Grupo';
  const grupoIndex = Math.min(Math.max(0, gruposOrdenados.indexOf(grupo)), 3);
  const pillClass = `fixture-pill-grupo fixture-pill-grupo-${grupoIndex}`;
  const nombreA = partido.pareja_a?.nombre || '—';
  const nombreB = partido.pareja_b?.nombre || '—';
  const ronda = partido.ronda ?? '?';
  const posicion = opts.posicion != null ? opts.posicion : null;
  const resultado = esPartidoFinalizado(partido) ? formatearResultado(partido) : null;
  const searchable = `${grupo} ${nombreA} ${nombreB} R${ronda}`;

  let html = `<div class="fixture-cola-item" data-search="${escapeHtml(searchable)}">`;
  html += '<div class="fixture-cola-item-header">';
  if (posicion != null) html += `<span class="fixture-cola-posicion">${posicion}</span>`;
  html += `<span class="${pillClass}">Grupo ${escapeHtml(grupo)}</span>`;
  html += `<span class="fixture-cola-ronda">R${ronda}</span>`;
  html += '</div>';
  html += '<div class="fixture-cola-item-content">';
  html += `<span class="fixture-cola-equipo">${escapeHtml(nombreA)}</span>`;
  html += '<span class="fixture-cola-vs">vs</span>';
  html += `<span class="fixture-cola-equipo">${escapeHtml(nombreB)}</span>`;
  if (resultado) html += `<span class="fixture-cola-resultado">${resultado}</span>`;
  html += '</div>';

  if (opts.acciones === 'en_juego') {
    html += '<div class="fixture-cola-acciones">';
    html += `<button type="button" class="fixture-cola-btn-link" onclick="window.desmarcarEnJuego('${partido.id}')">Desmarcar en juego</button>`;
    html += `<button type="button" class="fixture-cola-btn-finalizado" onclick="window.marcarComoFinalizado('${partido.id}')">Finalizar</button>`;
    html += '</div>';
  } else if (opts.acciones === 'pendiente') {
    html += `<button type="button" class="fixture-cola-btn-en-juego" onclick="window.marcarEnJuego('${partido.id}')">Marcar en juego</button>`;
  } else if (opts.acciones === 'siguen_jugando') {
    html += `<button type="button" class="fixture-cola-btn-link" onclick="window.siguenJugando('${partido.id}')">Siguen jugando</button>`;
  }

  html += '</div>';
  return html;
}

/**
 * Renderiza la vista de cola sugerida (secciones: En juego | Pendientes | Ya jugados)
 */
function renderColaFixture(partidos, grupos, parejas) {
  const enJuego = partidos.filter(p => p.estado === 'en_juego');
  const cola = calcularColaSugerida(partidos, grupos);
  const yaJugados = partidos.filter(p => esPartidoYaJugado(p));
  const stats = calcularEstadisticasPorGrupo(partidos, grupos);
  const gruposOrdenados = grupos.map(g => g.nombre).sort();

  let html = '<div class="fixture-cola-container">';

  // Resumen por grupo
  html += '<div class="fixture-cola-resumen">';
  html += '<h3 class="fixture-cola-resumen-title">Resumen por grupo</h3>';
  html += '<div class="fixture-cola-stats">';
  gruposOrdenados.forEach((grupo, idx) => {
    const s = stats[grupo] || { pendiente: 0, enJuego: 0, finalizado: 0, total: 0 };
    const pillClass = `fixture-pill-grupo fixture-pill-grupo-${Math.min(idx, 3)}`;
    html += '<div class="fixture-cola-stat-item">';
    html += `<span class="${pillClass}">Grupo ${escapeHtml(grupo)}</span>`;
    html += '<span class="fixture-cola-stat-numbers">';
    html += `<span class="stat-pendiente">${s.pendiente}</span> / `;
    html += `<span class="stat-en-juego">${s.enJuego}</span> / `;
    html += `<span class="stat-finalizado">${s.finalizado}</span>`;
    html += '</span></div>';
  });
  html += '</div></div>';

  // Sección: En juego (arriba) – colapsable, acento naranja
  html += '<details class="fixture-cola-seccion fixture-cola-seccion-en-juego" open>';
  html += '<summary class="fixture-cola-seccion-titulo">En juego</summary>';
  html += '<div class="fixture-cola-lista">';
  if (enJuego.length) {
    enJuego.forEach(p => { html += renderColaItem(p, gruposOrdenados, { acciones: 'en_juego' }); });
  } else {
    html += '<p class="fixture-cola-vacio">Ninguno</p>';
  }
  html += '</div></details>';

  // Sección: Pendientes (medio) – colapsable, acento azul
  html += '<details class="fixture-cola-seccion fixture-cola-seccion-pendientes" open>';
  html += '<summary class="fixture-cola-seccion-titulo">Pendientes</summary>';
  html += '<div class="fixture-cola-lista">';
  if (cola.length) {
    cola.forEach((p, i) => { html += renderColaItem(p, gruposOrdenados, { posicion: i + 1, acciones: 'pendiente' }); });
  } else {
    html += '<p class="fixture-cola-vacio">Ninguno</p>';
  }
  html += '</div></details>';

  // Sección: Ya jugados (abajo) – colapsable, acento verde
  html += '<details class="fixture-cola-seccion fixture-cola-seccion-ya-jugados" open>';
  html += '<summary class="fixture-cola-seccion-titulo">Ya jugados</summary>';
  html += '<div class="fixture-cola-lista">';
  if (yaJugados.length) {
    yaJugados.forEach(p => {
      const sinResultado = p.estado === 'terminado';
      html += renderColaItem(p, gruposOrdenados, { acciones: sinResultado ? 'siguen_jugando' : undefined });
    });
  } else {
    html += '<p class="fixture-cola-vacio">Ninguno</p>';
  }
  html += '</div></details>';

  html += '</div>';
  gridEl.innerHTML = html;

  window.marcarEnJuego = marcarEnJuego;
  window.desmarcarEnJuego = desmarcarEnJuego;
  window.marcarComoFinalizado = marcarComoFinalizado;
  window.siguenJugando = siguenJugando;

  aplicarBusquedaCola();
  wireSearchUI();
}

function aplicarBusquedaCola() {
  const listCont = gridEl.querySelector('.fixture-cola-container');
  if (!listCont) return;
  const items = listCont.querySelectorAll('.fixture-cola-item');
  const q = normSearch(colaSearch);
  const puedeFiltrar = q.length >= 2;
  for (const el of items) {
    const hay = normSearch(el.dataset.search || '');
    el.style.display = !puedeFiltrar || hay.includes(q) ? '' : 'none';
  }
}

function wireSearchUI() {
  const searchRow = document.getElementById('fixture-cola-search');
  const input = document.getElementById('fixture-search-input');
  const clearBtn = document.getElementById('fixture-search-clear');
  if (!searchRow || !input) return;
  if (vistaActual !== 'cola') return;
  searchRow.style.display = '';
  input.value = colaSearch;
  input.oninput = () => {
    colaSearch = input.value || '';
    aplicarBusquedaCola();
  };
  if (clearBtn) {
    clearBtn.onclick = () => {
      colaSearch = '';
      input.value = '';
      input.focus();
      aplicarBusquedaCola();
    };
  }
}

function hideSearchRow() {
  const searchRow = document.getElementById('fixture-cola-search');
  if (searchRow) searchRow.style.display = 'none';
}

/**
 * Cambia entre vista de tabla y cola
 */
function cambiarVista(nuevaVista) {
  vistaActual = nuevaVista;

  if (vistaActual === 'tabla') hideSearchRow();

  // Actualizar tabs
  document.querySelectorAll('.fixture-tab').forEach(tab => {
    tab.classList.toggle('is-active', tab.dataset.vista === nuevaVista);
  });

  // Re-renderizar con datos en cache
  if (cacheDatos) {
    if (vistaActual === 'cola') {
      renderColaFixture(
        cacheDatos.partidos,
        cacheDatos.grupos,
        cacheDatos.parejas
      );
    } else {
      renderFixtureGrid(cacheDatos.data);
    }
  }
}

// Exponer función globalmente
window.cambiarVista = cambiarVista;

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
