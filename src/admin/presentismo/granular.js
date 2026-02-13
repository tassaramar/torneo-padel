/**
 * Control granular de presentismo (jugador por jugador)
 */

import { supabase, TORNEO_ID, logMsg, el } from '../context.js';
import { marcarPresente, desmarcarPresente, marcarAmbosPresentes, desmarcarTodos } from '../../viewer/presentismo.js';
import { refreshTodasLasVistas } from './index.js';
import { showToast } from '../../utils/toast.js';

let parejasCache = [];
let gruposCache = [];
let filtrosActivos = new Set(); // Multi-select filters (can have multiple active)
let busquedaActual = '';

export async function initControlGranular() {
  // Cargar datos
  await cargarDatos();

  // Setup búsqueda
  const searchInput = document.getElementById('parejas-search');
  searchInput.addEventListener('input', (e) => {
    busquedaActual = normalizar(e.target.value);
    renderParejas();
  });

  // Setup filtros (toggleable multi-select)
  const botonesFiltro = document.querySelectorAll('.segmented__btn');
  botonesFiltro.forEach(btn => {
    btn.addEventListener('click', () => {
      const filtro = btn.dataset.filtro;

      if (filtro === 'todas') {
        // "Todas" clears all filters
        filtrosActivos.clear();
        botonesFiltro.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      } else {
        // Toggle this specific filter
        if (filtrosActivos.has(filtro)) {
          filtrosActivos.delete(filtro);
          btn.classList.remove('is-active');
        } else {
          filtrosActivos.add(filtro);
          btn.classList.add('is-active');
        }

        // Deactivate "todas" if any specific filter is active
        const btnTodas = document.querySelector('[data-filtro="todas"]');
        if (btnTodas) btnTodas.classList.remove('is-active');
      }

      // If no filters active, activate "todas" automatically
      if (filtrosActivos.size === 0) {
        const btnTodas = document.querySelector('[data-filtro="todas"]');
        if (btnTodas) btnTodas.classList.add('is-active');
      }

      renderParejas();
    });
  });

  // Botón refresh
  const btnRefresh = document.getElementById('refresh-parejas');
  btnRefresh.addEventListener('click', async () => {
    logMsg('Refrescando vista...');
    await refreshParejas();
    logMsg('✅ Vista actualizada');
  });

  // Render inicial
  await renderParejas();
}

export async function refreshParejas() {
  await cargarDatos();
  await renderParejas();
}

async function cargarDatos() {
  const { data: parejas, error: errorParejas } = await supabase
    .from('parejas')
    .select('id, nombre, presentes, grupo_id')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errorParejas) {
    console.error('Error cargando parejas:', errorParejas);
    logMsg('❌ Error cargando parejas');
    return;
  }

  const { data: grupos, error: errorGrupos } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errorGrupos) {
    console.error('Error cargando grupos:', errorGrupos);
    return;
  }

  parejasCache = parejas || [];
  gruposCache = grupos || [];
}

async function renderParejas() {
  const container = document.getElementById('parejas-container');

  if (parejasCache.length === 0) {
    container.innerHTML = '<p class="helper">No hay parejas para mostrar</p>';
    return;
  }

  // Crear mapa de grupos
  const gruposMap = new Map(gruposCache.map(g => [g.id, g]));

  // Filtrar parejas
  let parejasFiltradas = parejasCache.filter(p => {
    // Aplicar búsqueda
    if (busquedaActual) {
      const nombreNorm = normalizar(p.nombre);
      if (!nombreNorm.includes(busquedaActual)) {
        return false;
      }
    }

    // Aplicar filtros por estado (multi-select: OR logic)
    if (filtrosActivos.size > 0) {
      const [nombre1, nombre2] = p.nombre.split(' - ').map(s => s.trim());
      const presentes = p.presentes || [];
      const presente1 = presentes.includes(nombre1);
      const presente2 = presentes.includes(nombre2);

      let matchAnyFilter = false;

      if (filtrosActivos.has('completas') && presente1 && presente2) {
        matchAnyFilter = true;
      }
      if (filtrosActivos.has('incompletas') && (presente1 !== presente2)) {
        matchAnyFilter = true;
      }
      if (filtrosActivos.has('ausentes') && !presente1 && !presente2) {
        matchAnyFilter = true;
      }

      if (!matchAnyFilter) return false;
    }

    return true;
  });

  if (parejasFiltradas.length === 0) {
    container.innerHTML = '<p class="helper">No hay parejas que coincidan con el filtro</p>';
    return;
  }

  // Renderizar cards
  container.innerHTML = parejasFiltradas.map(p => {
    const grupo = gruposMap.get(p.grupo_id);
    return renderParejaCard(p, grupo);
  }).join('');
}

