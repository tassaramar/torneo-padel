/**
 * Módulo de UI para identificación de pareja
 * Maneja las pantallas de búsqueda, selección y confirmación
 */

import {
  parseJugadores,
  saveIdentidad,
  clearIdentidad,
  generarOpcionesCompanero
} from './identidad.js';

let state = {
  jugadores: [],
  selectedJugador: null,
  onComplete: null,
  containerId: 'app', // Puede ser 'app' (carga) o 'viewer-content' (viewer)
  supabase: null // Cliente de Supabase para tracking
};

/**
 * Inicializa el flujo de identificación
 * @param {Array} parejas - Array de parejas del torneo
 * @param {Function} onComplete - Callback cuando se completa la identificación
 * @param {String} containerId - ID del contenedor donde renderizar (default: 'app')
 * @param {Object} supabase - Cliente de Supabase (opcional, para tracking)
 */
export function iniciarIdentificacion(parejas, onComplete, containerId = 'app', supabase = null) {
  state.jugadores = parseJugadores(parejas);
  state.onComplete = onComplete;
  state.containerId = containerId;
  state.supabase = supabase; // Guardar para tracking
  
  mostrarPantallaBusqueda();
}

/**
 * Resetea la identificación (para "Elegir otra pareja")
 */
export function resetearIdentificacion() {
  clearIdentidad();
  state.selectedJugador = null;
}

/**
 * Muestra la pantalla de búsqueda de jugador
 */
function mostrarPantallaBusqueda() {
  const app = document.getElementById(state.containerId);
  if (!app) {
    console.error(`No se encontró el elemento #${state.containerId}`);
    return;
  }
  
  app.innerHTML = `
    <div class="identificacion-container">
      <h1>¡Bienvenido al torneo Swing Padel: Segundo Saque! 🎾</h1>
      <p class="subtitle">Para ver tus partidos, primero necesitamos saber quién sos</p>
      
      <div class="card">
        <div class="helper-text" style="margin-bottom: 12px; color: var(--muted); font-size: 14px;">
          💡 Tu nombre como figura en el fixture
        </div>
        <input 
          type="search" 
          id="search-input" 
          class="identificacion-input"
          placeholder="Empezá a escribir tu nombre..."
          autocomplete="off"
        />
        
        <div id="results" class="results-list"></div>
      </div>
    </div>
  `;
  
  const input = document.getElementById('search-input');
  input.addEventListener('input', (e) => buscarJugador(e.target.value));
  input.focus();
}

/**
 * Busca jugadores que coincidan con el query
 */
function buscarJugador(query) {
  const results = document.getElementById('results');
  const q = query.trim().toLowerCase();
  
  if (!q) {
    results.innerHTML = '';
    return;
  }
  
  const matches = state.jugadores.filter(j => 
    j.nombreBusqueda.includes(q)
  );
  
  if (matches.length === 0) {
    results.innerHTML = `
      <div class="no-results">
        No encontramos ese nombre 🤔<br>
        <small style="font-size: 13px; display: block; margin-top: 8px;">
          ¿Probaste con tu nombre completo como figura en el fixture?
        </small>
      </div>
    `;
    return;
  }
  
  results.innerHTML = matches.map(j => `
    <div class="result-item" data-pareja-id="${j.parejaId}" data-nombre="${escapeHtml(j.nombre)}">
      <div class="result-name">${escapeHtml(j.nombre)}</div>
      <div class="result-meta">Grupo ${escapeHtml(j.grupo)} · Pareja #${j.orden}</div>
    </div>
  `).join('');
  
  // Agregar event listeners
  results.querySelectorAll('.result-item').forEach(item => {
    item.addEventListener('click', () => {
      seleccionarJugador(item.dataset.parejaId, item.dataset.nombre);
    });
  });
}

/**
 * Selecciona un jugador y muestra opciones de compañero
 */
function seleccionarJugador(parejaId, nombre) {
  state.selectedJugador = state.jugadores.find(j => 
    j.parejaId === parejaId && j.nombre === nombre
  );
  
  if (!state.selectedJugador) return;
  
  mostrarPantallaCompanero();
}

/**
 * Muestra la pantalla de selección de compañero
 */
