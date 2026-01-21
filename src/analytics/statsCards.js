/**
 * Renderiza las tarjetas de estadísticas principales
 */

export function renderStatsCards(container, stats) {
  if (!container) return;

  if (!stats.ok) {
    container.innerHTML = '<div class="error">Error cargando estadísticas</div>';
    return;
  }

  const { totales, promedios, periodo } = stats;

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-icon">👥</div>
      <div class="stat-card-value">${totales.jugadores_activos}</div>
      <div class="stat-card-label">Jugadores Activos</div>
      <div class="stat-card-sublabel">${periodo.diasAtras} días</div>
    </div>

    <div class="stat-card">
      <div class="stat-card-icon">👀</div>
      <div class="stat-card-value">${totales.visitas}</div>
      <div class="stat-card-label">Visitas Totales</div>
      <div class="stat-card-sublabel">${periodo.diasAtras} días</div>
    </div>

    <div class="stat-card">
      <div class="stat-card-icon">✍️</div>
      <div class="stat-card-value">${totales.cargas}</div>
      <div class="stat-card-label">Resultados Cargados</div>
      <div class="stat-card-sublabel">${periodo.diasAtras} días</div>
    </div>

    <div class="stat-card">
      <div class="stat-card-icon">📊</div>
      <div class="stat-card-value">${promedios.visitas_por_jugador}</div>
      <div class="stat-card-label">Promedio Visitas/Jugador</div>
      <div class="stat-card-sublabel">${periodo.diasAtras} días</div>
    </div>

    <div class="stat-card">
      <div class="stat-card-icon">🎾</div>
      <div class="stat-card-value">${totales.parejas_activas}</div>
      <div class="stat-card-label">Parejas Activas</div>
      <div class="stat-card-sublabel">${periodo.diasAtras} días</div>
    </div>

    <div class="stat-card">
      <div class="stat-card-icon">🔥</div>
      <div class="stat-card-value">${totales.eventos}</div>
      <div class="stat-card-label">Eventos Totales</div>
      <div class="stat-card-sublabel">${periodo.diasAtras} días</div>
    </div>
  `;
}
