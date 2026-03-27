import { createClient } from '@supabase/supabase-js';
import {
  cargarDatosConsulta,
  renderTabs,
  renderGrupos,
  renderCopas,
  renderFixture
} from './viewer/renderConsulta.js';
import { tieneResultado } from './utils/formatoResultado.js';
import { obtenerTorneoActivo } from './utils/torneoActivo.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

let TORNEO_ID = null;

const tabsEl = document.getElementById('tabs-main');
const contentEl = document.getElementById('viewer-content');
const statusEl = document.getElementById('viewer-status');
const navEl = document.getElementById('viewer-nav-buttons');

function leerIdentidad() {
  try {
    const raw = localStorage.getItem('torneo_identidad');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.parejaId) return null;
    return data;
  } catch {
    return null;
  }
}

const state = {
  activeTab: 'grupos',
  activeSubTab: null,
  cache: null,
  identidad: leerIdentidad(),
  supabase,
  torneoId: TORNEO_ID
};

const POLLING_MS = 30000;
let pollingInterval = null;

function setStatus(txt) {
  if (statusEl) statusEl.textContent = txt;
}

function nowStr() {
  return new Date().toLocaleTimeString();
}

async function onTabChange(tabId) {
  state.activeTab = tabId;
  if (tabsEl) renderTabs(tabsEl, state, onTabChange);
  await renderContenido();
}

async function renderContenido() {
  if (!contentEl) return;
  switch (state.activeTab) {
    case 'grupos':  await renderGrupos(contentEl, state); break;
    case 'copas':   renderCopas(contentEl, state); break;
    case 'fixture': renderFixture(contentEl, state); break;
  }
}

function renderNavButtons() {
  if (!navEl) return;
  if (state.identidad) {
    navEl.innerHTML = `<a href="/index.html" class="btn-action-primary"><span class="btn-icon">👤</span><span class="btn-text">Volvé a tus partidos</span></a>`;
  } else {
    navEl.innerHTML = `<a href="/index.html" class="btn-action-primary"><span class="btn-icon">🎾</span><span class="btn-text">Identificarme</span></a>`;
  }
}

async function init() {
  try {
    setStatus('Cargando…');
    state.cache = await cargarDatosConsulta(supabase, TORNEO_ID);

    // Tab inteligente: si el jugador no tiene partidos de grupo pendientes, ir a Copas o Fixture
    if (state.identidad && state.cache) {
      const misPendientesGrupo = (state.cache.partidos || []).filter(p =>
        !tieneResultado(p) &&
        (p.pareja_a_id === state.identidad.parejaId || p.pareja_b_id === state.identidad.parejaId)
      );
      if (misPendientesGrupo.length === 0) {
        const hayCopas = state.cache.copas?.length > 0 && state.cache.partidosCopa?.length > 0;
        state.activeTab = hayCopas ? 'copas' : 'fixture';
      }
    }

    setStatus(`Actualizado ${nowStr()}`);
    if (tabsEl) renderTabs(tabsEl, state, onTabChange);
    await renderContenido();
    renderNavButtons();
  } catch (e) {
    console.error(e);
    setStatus('❌ Error cargando');
    if (contentEl) contentEl.innerHTML = '<p class="modal-empty">Error al cargar. Intenta recargar la página.</p>';
  }
}

function stopPolling() {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
}

function startPolling() {
  stopPolling();
  pollingInterval = setInterval(async () => {
    try {
      const newCache = await cargarDatosConsulta(supabase, TORNEO_ID);
      // Preservar standings previos para evitar flash "Cargando..." en tab General
      newCache.standings = state.cache?.standings || null;
      state.cache = newCache;
      setStatus(`Actualizado ${nowStr()}`);
      if (tabsEl) renderTabs(tabsEl, state, onTabChange);
      await renderContenido();
    } catch (e) {
      console.error('[Polling] Error:', e);
    }
  }, POLLING_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else {
    startPolling();
  }
});

async function bootstrap() {
  TORNEO_ID = await obtenerTorneoActivo(supabase);
  if (!TORNEO_ID) {
    if (contentEl) contentEl.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;color:#6b7280;">
        <p style="font-size:1.5rem;margin-bottom:0.5rem;">No hay torneo en curso</p>
        <p>Cuando el organizador active un torneo, vas a poder verlo acá.</p>
      </div>`;
    return;
  }
  state.torneoId = TORNEO_ID;
  await init();
  startPolling();
}
bootstrap();