function renderParejaCard(pareja, grupo) {
  const [nombre1, nombre2] = pareja.nombre.split(' - ').map(s => s.trim());
  const presentes = pareja.presentes || [];
  const presente1 = presentes.includes(nombre1);
  const presente2 = presentes.includes(nombre2);

  const estadoBadge =
    (presente1 && presente2) ? '🟢' :
    (!presente1 && !presente2) ? '🔴' : '🟡';

  const grupoNombre = grupo ? grupo.nombre : '?';

  // Add presentismo-incomplete class if not all players are present
  const incompleteClass = (presente1 && presente2) ? '' : 'presentismo-incomplete';

  return `
    <div class="pareja-card ${incompleteClass}" data-pareja-id="${pareja.id}">
      <div class="pareja-header">
        <span class="pareja-badge">${estadoBadge}</span>
        <span class="pareja-grupo">Grupo ${grupoNombre}</span>
      </div>
      <div class="pareja-nombre">${pareja.nombre}</div>
      <div class="pareja-jugadores">
        <button class="jugador-toggle ${presente1 ? 'presente' : 'ausente'}"
                data-pareja-id="${pareja.id}"
                data-nombre="${nombre1}"
                onclick="window.toggleJugadorPresentismo(event, '${pareja.id}', '${nombre1}')">
          ${presente1 ? '✅' : '❌'} ${nombre1}
        </button>
        <button class="jugador-toggle ${presente2 ? 'presente' : 'ausente'}"
                data-pareja-id="${pareja.id}"
                data-nombre="${nombre2}"
                onclick="window.toggleJugadorPresentismo(event, '${pareja.id}', '${nombre2}')">
          ${presente2 ? '✅' : '❌'} ${nombre2}
        </button>
      </div>
      <div class="pareja-actions">
        ${(!presente1 || !presente2) ?
          `<button class="btn-small" onclick="window.marcarAmbosPresentes('${pareja.id}', '${nombre1}', '${nombre2}')">Ambos ✅</button>` : ''}
        ${(presente1 || presente2) ?
          `<button class="btn-small btn-danger" onclick="window.limpiarPareja('${pareja.id}')">Limpiar</button>` : ''}
      </div>
    </div>
  `;
}

// Helper: actualizar visibilidad de botones "Ambos" y "Limpiar" reactivamente
function actualizarBotonesAcciones(parejaId) {
  const card = document.querySelector(`[data-pareja-id="${parejaId}"]`);
  if (!card) return;

  const toggles = card.querySelectorAll('.jugador-toggle');
  if (toggles.length !== 2) return;

  const presente1 = toggles[0].classList.contains('presente');
  const presente2 = toggles[1].classList.contains('presente');

  // Actualizar badge de estado
  const badge = card.querySelector('.pareja-badge');
  if (badge) {
    if (presente1 && presente2) {
      badge.textContent = '🟢';
      card.classList.remove('presentismo-incomplete');
    } else if (!presente1 && !presente2) {
      badge.textContent = '🔴';
      card.classList.add('presentismo-incomplete');
    } else {
      badge.textContent = '🟡';
      card.classList.add('presentismo-incomplete');
    }
  }

  const actionsContainer = card.querySelector('.pareja-actions');
  if (!actionsContainer) return;

  // Limpiar contenedor
  actionsContainer.innerHTML = '';

  // Botón "Ambos ✅" si al menos uno está ausente
  if (!presente1 || !presente2) {
    const nombre1 = toggles[0].dataset.nombre;
    const nombre2 = toggles[1].dataset.nombre;
    const btnAmbos = document.createElement('button');
    btnAmbos.className = 'btn-small';
    btnAmbos.textContent = 'Ambos ✅';
    btnAmbos.onclick = () => window.marcarAmbosPresentes(parejaId, nombre1, nombre2);
    actionsContainer.appendChild(btnAmbos);
  }

  // Botón "Limpiar" si al menos uno está presente
  if (presente1 || presente2) {
    const btnLimpiar = document.createElement('button');
    btnLimpiar.className = 'btn-small btn-danger';
    btnLimpiar.textContent = 'Limpiar';
    btnLimpiar.onclick = () => window.limpiarPareja(parejaId);
    actionsContainer.appendChild(btnLimpiar);
  }
}

