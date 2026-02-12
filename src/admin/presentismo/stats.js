/**
 * Estadísticas de presentismo
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';

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

  const statsPorGrupo = new Map();
  grupos.forEach(g => statsPorGrupo.set(g.id, { completas: 0, incompletas: 0, ausentes: 0, total: 0 }));

  parejas.forEach(p => {
    const [nombre1, nombre2] = p.nombre.split(' - ').map(s => s.trim());
    const presentes = p.presentes || [];
    const presente1 = presentes.includes(nombre1);
    const presente2 = presentes.includes(nombre2);

    const gstats = statsPorGrupo.get(p.grupo_id);
    if (gstats) gstats.total++;

    if (presente1 && presente2) {
      completas++;
      if (gstats) gstats.completas++;
    } else if (presente1 || presente2) {
      incompletas++;
      if (gstats) gstats.incompletas++;
      totalAusencias += 1;
    } else {
      ausentes++;
      if (gstats) gstats.ausentes++;
      totalAusencias += 2;
    }
  });

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Total Parejas</div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-value">${completas} (${pct(completas, total)}%)</div>
        <div class="stat-label">✅ Completas</div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-value">${incompletas} (${pct(incompletas, total)}%)</div>
        <div class="stat-label">⚠️ Incompletas</div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-value">${ausentes} (${pct(ausentes, total)}%)</div>
        <div class="stat-label">❌ Ausentes</div>
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
}

function pct(n, total) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}
