/**
 * Orquestador del módulo de copas admin.
 * Gestiona el estado (plan → propuestas → en curso) y delega rendering.
 */

import { supabase, TORNEO_ID } from '../context.js';
import { cargarEsquemas, cargarPropuestas, cargarStandingsParaCopas } from './planService.js';
import { renderPlanEditor, renderPlanActivo } from './planEditor.js';
import { renderStatusView } from './statusView.js';

export function initCopas() {
  console.log('INIT COPAS v2');
  cargarCopasAdmin();
}

function determinarPaso(esquemas, propuestas, copas) {
  const hayEsquemas = esquemas && esquemas.length > 0;
  const propuestasPendientes = (propuestas || []).filter(p => p.estado === 'pendiente');
  const hayCopas = (copas || []).length > 0;

  if (!hayEsquemas) return 1;
  if (propuestasPendientes.length > 0) return 3;
  if (hayCopas) return 4;
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
    const activo = p.n === paso;
    const completado = p.n < paso;
    const cls = activo ? 'paso-activo' : completado ? 'paso-completado' : 'paso-futuro';
    const label = completado ? `✓ ${p.label}` : `${p.n}. ${p.label}`;
    return `<span class="paso-item ${cls}">${label}</span>`;
  }).join('<span class="paso-sep">→</span>');

  const mensajes = {
    1: 'Definí el plan de copas para arrancar',
    2: info || 'Esperando que terminen los grupos',
    3: 'Hay propuestas de copa para aprobar',
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

  const [esquemas, propuestas, { data: copas }, standingsData] = await Promise.all([
    cargarEsquemas(supabase, TORNEO_ID),
    cargarPropuestas(supabase, TORNEO_ID),
    supabase.from('copas').select('id, nombre, esquema_copa_id').eq('torneo_id', TORNEO_ID),
    cargarStandingsParaCopas(supabase, TORNEO_ID)
  ]);

  const grupos = standingsData.grupos;

  const paso = determinarPaso(esquemas, propuestas, copas);

  let infoPaso2 = '';

  if (paso === 2 && propuestas.some(p => p.estado === 'aprobado')) {
    infoPaso2 = 'Plan anterior detectado — hacé Reset para empezar de nuevo';
  } else if (paso === 2) {
    // Usar standingsData en lugar de consulta separada de partidos
    const gruposCompletos = grupos.filter(g =>
      standingsData.standings.some(s => s.grupo_id === g.id && s.grupo_completo)
    );
    if (grupos.length > 0) {
      infoPaso2 = `Esperando que finalicen los grupos (${gruposCompletos.length} de ${grupos.length} completados)`;
    }
  }

  const hayEsquemas        = (esquemas && esquemas.length > 0);
  const hasAnyPropuestas   = propuestas.some(p => p.estado === 'pendiente' || p.estado === 'aprobado');
  const hasCopas           = (copas || []).length > 0;
  const numGrupos          = grupos?.length || 0;

  container.innerHTML = renderIndicadorPaso(paso, infoPaso2);
  const subContainer = document.createElement('div');
  container.appendChild(subContainer);

  if (!hasAnyPropuestas && !hasCopas) {
    if (!hayEsquemas) {
      renderPlanEditor(subContainer, () => cargarCopasAdmin());
    } else {
      renderPlanActivo(subContainer, esquemas, numGrupos, () => cargarCopasAdmin());
    }
  } else {
    renderStatusView(subContainer, esquemas, propuestas, copas || [], standingsData, () => cargarCopasAdmin());
  }
}
