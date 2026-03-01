/**
 * Modal de Consulta Full-Screen
 * Permite consultar tablas/grupos/fixture sin salir del Home
 * 
 * Tabs:
 * - Mi grupo: tabla de posiciones + partidos del grupo del usuario
 * - Otros grupos: selector de grupo + tabla + partidos
 * - Fixture: vista de cola del fixture (reutiliza lógica existente)
 */

import {
  calcularTablaGrupo as calcularTablaGrupoCentral,
  ordenarConOverrides,
  detectarEmpatesReales,
  cargarOverrides,
  agregarMetadataOverrides
} from '../utils/tablaPosiciones.js';
import { tieneResultado, formatearResultado } from '../utils/formatoResultado.js';
import { calcularColaSugerida, crearMapaPosiciones } from '../utils/colaFixture.js';

let modalState = {
  isOpen: false,
  activeTab: 'mi-grupo',
  grupoSeleccionado: null,
  cache: null,
  identidad: null,
  supabase: null,
  torneoId: null
};

/**
 * Inicializa el modal con datos necesarios
 */
export function initModal(supabase, torneoId, identidad) {
  modalState.supabase = supabase;
  modalState.torneoId = torneoId;
  modalState.identidad = identidad;
  
  // Wire eventos
  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', cerrarModal);
  }
  
  // Cerrar con ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalState.isOpen) {
      cerrarModal();
    }
  });
  
  // Cerrar al hacer click fuera del contenido
  const modal = document.getElementById('modal-consulta');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cerrarModal();
      }
    });
  }
}

/**
 * Abre el modal de consulta
 */
export async function abrirModal(tabInicial = 'mi-grupo') {
  const modal = document.getElementById('modal-consulta');
  if (!modal) return;
  
  modalState.isOpen = true;
  modalState.activeTab = tabInicial;
  
  // Mostrar modal con animación
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // Prevenir scroll del body
  
  // Cargar datos si no están en cache
  if (!modalState.cache) {
    await cargarDatosModal();
  }
  
  renderTabs();
  renderContenido();
}

/**
 * Cierra el modal
 */
export function cerrarModal() {
  const modal = document.getElementById('modal-consulta');
  if (!modal) return;
  
  modalState.isOpen = false;
  modal.style.display = 'none';
  document.body.style.overflow = ''; // Restaurar scroll
}

/**
 * Carga todos los datos necesarios para el modal
 */
async function cargarDatosModal() {
  const { supabase, torneoId } = modalState;
  if (!supabase || !torneoId) return;
  
  try {
    const [gruposRes, partidosRes, parejasRes, copasRes, partidosCopaRes] = await Promise.all([
      supabase
        .from('grupos')
        .select('id, nombre')
        .eq('torneo_id', torneoId)
        .order('nombre'),
      supabase
        .from('partidos')
        .select(`
          id, estado, ronda,
          set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
          sets_a, sets_b,
          games_totales_a, games_totales_b,
          grupo_id,
          pareja_a_id, pareja_b_id,
          grupos ( id, nombre ),
          pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
          pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
        `)
        .eq('torneo_id', torneoId)
        .is('copa_id', null),
      supabase
        .from('parejas')
        .select('id, nombre, orden')
        .eq('torneo_id', torneoId)
        .order('orden'),
      supabase
        .from('copas')
        .select('id, nombre')
        .eq('torneo_id', torneoId),
      supabase
        .from('partidos')
        .select(`
          id, copa_id, ronda_copa, orden_copa, estado,
          set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
          sets_a, sets_b, games_totales_a, games_totales_b,
          pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
          pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
        `)
        .eq('torneo_id', torneoId)
        .not('copa_id', 'is', null)
    ]);

    if (gruposRes.error) throw gruposRes.error;
    if (partidosRes.error) throw partidosRes.error;
    if (parejasRes.error) throw parejasRes.error;

    modalState.cache = {
      grupos: gruposRes.data || [],
      partidos: partidosRes.data || [],
      parejas: parejasRes.data || [],
      copas: copasRes.data || [],
      partidosCopa: partidosCopaRes.data || []
    };
    
  } catch (error) {
    console.error('Error cargando datos del modal:', error);
  }
}

