/**
 * Vista de jugadores ausentes con acción rápida
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';
import { marcarPresente } from '../../viewer/presentismo.js';
import { refreshTodasLasVistas } from './index.js';
import { showToast } from '../../utils/toast.js';

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
      <div class="ausente-card" data-pareja-id="${a.parejaId}" data-nombre="${a.nombre}">
        <div class="ausente-info">
          <div class="ausente-nombre">${a.nombre}</div>
          <div class="ausente-meta">${a.pareja} · Grupo ${a.grupo}</div>
        </div>
        <button class="btn-presente-rapido"
                onclick="window.marcarPresenteRapido('${a.parejaId}', '${a.nombre}')"
                title="Marcar presente">
          ✅
        </button>
      </div>
    `).join('')}
  `;
}

// Exponer función global
window.marcarPresenteRapido = async function(parejaId, nombre) {
  // OPTIMISTIC UI: ocultar card inmediatamente
  const card = document.querySelector(`.ausente-card[data-pareja-id="${parejaId}"][data-nombre="${nombre}"]`);
  if (card) card.style.display = 'none';

  const success = await marcarPresente(parejaId, nombre);

  if (success) {
    logMsg(`✅ ${nombre} marcado como presente`);
    await refreshTodasLasVistas();
  } else {
    // ROLLBACK: mostrar card de nuevo
    if (card) card.style.display = '';
    logMsg(`❌ Error marcando ${nombre} como presente`);
    showToast(`Error al marcar presente a ${nombre}`, 'error');
  }
};