// Exponer funciones globales
window.toggleJugadorPresentismo = async function(event, parejaId, nombre) {
  event.preventDefault();
  const btn = event.target;
  const estaPresente = btn.classList.contains('presente');

  // OPTIMISTIC UI: Update immediately before backend responds
  if (estaPresente) {
    btn.classList.remove('presente');
    btn.classList.add('ausente');
    btn.textContent = `❌ ${nombre}`;
  } else {
    btn.classList.remove('ausente');
    btn.classList.add('presente');
    btn.textContent = `✅ ${nombre}`;
  }

  // Actualizar botones reactivamente
  actualizarBotonesAcciones(parejaId);

  // Call backend
  let success;
  if (estaPresente) {
    success = await desmarcarPresente(parejaId, nombre);
  } else {
    success = await marcarPresente(parejaId, nombre);
  }

  if (success) {
    logMsg(`${estaPresente ? '❌' : '✅'} ${nombre} ${estaPresente ? 'desmarcado' : 'marcado'} como presente`);
    await refreshTodasLasVistas();
  } else {
    // ROLLBACK: Revert immediate UI + refresh all views for consistency
    if (estaPresente) {
      btn.classList.remove('ausente');
      btn.classList.add('presente');
      btn.textContent = `✅ ${nombre}`;
    } else {
      btn.classList.remove('presente');
      btn.classList.add('ausente');
      btn.textContent = `❌ ${nombre}`;
    }
    actualizarBotonesAcciones(parejaId); // Revert button visibility
    logMsg(`❌ Error al cambiar estado de ${nombre}`);
    showToast(`Error al cambiar estado de ${nombre}`, 'error');
    await refreshTodasLasVistas();
  }
};

window.marcarAmbosPresentes = async function(parejaId, nombre1, nombre2) {
  const card = document.querySelector(`[data-pareja-id="${parejaId}"]`);
  if (!card) return;

  const toggles = card.querySelectorAll('.jugador-toggle');
  if (toggles.length !== 2) return;

  // Capturar estados anteriores para rollback
  const estadoAnterior1 = toggles[0].classList.contains('presente');
  const estadoAnterior2 = toggles[1].classList.contains('presente');

  // OPTIMISTIC UI: Marcar ambos como presentes inmediatamente
  toggles[0].classList.remove('ausente');
  toggles[0].classList.add('presente');
  toggles[0].textContent = `✅ ${nombre1}`;

  toggles[1].classList.remove('ausente');
  toggles[1].classList.add('presente');
  toggles[1].textContent = `✅ ${nombre2}`;

  // Actualizar botones reactivamente
  actualizarBotonesAcciones(parejaId);

  // Backend call
  const success = await marcarAmbosPresentes(parejaId, nombre1, nombre2);

  if (success) {
    logMsg(`✅ Pareja completa: ${nombre1} y ${nombre2}`);
    await refreshTodasLasVistas();
  } else {
    // ROLLBACK: Revert + Notify + Refresh
    if (!estadoAnterior1) {
      toggles[0].classList.remove('presente');
      toggles[0].classList.add('ausente');
      toggles[0].textContent = `❌ ${nombre1}`;
    }
    if (!estadoAnterior2) {
      toggles[1].classList.remove('presente');
      toggles[1].classList.add('ausente');
      toggles[1].textContent = `❌ ${nombre2}`;
    }
    actualizarBotonesAcciones(parejaId);
    logMsg(`❌ Error al marcar pareja`);
    showToast('Error al marcar pareja como presente', 'error');
    await refreshTodasLasVistas();
  }
};

window.limpiarPareja = async function(parejaId) {
  const card = document.querySelector(`[data-pareja-id="${parejaId}"]`);
  if (!card) return;

  const toggles = card.querySelectorAll('.jugador-toggle');
  if (toggles.length !== 2) return;

  const nombre1 = toggles[0].dataset.nombre;
  const nombre2 = toggles[1].dataset.nombre;

  // Capturar estados anteriores para rollback
  const estadoAnterior1 = toggles[0].classList.contains('presente');
  const estadoAnterior2 = toggles[1].classList.contains('presente');

  // OPTIMISTIC UI: Marcar ambos como ausentes inmediatamente
  toggles[0].classList.remove('presente');
  toggles[0].classList.add('ausente');
  toggles[0].textContent = `❌ ${nombre1}`;

  toggles[1].classList.remove('presente');
  toggles[1].classList.add('ausente');
  toggles[1].textContent = `❌ ${nombre2}`;

  // Actualizar botones reactivamente
  actualizarBotonesAcciones(parejaId);

  // Backend call
  const success = await desmarcarTodos(parejaId);

  if (success) {
    logMsg(`🧹 Pareja limpiada`);
    await refreshTodasLasVistas();
  } else {
    // ROLLBACK: Revert + Notify + Refresh
    if (estadoAnterior1) {
      toggles[0].classList.remove('ausente');
      toggles[0].classList.add('presente');
      toggles[0].textContent = `✅ ${nombre1}`;
    }
    if (estadoAnterior2) {
      toggles[1].classList.remove('ausente');
      toggles[1].classList.add('presente');
      toggles[1].textContent = `✅ ${nombre2}`;
    }
    actualizarBotonesAcciones(parejaId);
    logMsg(`❌ Error al limpiar pareja`);
    showToast('Error al limpiar pareja', 'error');
    await refreshTodasLasVistas();
  }
};

function normalizar(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