/**
 * Renderiza los tabs del modal
 */
function renderTabs() {
  const tabsContainer = document.getElementById('modal-tabs');
  if (!tabsContainer) return;
  
  const tabs = [
    { id: 'mi-grupo', label: 'Mi grupo' },
    { id: 'otros-grupos', label: 'Otros grupos' },
    { id: 'fixture', label: 'Fixture' }
  ];
  
  tabsContainer.innerHTML = tabs.map(tab => `
    <button 
      type="button" 
      class="modal-tab ${modalState.activeTab === tab.id ? 'active' : ''}"
      data-tab="${tab.id}"
    >
      ${tab.label}
    </button>
  `).join('');
  
  // Wire eventos de tabs
  tabsContainer.querySelectorAll('.modal-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      modalState.activeTab = btn.dataset.tab;
      renderTabs();
      renderContenido();
    });
  });
}

/**
 * Renderiza el contenido según el tab activo
 */
async function renderContenido() {
  const bodyContainer = document.getElementById('modal-body');
  if (!bodyContainer) return;
  
  switch (modalState.activeTab) {
    case 'mi-grupo':
      await renderMiGrupo(bodyContainer);
      break;
    case 'otros-grupos':
      await renderOtrosGrupos(bodyContainer);
      break;
    case 'fixture':
      renderFixture(bodyContainer);
      break;
  }
}

/**
 * Renderiza el tab "Mi grupo"
 */
