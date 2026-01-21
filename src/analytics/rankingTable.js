/**
 * Renderiza la tabla de ranking de actividad
 */

export function renderRankingTable(container, rankingData, state) {
  if (!container) return;

  if (!rankingData.ok || !rankingData.ranking?.length) {
    container.innerHTML = '<div class="no-data">No hay datos de ranking para mostrar</div>';
    return;
  }

  const { ranking } = rankingData;

  // Filtrar por búsqueda si existe
  const searchQuery = (state.searchQuery || '').toLowerCase().trim();
  const filtered = searchQuery
    ? ranking.filter(j => 
        j.jugador_nombre.toLowerCase().includes(searchQuery) ||
        j.pareja_nombre.toLowerCase().includes(searchQuery) ||
        j.grupo.toLowerCase().includes(searchQuery)
      )
    : ranking;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="no-data">No hay coincidencias con la búsqueda</div>';
    return;
  }

  // Determinar nivel de actividad
  function getActivityLevel(total) {
    if (total >= 10) return { emoji: '🔥', label: 'Muy activo', class: 'high' };
    if (total >= 5) return { emoji: '✅', label: 'Activo', class: 'medium' };
    if (total >= 2) return { emoji: '👀', label: 'Moderado', class: 'low' };
    return { emoji: '⚠️', label: 'Bajo', class: 'very-low' };
  }

  // Formatear fecha relativa
  function formatRelativeTime(isoDate) {
    const fecha = new Date(isoDate);
    const ahora = new Date();
    const diffMs = ahora - fecha;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHoras = Math.floor(diffMs / 3600000);
    const diffDias = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHoras < 24) return `Hace ${diffHoras}h`;
    if (diffDias === 1) return 'Ayer';
    return `Hace ${diffDias} días`;
  }

  // Construir HTML de la tabla
  const tableHTML = `
    <table class="ranking-table">
      <thead>
        <tr>
          <th class="rank-col">#</th>
          <th class="status-col"></th>
          <th class="jugador-col">Jugador</th>
          <th class="pareja-col">Pareja</th>
          <th class="grupo-col">Grupo</th>
          <th class="visitas-col">Visitas</th>
          <th class="cargas-col">Resultados</th>
          <th class="total-col">Total</th>
          <th class="ultima-col">Última Actividad</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map((jugador, index) => {
          const activity = getActivityLevel(jugador.total);
          return `
            <tr class="ranking-row activity-${activity.class}">
              <td class="rank-col">${index + 1}</td>
              <td class="status-col" title="${activity.label}">${activity.emoji}</td>
              <td class="jugador-col">
                <strong>${escapeHtml(jugador.jugador_nombre)}</strong>
              </td>
              <td class="pareja-col">${escapeHtml(jugador.pareja_nombre || '-')}</td>
              <td class="grupo-col">Grupo ${escapeHtml(jugador.grupo || '?')}</td>
              <td class="visitas-col">${jugador.visitas}</td>
              <td class="cargas-col">${jugador.cargas}</td>
              <td class="total-col"><strong>${jugador.total}</strong></td>
              <td class="ultima-col">${formatRelativeTime(jugador.ultima_actividad)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  container.innerHTML = tableHTML;
}

function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