function mostrarPantallaCompanero() {
  const app = document.getElementById(state.containerId);
  if (!app) {
    console.error(`No se encontró el elemento #${state.containerId}`);
    return;
  }
  
  const opciones = generarOpcionesCompanero(
    state.selectedJugador.companero,
    state.selectedJugador.nombre,
    state.jugadores
  );
  
  app.innerHTML = `
    <div class="identificacion-container">
      <h1>Perfecto, ${escapeHtml(state.selectedJugador.nombre)}! 👋</h1>
      <p class="subtitle">Última pregunta: ¿Quién es tu compañero de pareja?</p>
      
      <div class="card">
        <div class="helper-text" style="margin-bottom: 12px; color: var(--muted); font-size: 14px; text-align: center;">
          Esto nos ayuda a confirmar tu identidad
        </div>
        <div class="options-grid">
          ${opciones.map(opt => `
            <button class="option-btn" data-nombre="${escapeHtml(opt.nombre)}" data-correcto="${opt.correcto}">
              ${escapeHtml(opt.nombre)}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  // Event listeners
  app.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      seleccionarCompanero(btn.dataset.nombre, btn.dataset.correcto === 'true');
    });
  });
}

/**
 * Procesa la selección de compañero
 */
function seleccionarCompanero(nombreCompanero, esCorrecto) {
  if (esCorrecto) {
    // ¡ÉXITO!
    const identidad = {
      parejaId: state.selectedJugador.parejaId,
      parejaNombre: state.selectedJugador.parejaNombre,
      miNombre: state.selectedJugador.nombre,
      companero: nombreCompanero,
      grupo: state.selectedJugador.grupo,
      orden: state.selectedJugador.orden
    };
    
    // Guardar identidad con tracking automático
    saveIdentidad(identidad, state.supabase);
    mostrarPantallaExito(identidad);
  } else {
    // ERROR
    mostrarPantallaError(nombreCompanero);
  }
}

/**
 * Muestra pantalla de éxito
 */
function mostrarPantallaExito(identidad) {
  const app = document.getElementById(state.containerId);
  if (!app) {
    console.error(`No se encontró el elemento #${state.containerId}`);
    return;
  }
  
  app.innerHTML = `
    <div class="identificacion-container">
      <div class="card">
        <div class="success-icon">✅</div>
        <div class="success-message">
          <div class="success-title">¡Perfecto! Ya estás dentro del torneo 🎾</div>
          <div class="success-details" style="font-size: 15px; font-weight: 600; color: var(--primary-900); margin: 8px 0;">
            Swing Padel: Segundo Saque
          </div>
          <div class="success-details">Identificado como:</div>
          <div class="pareja-name">${escapeHtml(identidad.parejaNombre)}</div>
          <div class="success-details">Grupo ${escapeHtml(identidad.grupo)} · Pareja #${identidad.orden}</div>
        </div>
        <div class="success-button">
          <button class="btn-primary" id="btn-continuar">Continuar →</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('btn-continuar').addEventListener('click', () => {
    if (state.onComplete) {
      state.onComplete(identidad);
    }
  });
}

/**
 * Muestra pantalla de error
 */
function mostrarPantallaError(nombreCompaneroIncorrecto) {
  const app = document.getElementById(state.containerId);
  if (!app) {
    console.error(`No se encontró el elemento #${state.containerId}`);
    return;
  }
  
  const combination = `${state.selectedJugador.nombre} - ${nombreCompaneroIncorrecto}`;
  
  app.innerHTML = `
    <div class="identificacion-container">
      <div class="card">
        <div class="error-icon">🤔</div>
        <div class="error-message">
          <div class="error-title">Mmm... algo no cierra</div>
          <div class="error-text">
            La pareja <strong>${escapeHtml(combination)}</strong> no coincide con nuestros registros.
            <br><br>
            ¿Puede ser que te confundiste de compañero?
          </div>
        </div>
        
        <div class="helper-text">¿Qué querés hacer?</div>
        
        <div class="error-buttons">
          <button class="btn-primary" id="btn-reintentar">
            🔄 Elegir otro compañero
          </button>
          
          <button class="btn-secondary" id="btn-no-soy">
            ❌ No soy ${escapeHtml(state.selectedJugador.nombre)}
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('btn-reintentar').addEventListener('click', () => {
    mostrarPantallaCompanero();
  });
  
  document.getElementById('btn-no-soy').addEventListener('click', () => {
    state.selectedJugador = null;
    mostrarPantallaBusqueda();
  });
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
