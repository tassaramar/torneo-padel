/**
 * Punto de entrada del dashboard de analytics
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { 
  getActivityStats, 
  getTimelineData, 
  getRankingActividad, 
  getActividadReciente 
} from './tracking/trackingService.js';
import { renderStatsCards } from './analytics/statsCards.js';
import { renderTimeline } from './analytics/timeline.js';
import { renderRankingTable } from './analytics/rankingTable.js';
import { renderActivityFeed } from './analytics/activityList.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Estado global
const state = {
  periodo: 30, // días por defecto
  searchQuery: ''
};

/**
 * Carga y renderiza todos los datos del dashboard
 */
async function loadDashboard() {
  const statusEl = document.getElementById('analytics-status');
  
  try {
    if (statusEl) statusEl.textContent = 'Cargando datos...';

    // Cargar datos en paralelo
    const [stats, timeline, ranking, actividad] = await Promise.all([
      getActivityStats(supabase, state.periodo),
      getTimelineData(supabase, state.periodo),
      getRankingActividad(supabase, state.periodo),
      getActividadReciente(supabase, 50)
    ]);

    // Verificar errores
    if (!stats.ok || !timeline.ok || !ranking.ok || !actividad.ok) {
      throw new Error('Error cargando alguno de los datos');
    }

    // Renderizar componentes
    renderStatsCards(document.getElementById('stats-cards'), stats);
    renderTimeline(document.getElementById('timeline-container'), timeline);
    renderRankingTable(document.getElementById('ranking-container'), ranking, state);
    renderActivityFeed(document.getElementById('activity-feed'), actividad);

    if (statusEl) statusEl.textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
    
  } catch (error) {
    console.error('Error cargando dashboard:', error);
    if (statusEl) statusEl.textContent = '❌ Error cargando datos. Ver consola.';
  }
}

/**
 * Inicializa el dashboard
 */
function init() {
  // Selector de periodo
  const periodoSelect = document.getElementById('periodo-select');
  periodoSelect?.addEventListener('change', (e) => {
    state.periodo = parseInt(e.target.value);
    loadDashboard();
  });

  // Botón de refresh
  const refreshBtn = document.getElementById('refresh-analytics');
  refreshBtn?.addEventListener('click', () => loadDashboard());

  // Búsqueda en ranking
  const searchInput = document.getElementById('ranking-search');
  searchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    // Re-renderizar solo la tabla (usando estado en cache)
    // Por simplicidad, re-cargamos todo
    loadDashboard();
  });

  // Carga inicial
  loadDashboard();

  // Auto-refresh cada 60 segundos
  setInterval(() => {
    console.log('[Analytics] Auto-refresh...');
    loadDashboard();
  }, 60000);
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
