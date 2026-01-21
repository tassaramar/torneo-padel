/**
 * Renderiza el feed de actividad reciente
 */

export function renderActivityFeed(container, actividadData) {
  if (!container) return;

  if (!actividadData.ok || !actividadData.eventos?.length) {
    container.innerHTML = '<div class="no-data">No hay actividad reciente para mostrar</div>';
    return;
  }

  const { eventos } = actividadData;

  // Formatear fecha relativa
  function formatRelativeTime(isoDate) {
    const fecha = new Date(isoDate);
    const ahora = new Date();
    const diffMs = ahora - fecha;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHoras = Math.floor(diffMs / 3600000);
    const diffDias = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHoras < 24) return `hace ${diffHoras}h`;
    if (diffDias === 1) return 'ayer';
    if (diffDias < 7) return `hace ${diffDias} días`;
    return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }

  // Obtener emoji y descripción según tipo de evento
  function getEventoInfo(evento) {
    const parejaNombre = evento.metadata?.pareja_nombre || '';
    const resultado = evento.metadata?.resultado || '';
    
    switch (evento.tipo_evento) {
      case 'visita':
        return {
          emoji: '👀',
          descripcion: `visitó la app`,
          clase: 'evento-visita'
        };
      case 'carga_resultado':
        return {
          emoji: '✍️',
          descripcion: `cargó resultado ${resultado ? `(${resultado})` : ''}`,
          clase: 'evento-carga'
        };
      default:
        return {
          emoji: '📝',
          descripcion: 'realizó una acción',
          clase: 'evento-otro'
        };
    }
  }

  // Construir HTML del feed
  const feedHTML = `
    <div class="activity-feed">
      ${eventos.map(evento => {
        const info = getEventoInfo(evento);
        const parejaNombre = evento.metadata?.pareja_nombre || '';
        
        return `
          <div class="activity-item ${info.clase}">
            <div class="activity-emoji">${info.emoji}</div>
            <div class="activity-content">
              <div class="activity-main">
                <strong>${escapeHtml(evento.jugador_nombre)}</strong>
                ${parejaNombre ? `<span class="activity-pareja">(${escapeHtml(parejaNombre)})</span>` : ''}
                <span class="activity-desc">${info.descripcion}</span>
              </div>
              <div class="activity-time">${formatRelativeTime(evento.created_at)}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.innerHTML = feedHTML;
}

function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
