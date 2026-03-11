/**
 * Orquestador del módulo de copas admin.
 * v2: los cruces se derivan de standings client-side, sin propuestas_copa.
 */

import { supabase, TORNEO_ID } from '../context.js';
import { cargarEsquemas, cargarStandingsParaCopas } from './planService.js';
import { renderPlanEditor } from './planEditor.js';
import { renderStatusView } from './statusView.js';

export function initCopas() {
  cargarCopasAdmin();
}

function determinarPaso(esquemas, copas, standingsData) {
  if (!esquemas?.length) return 1;

  const hayCopas = (copas || []).length > 0;
  if (hayCopas) return 4;

  const gruposCompletos = (standingsData.grupos || []).filter(g =>
    (standingsData.standings || []).some(s => s.grupo_id === g.id && s.grupo_completo)
  );
  if (gruposCompletos.length > 0) return 3;

  return 2;
}

function renderIndicadorPaso(paso, info = '') {
  const pasos = [
    { n: 1, label: 'Definir plan' },
    { n: 2, label: 'Esperar grupos' },
    { n: 3, label: 'Aprobar' },
    { n: 4, label: 'En curso' }
  ];

  const items = pasos.map(p => {
    const activo    = p.n === paso;
    const completado = p.n < paso;
    const cls   = activo ? 'paso-activo' : completado ? 'paso-completado' : 'paso-futuro';
    const label = completado ? `✓ ${p.label}` : `${p.n}. ${p.label}`;
    return `<span class="paso-item ${cls}">${label}</span>`;
  }).join('<span class="paso-sep">→</span>');

  const mensajes = {
    1: 'Definí el plan de copas para arrancar',
    2: info || 'Esperando que terminen los grupos',
    3: info || 'Todos los grupos terminaron — revisá los cruces y aprobá',
    4: info || 'Copas en curso'
  };

  return `
    <div class="indicador-pasos">${items}</div>
    <p class="paso-info">${mensajes[paso]}</p>
  `;
}

async function cargarCopasAdmin() {
  const container = document.getElementById('copas-admin');
  if (!container) return;

  container.innerHTML = '<p style="color:var(--muted);">⏳ Cargando…</p>';

  const [esquemas, { data: copas }, standingsData] = await Promise.all([
    cargarEsquemas(supabase, TORNEO_ID),
    supabase.from('copas').select('id, nombre, esquema_copa_id').eq('torneo_id', TORNEO_ID),
    cargarStandingsParaCopas(supabase, TORNEO_ID)
  ]);

  const paso = determinarPaso(esquemas, copas, standingsData);

  let infoPaso = '';
  if (paso === 2) {
    const grupos = standingsData.grupos || [];
    const completos = grupos.filter(g =>
      (standingsData.standings || []).some(s => s.grupo_id === g.id && s.grupo_completo)
    );
    if (grupos.length > 0) {
      infoPaso = `Esperando que finalicen los grupos (${completos.length} de ${grupos.length} completados)`;
    }
  }

  container.innerHTML = renderIndicadorPaso(paso, infoPaso);
  const subContainer = document.createElement('div');
  container.appendChild(subContainer);

  if (!esquemas?.length) {
    renderPlanEditor(subContainer, () => cargarCopasAdmin());
  } else {
    renderStatusView(subContainer, esquemas, copas || [], standingsData, () => cargarCopasAdmin());
  }
}
