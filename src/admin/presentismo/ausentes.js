/**
 * Vista de jugadores ausentes con acción rápida
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';
import { marcarPresente } from '../../viewer/presentismo.js';
import { refreshTodasLasVistas } from './index.js';

export async function initAusentes() {
  await refreshAusentes();
}

export async function refreshAusentes() {
  const container = document.getElementById('ausentes-container');

  const { data: parejas, error: errorParejas } = await supabase
    .from('parejas')
    .select('id, nombre, presentes, grupo_id')
    .eq('torneo_id', TORNEO_ID);

  if (errorParejas) {
    console.error('Error cargando ausentes:', errorParejas);
    logMsg('❌ Error cargando ausentes');
    container.innerHTML = '<p class="helper">Error cargando ausentes</p>';
    return;
  }

  const { data: grupos, error: errorGrupos } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID);

  if (errorGrupos) {
    console.error('Error cargando grupos:', errorGrupos);
    return;
  }

  const gruposMap = new Map(grupos.map(g => [g.id, g]));
  const ausentes = [];

  parejas.forEach(p => {
    const [nombre1, nombre2] = p.nombre.split(' - ').map(s => s.trim());
    const presentes = p.presentes || [];
    const grupo = gruposMap.get(p.grupo_id);

    if (!presentes.includes(nombre1)) {
      ausentes.push({
        nombre: nombre1,
        pareja: p.nombre,
        parejaId: p.id,
        grupo: grupo?.nombre || '?'
      });
    }
    if (!presentes.includes(nombre2)) {
      ausentes.push({
        nombre: nombre2,
        pareja: p.nombre,
        parejaId: p.id,
        grupo: grupo?.nombre || '?'
      });
    }
  });

  if (ausentes.length === 0) {
    container.innerHTML = '<p class="helper-info">✅ Todos los jugadores están presentes</p>';
    return;
  }

  container.innerHTML = `
    <p class="helper" style="margin-bottom:12px;">
      ⚠️ ${ausentes.length} jugador${ausentes.length > 1 ? 'es' : ''} ausente${ausentes.length > 1 ? 's' : ''}
    </p>
    ${ausentes.map(a => `
      <div class="ausente-card">
        <div class="ausente-info">
          <div class="ausente-nombre">${a.nombre}</div>
          <div class="ausente-pareja">${a.pareja}</div>
          <div class="ausente-grupo">Grupo ${a.grupo}</div>
        </div>
        <button class="btn-presente"
                onclick="window.marcarPresenteRapido('${a.parejaId}', '${a.nombre}')">
          Marcar presente
        </button>
      </div>
    `).join('')}
  `;
}

// Exponer función global
window.marcarPresenteRapido = async function(parejaId, nombre) {
  const success = await marcarPresente(parejaId, nombre);
  if (success) {
    logMsg(`✅ ${nombre} marcado como presente`);
    await refreshTodasLasVistas();
  } else {
    logMsg(`❌ Error marcando ${nombre} como presente`);
  }
};
