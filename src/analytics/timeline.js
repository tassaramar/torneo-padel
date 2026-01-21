/**
 * Renderiza el timeline de actividad (gráfico simple con Canvas API)
 */

export function renderTimeline(container, timelineData) {
  if (!container) return;

  if (!timelineData.ok || !timelineData.timeline?.length) {
    container.innerHTML = '<div class="no-data">No hay datos de actividad para mostrar</div>';
    return;
  }

  const { timeline } = timelineData;

  // Crear canvas
  container.innerHTML = '<canvas id="timeline-canvas" width="800" height="300"></canvas>';
  
  const canvas = document.getElementById('timeline-canvas');
  if (!canvas) return;

  // Ajustar al contenedor
  const rect = container.getBoundingClientRect();
  canvas.width = Math.max(rect.width - 40, 600);
  canvas.height = 300;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Configuración
  const padding = { top: 30, right: 30, bottom: 50, left: 50 };
  const chartWidth = canvas.width - padding.left - padding.right;
  const chartHeight = canvas.height - padding.top - padding.bottom;

  // Encontrar valores máximos
  const maxValue = Math.max(...timeline.map(d => d.total), 1);

  // Función para mapear datos a coordenadas
  const xStep = chartWidth / (timeline.length - 1 || 1);
  const yScale = chartHeight / maxValue;

  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Fondo
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid horizontal
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();
  }

  // Etiquetas del eje Y
  ctx.fillStyle = '#888';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const value = Math.round(maxValue - (maxValue / 5) * i);
    const y = padding.top + (chartHeight / 5) * i;
    ctx.fillText(value.toString(), padding.left - 10, y + 4);
  }

  // Línea de visitas (azul)
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  timeline.forEach((punto, i) => {
    const x = padding.left + (i * xStep);
    const y = padding.top + chartHeight - (punto.visitas * yScale);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Línea de cargas (verde)
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  timeline.forEach((punto, i) => {
    const x = padding.left + (i * xStep);
    const y = padding.top + chartHeight - (punto.cargas * yScale);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Puntos en las líneas
  timeline.forEach((punto, i) => {
    const x = padding.left + (i * xStep);
    
    // Punto visitas
    const yVisitas = padding.top + chartHeight - (punto.visitas * yScale);
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(x, yVisitas, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Punto cargas
    const yCargas = padding.top + chartHeight - (punto.cargas * yScale);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(x, yCargas, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Etiquetas del eje X (fechas)
  ctx.fillStyle = '#888';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  timeline.forEach((punto, i) => {
    // Mostrar cada N etiquetas para no saturar
    if (i % Math.ceil(timeline.length / 7) === 0 || i === timeline.length - 1) {
      const x = padding.left + (i * xStep);
      const fecha = new Date(punto.fecha);
      const label = `${fecha.getDate()}/${fecha.getMonth() + 1}`;
      ctx.fillText(label, x, canvas.height - padding.bottom + 20);
    }
  });

  // Leyenda
  const legendY = padding.top - 15;
  
  // Visitas
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(padding.left, legendY, 15, 3);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Visitas', padding.left + 20, legendY + 3);
  
  // Cargas
  ctx.fillStyle = '#10b981';
  ctx.fillRect(padding.left + 100, legendY, 15, 3);
  ctx.fillStyle = '#fff';
  ctx.fillText('Resultados Cargados', padding.left + 120, legendY + 3);
}