async function renderMiGrupo(container) {
  const { cache, identidad, supabase, torneoId } = modalState;
  if (!cache || !identidad) {
    container.innerHTML = '<p class="modal-empty">Cargando...</p>';
    return;
  }
  
  // Encontrar mi grupo
  const miGrupo = cache.grupos.find(g => g.nombre === identidad.grupo);
  if (!miGrupo) {
    container.innerHTML = '<p class="modal-empty">No se encontró tu grupo</p>';
    return;
  }
  
  // Calcular tabla de posiciones
  const partidosDelGrupo = cache.partidos.filter(p => p.grupos?.id === miGrupo.id);
  const tablaBase = calcularTablaGrupoCentral(partidosDelGrupo);
  const overridesMap = await cargarOverrides(supabase, torneoId, miGrupo.id);
  const tablaOrdenada = ordenarConOverrides(tablaBase, overridesMap, partidosDelGrupo);
  const { tieGroups } = detectarEmpatesReales(tablaOrdenada, partidosDelGrupo, overridesMap);
  const tablaConMetadata = agregarMetadataOverrides(tablaOrdenada, overridesMap);
  
  // Crear mapa de colores de empate
  const tieColorMap = {};
  if (tieGroups) {
    tieGroups.forEach(group => {
      group.parejaIds.forEach(parejaId => {
        tieColorMap[parejaId] = group.color;
      });
    });
  }

  // Calcular cola global y mapa de posiciones para números de partido
  const colaGlobal = calcularColaSugerida(cache.partidos || [], cache.grupos || []);
  const mapaPosiciones = crearMapaPosiciones(colaGlobal);

  const jugados = partidosDelGrupo.filter(p => tieneResultado(p)).length;
  const total = partidosDelGrupo.length;
  
  let html = `
    <div class="modal-section">
      <h3 class="modal-section-title">Grupo ${escapeHtml(miGrupo.nombre)}</h3>
      <p class="modal-meta">Partidos: ${jugados}/${total}</p>
      
      <div class="tabla-posiciones">
        <table class="tabla-grupo">
          <thead>
            <tr>
              <th class="pos-col">#</th>
              <th class="nombre-col">Pareja</th>
              <th class="stat-col">PJ</th>
              <th class="stat-col">G</th>
              <th class="stat-col">P</th>
              <th class="stat-col">Dif</th>
              <th class="pts-col">Pts</th>
            </tr>
          </thead>
          <tbody>
            ${tablaConMetadata.map((row, idx) => {
              const esMiPareja = row.pareja_id === identidad.parejaId;
              const diferencia = row.GF - row.GC;
              const diferenciaStr = diferencia > 0 ? `+${diferencia}` : diferencia;
              const tieColor = tieColorMap[row.pareja_id];
              const styleEmpate = tieColor ? `background: ${tieColor.bg}; border-left: 4px solid ${tieColor.border};` : '';
              
              return `
                <tr class="${esMiPareja ? 'mi-pareja' : ''}" style="${styleEmpate}">
                  <td class="pos-col">${idx + 1}</td>
                  <td class="nombre-col">${escapeHtml(row.nombre)}</td>
                  <td class="stat-col">${row.PJ}</td>
                  <td class="stat-col">${row.PG}</td>
                  <td class="stat-col">${row.PP}</td>
                  <td class="stat-col">${diferenciaStr}</td>
                  <td class="pts-col"><strong>${row.P}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <details class="modal-details" open>
        <summary>Partidos del grupo</summary>
        <div class="modal-partidos-list">
          ${renderPartidosGrupo(partidosDelGrupo, identidad, mapaPosiciones)}
        </div>
      </details>
    </div>
  `;
  
  container.innerHTML = html;
}

/**
 * Renderiza el tab "Otros grupos"
 */
async function renderOtrosGrupos(container) {
  const { cache, identidad, supabase, torneoId } = modalState;
  if (!cache) {
    container.innerHTML = '<p class="modal-empty">Cargando...</p>';
    return;
  }
  
  // Filtrar grupos (excluir el mío)
  const otrosGrupos = cache.grupos.filter(g => g.nombre !== identidad?.grupo);
  
  if (otrosGrupos.length === 0) {
    container.innerHTML = '<p class="modal-empty">No hay otros grupos</p>';
    return;
  }
  
  // Selector de grupo
  if (!modalState.grupoSeleccionado && otrosGrupos.length > 0) {
    modalState.grupoSeleccionado = otrosGrupos[0].id;
  }
  
  const grupoActual = cache.grupos.find(g => g.id === modalState.grupoSeleccionado);
  
  // Calcular tabla
  const partidosDelGrupo = cache.partidos.filter(p => p.grupos?.id === modalState.grupoSeleccionado);
  const tablaBase = calcularTablaGrupoCentral(partidosDelGrupo);
  const overridesMap = await cargarOverrides(supabase, torneoId, modalState.grupoSeleccionado);
  const tablaOrdenada = ordenarConOverrides(tablaBase, overridesMap, partidosDelGrupo);
  const tablaConMetadata = agregarMetadataOverrides(tablaOrdenada, overridesMap);

  // Calcular cola global y mapa de posiciones para números de partido
  const colaGlobal = calcularColaSugerida(cache.partidos || [], cache.grupos || []);
  const mapaPosiciones = crearMapaPosiciones(colaGlobal);

  const jugados = partidosDelGrupo.filter(p => tieneResultado(p)).length;
  const total = partidosDelGrupo.length;
  
  let html = `
    <div class="modal-section">
      <div class="modal-grupo-selector">
        ${otrosGrupos.map(g => `
          <button 
            type="button" 
            class="modal-grupo-btn ${g.id === modalState.grupoSeleccionado ? 'active' : ''}"
            data-grupo-id="${g.id}"
          >
            Grupo ${escapeHtml(g.nombre)}
          </button>
        `).join('')}
      </div>
      
      <p class="modal-meta">Partidos: ${jugados}/${total}</p>
      
      <div class="tabla-posiciones">
        <table class="tabla-grupo">
          <thead>
            <tr>
              <th class="pos-col">#</th>
              <th class="nombre-col">Pareja</th>
              <th class="stat-col">PJ</th>
              <th class="stat-col">G</th>
              <th class="stat-col">P</th>
              <th class="stat-col">Dif</th>
              <th class="pts-col">Pts</th>
            </tr>
          </thead>
          <tbody>
            ${tablaConMetadata.map((row, idx) => {
              const diferencia = row.GF - row.GC;
              const diferenciaStr = diferencia > 0 ? `+${diferencia}` : diferencia;
              return `
                <tr>
                  <td class="pos-col">${idx + 1}</td>
                  <td class="nombre-col">${escapeHtml(row.nombre)}</td>
                  <td class="stat-col">${row.PJ}</td>
                  <td class="stat-col">${row.PG}</td>
                  <td class="stat-col">${row.PP}</td>
                  <td class="stat-col">${diferenciaStr}</td>
                  <td class="pts-col"><strong>${row.P}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <details class="modal-details">
        <summary>Partidos del grupo</summary>
        <div class="modal-partidos-list">
          ${renderPartidosGrupo(partidosDelGrupo, null, mapaPosiciones)}
        </div>
      </details>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Wire selector de grupo
  container.querySelectorAll('.modal-grupo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modalState.grupoSeleccionado = btn.dataset.grupoId;
      renderOtrosGrupos(container);
    });
  });
}

const RONDA_COPA_LABEL = { SF: 'Semifinal', F: 'Final', '3P': '3° Puesto', direct: 'Cruce' };

/**
 * Renderiza la sección de copas para el modal de fixture
 */
function renderCopasEnModal(partidosCopa, copaMap) {
  const copasPorNombre = {};
  partidosCopa.forEach(p => {
    const nombre = copaMap[p.copa_id] || 'Copa';
    if (!copasPorNombre[nombre]) copasPorNombre[nombre] = [];
    copasPorNombre[nombre].push(p);
  });

  const copaEntries = Object.entries(copasPorNombre);
  if (copaEntries.length === 0) return '';

  let html = '<div class="modal-section" style="margin-top: 16px;">';
  html += '<h3 class="modal-section-title">🏆 Copas</h3>';

  copaEntries.forEach(([nombre, ps]) => {
    html += `<details class="modal-details" open>`;
    html += `<summary>${escapeHtml(nombre)}</summary>`;
    html += '<div class="modal-partidos-list">';
    ps.sort((a, b) => (a.orden_copa || 0) - (b.orden_copa || 0))
      .forEach(p => {
        const nombreA = p.pareja_a?.nombre || '—';
        const nombreB = p.pareja_b?.nombre || '—';
        const jugado = tieneResultado(p);
        const rondaLabel = RONDA_COPA_LABEL[p.ronda_copa] || p.ronda_copa || '?';
        html += `<div class="modal-partido ${jugado ? 'jugado' : 'pendiente'}">`;
        html += `<span class="modal-partido-ronda">${escapeHtml(rondaLabel)}</span>`;
        html += `<span class="modal-partido-equipos">`;
        html += `${escapeHtml(nombreA)} <span class="vs">vs</span> ${escapeHtml(nombreB)}`;
        html += `</span>`;
        html += `<span class="modal-partido-resultado">`;
        html += jugado ? formatearResultado(p) : 'Pendiente';
        html += `</span>`;
        html += `</div>`;
      });
    html += '</div>';
    html += '</details>';
  });

  html += '</div>';
  return html;
}

/**
 * Renderiza el tab "Fixture"
 */
function renderFixture(container) {
  const { cache } = modalState;
  if (!cache) {
    container.innerHTML = '<p class="modal-empty">Cargando...</p>';
    return;
  }
  
  const { partidos, grupos } = cache;
  const gruposOrdenados = grupos.map(g => g.nombre).sort();
  
  // Calcular cola sugerida (partidos pendientes ordenados)
  const pendientes = partidos.filter(p => !tieneResultado(p));
  const porRondaYGrupo = {};
  
  pendientes.forEach(p => {
    const ronda = p.ronda || 999;
    const grupo = p.grupos?.nombre || 'Sin Grupo';
    const key = `${ronda}-${grupo}`;
    if (!porRondaYGrupo[key]) {
      porRondaYGrupo[key] = [];
    }
    porRondaYGrupo[key].push(p);
  });
  
  const rondasSet = new Set();
  pendientes.forEach(p => {
    if (p.ronda) rondasSet.add(p.ronda);
  });
  const rondas = Array.from(rondasSet).sort((a, b) => a - b);
  
  const cola = [];
  rondas.forEach(ronda => {
    gruposOrdenados.forEach(grupo => {
      const key = `${ronda}-${grupo}`;
      const partidosDelGrupo = porRondaYGrupo[key] || [];
      cola.push(...partidosDelGrupo);
    });
  });
  
  // Estadísticas
  const jugados = partidos.filter(p => tieneResultado(p)).length;
  const total = partidos.length;
  
  let html = `
    <div class="modal-section">
      <div class="modal-fixture-stats">
        <span class="modal-stat">
          <strong>${cola.length}</strong> pendientes
        </span>
        <span class="modal-stat">
          <strong>${jugados}</strong>/${total} jugados
        </span>
      </div>
      
      <div class="modal-fixture-list">
        ${cola.length === 0 ? '<p class="modal-empty">¡Todos los partidos jugados!</p>' : ''}
        ${cola.map((p, idx) => {
          const grupo = p.grupos?.nombre || '?';
          const grupoIndex = Math.min(Math.max(0, gruposOrdenados.indexOf(grupo)), 3);
          const nombreA = p.pareja_a?.nombre || '—';
          const nombreB = p.pareja_b?.nombre || '—';
          const ronda = p.ronda ?? '?';
          
          return `
            <div class="modal-fixture-item">
              <span class="modal-fixture-pos">${idx + 1}</span>
              <span class="modal-fixture-grupo grupo-${grupoIndex}">G${escapeHtml(grupo)}</span>
              <span class="modal-fixture-ronda">R${ronda}</span>
              <span class="modal-fixture-equipos">
                ${escapeHtml(nombreA)} <span class="vs">vs</span> ${escapeHtml(nombreB)}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  container.innerHTML = html;

  if (cache.partidosCopa && cache.partidosCopa.length > 0) {
    const copaMap = Object.fromEntries((cache.copas || []).map(c => [c.id, c.nombre]));
    container.insertAdjacentHTML('beforeend', renderCopasEnModal(cache.partidosCopa, copaMap));
  }
}

/**
 * Renderiza lista de partidos de un grupo
 * @param {Array} partidos - Lista de partidos del grupo
 * @param {Object|null} identidad - Identidad del jugador (puede ser null)
 * @param {Map} mapaPosiciones - Mapa de ID partido -> posición global
 */
function renderPartidosGrupo(partidos, identidad, mapaPosiciones) {
  if (!partidos.length) {
    return '<p class="modal-empty">Sin partidos</p>';
  }

  // Ordenar por ronda, luego por estado (pendientes primero)
  const ordenados = [...partidos].sort((a, b) => {
    if (a.ronda !== b.ronda) return (a.ronda || 999) - (b.ronda || 999);
    const aJugado = tieneResultado(a) ? 1 : 0;
    const bJugado = tieneResultado(b) ? 1 : 0;
    return aJugado - bJugado;
  });

  return ordenados.map(p => {
    const nombreA = p.pareja_a?.nombre || '—';
    const nombreB = p.pareja_b?.nombre || '—';
    const jugado = tieneResultado(p);
    const ronda = p.ronda ?? '?';
    const esMiPartido = identidad && (p.pareja_a?.id === identidad.parejaId || p.pareja_b?.id === identidad.parejaId);
    const posicionGlobal = mapaPosiciones?.get(p.id);

    return `
      <div class="modal-partido ${jugado ? 'jugado' : 'pendiente'} ${esMiPartido ? 'es-mio' : ''}">
        ${posicionGlobal ? `<span class="modal-partido-pos">#${posicionGlobal}</span>` : ''}
        <span class="modal-partido-ronda">R${ronda}</span>
        <span class="modal-partido-equipos">
          ${escapeHtml(nombreA)} <span class="vs">vs</span> ${escapeHtml(nombreB)}
        </span>
        <span class="modal-partido-resultado">
          ${jugado ? formatearResultado(p) : 'Pendiente'}
        </span>
      </div>
    `;
  }).join('');
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
 * Invalida el cache para forzar recarga
 */
export function invalidarCache() {
  modalState.cache = null;
}

/**
 * Verifica si el modal está abierto
 */
export function estaAbierto() {
  return modalState.isOpen;
}
