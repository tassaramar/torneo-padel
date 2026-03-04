/**
 * Estadísticas de presentismo con drill-down interactivo
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';

// Estado del panel abierto: 'completas' | 'incompletas' | 'ausentes' | null
let panelActivo = null;
// Cache de parejas para drill-down (evita re-fetch al abrir panel)
let parejasParaDrill = [];

export async function initEstadisticas() {
  await refreshEstadisticas();
}

export async function refreshEstadisticas() {
  const container = document.getElementById('stats-container');

  const { data: parejas, error } = await supabase
    .from('parejas')
    .select('id, nombre, presentes, grupo_id')
    .eq('torneo_id', TORNEO_ID);

  if (error) {
    console.error('Error cargando estadísticas:', error);
    logMsg('❌ Error cargando estadísticas');
    container.innerHTML = '<p class="helper">Error cargando estadísticas</p>';
    return;
  }

  const { data: grupos } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  const total = parejas.length;
  let completas = 0, incompletas = 0, ausentes = 0, totalAusencias = 0;

  // Listas para drill-down
  const parejasCompletas = [];
  const parejasIncompletas = [];
  const parejasAusentes = [];

  const statsPorGrupo = new Map();
  grupos.forEach(g => statsPorGrupo.set(g.id, { completas: 0, incompletas: 0, ausentes: 0, total: 0 }));

  parejas.forEach(p => {
    const [nombre1, nombre2] = p.nombre.split(' - ').map(s => s.trim());
    const presentes = p.presentes || [];
    const presente1 = presentes.includes(nombre1);
    const presente2 = presentes.includes(nombre2);

    const jugadores = [
      { nombre: nombre1, presente: presente1 },
      { nombre: nombre2, presente: presente2 }
    ];

    const gstats = statsPorGrupo.get(p.grupo_id);
    if (gstats) gstats.total++;

    if (presente1 && presente2) {
      completas++;
      if (gstats) gstats.completas++;
      parejasCompletas.push({ ...p, jugadores });
    } else if (presente1 || presente2) {
      incompletas++;
      if (gstats) gstats.incompletas++;
      totalAusencias += 1;
      parejasIncompletas.push({ ...p, jugadores });
    } else {
      ausentes++;
      if (gstats) gstats.ausentes++;
      totalAusencias += 2;
      parejasAusentes.push({ ...p, jugadores });
    }
  });

  // Guardar para uso en drill-down
  parejasParaDrill = { completas: parejasCompletas, incompletas: parejasIncompletas, ausentes: parejasAusentes };

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Total Parejas</div>
      </div>
      <button class="stat-card stat-success drill-trigger ${panelActivo === 'completas' ? 'drill-active' : ''}"
              data-estado="completas" type="button">
        <div class="stat-value">${completas} (${pct(completas, total)}%)</div>
        <div class="stat-label">✅ Completas ${panelActivo === 'completas' ? '▲' : '▼'}</div>
      </button>
      <div id="drill-panel-completas" class="drill-panel ${panelActivo === 'completas' ? 'drill-panel-open' : ''}" data-estado="completas">
        ${panelActivo === 'completas' ? renderDrillItems(parejasCompletas) : ''}
      </div>
      <button class="stat-card stat-warning drill-trigger ${panelActivo === 'incompletas' ? 'drill-active' : ''}"
              data-estado="incompletas" type="button">
        <div class="stat-value">${incompletas} (${pct(incompletas, total)}%)</div>
        <div class="stat-label">⚠️ Incompletas ${panelActivo === 'incompletas' ? '▲' : '▼'}</div>
      </button>
      <div id="drill-panel-incompletas" class="drill-panel ${panelActivo === 'incompletas' ? 'drill-panel-open' : ''}" data-estado="incompletas">
        ${panelActivo === 'incompletas' ? renderDrillItems(parejasIncompletas) : ''}
      </div>
      <button class="stat-card stat-danger drill-trigger ${panelActivo === 'ausentes' ? 'drill-active' : ''} ${ausentes === 0 ? 'drill-empty' : ''}"
              data-estado="ausentes" type="button" ${ausentes === 0 ? 'disabled' : ''}>
        <div class="stat-value">${ausentes} (${pct(ausentes, total)}%)</div>
        <div class="stat-label">❌ Ausentes ${ausentes > 0 ? (panelActivo === 'ausentes' ? '▲' : '▼') : ''}</div>
      </button>
      <div id="drill-panel-ausentes" class="drill-panel ${panelActivo === 'ausentes' ? 'drill-panel-open' : ''}" data-estado="ausentes">
        ${panelActivo === 'ausentes' ? renderDrillItems(parejasAusentes) : ''}
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalAusencias}</div>
        <div class="stat-label">Jugadores Ausentes</div>
      </div>
    </div>

    <h3 style="margin-top:18px;">Por Grupo</h3>
    <div class="stats-grupos">
      ${grupos.map(g => {
        const s = statsPorGrupo.get(g.id);
        const totalGrupo = s.total;
        const badge =
          s.ausentes > 0 || s.incompletas > 0 ? '🔴' :
          s.completas === totalGrupo ? '🟢' : '🟡';
        return `
          <div class="grupo-stat">
            <span class="grupo-badge">${badge}</span>
            <span class="grupo-nombre">Grupo ${g.nombre}</span>
            <span class="grupo-detalle">${s.completas}/${totalGrupo}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Wire click handlers en los botones drill-trigger
  container.querySelectorAll('.drill-trigger:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => toggleDrillPanel(btn.dataset.estado));
  });
}

function renderDrillItems(parejasList) {
  if (!parejasList || parejasList.length === 0) {
    return '<p class="helper" style="padding:8px 0;">Sin parejas en este estado</p>';
  }

  return parejasList.map(p => `
    <div class="drill-item">
      <span class="drill-pareja">${p.nombre}</span>
      <div class="drill-jugadores">
        ${p.jugadores.map(j => `
          <button type="button"
                  class="toggle-jugador ${j.presente ? 'presente' : 'ausente'}"
                  data-pareja-id="${p.id}"
                  data-nombre="${j.nombre}"
                  onclick="window.toggleJugadorPresentismo(event, '${p.id}', '${j.nombre}')">
            ${j.presente ? '✅' : '⬜'} ${j.nombre}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function toggleDrillPanel(estado) {
  if (panelActivo === estado) {
    panelActivo = null;
  } else {
    panelActivo = estado;
  }
  // Re-render stats para reflejar nuevo panel activo
  refreshEstadisticas();
}

function pct(n, total) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}
