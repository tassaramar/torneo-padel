/**
 * Orquestador del módulo de copas admin.
 * Gestiona el estado (plan → propuestas → en curso) y delega rendering.
 */

import { supabase, TORNEO_ID } from '../context.js';
import { cargarEsquemas, cargarPropuestas } from './planService.js';
import { renderPlanEditor } from './planEditor.js';
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

  const [esquemas, propuestas, { data: copas }, { data: grupos }] = await Promise.all([
    cargarEsquemas(supabase, TORNEO_ID),
    cargarPropuestas(supabase, TORNEO_ID),
    supabase.from('copas').select('id, nombre, esquema_copa_id').eq('torneo_id', TORNEO_ID),
    supabase.from('grupos').select('id').eq('torneo_id', TORNEO_ID)
  ]);

  const paso = determinarPaso(esquemas, propuestas, copas);

  let infoPaso2 = '';

  // Estado inconsistente: hay propuestas aprobadas pero no copas (plan de ciclo anterior)
  if (paso === 2 && propuestas.some(p => p.estado === 'aprobado')) {
    infoPaso2 = 'Plan anterior detectado — hacé Reset para empezar de nuevo';
  } else if (paso === 2 && grupos && grupos.length > 0) {
    const { data: partidos } = await supabase
      .from('partidos')
      .select('grupo_id, estado')
      .in('grupo_id', grupos.map(g => g.id));

    if (partidos) {
      const gruposCompletos = grupos.filter(g => {
        const del_grupo = partidos.filter(p => p.grupo_id === g.id);
        return del_grupo.length > 0 && del_grupo.every(p => p.estado === 'confirmado' || p.estado === 'terminado');
      });
      infoPaso2 = `Esperando que finalicen los grupos (${gruposCompletos.length} de ${grupos.length} completados)`;
    }
  }

  const hasPropuestas = propuestas.some(p => p.estado === 'pendiente');
  const hasCopas      = (copas || []).length > 0;

  container.innerHTML = renderIndicadorPaso(paso, infoPaso2);
  const subContainer = document.createElement('div');
  container.appendChild(subContainer);

  if (!hasPropuestas && !hasCopas) {
    renderPlanEditor(subContainer, () => cargarCopasAdmin());
  } else {
    renderStatusView(subContainer, esquemas, propuestas, copas || [], () => cargarCopasAdmin());
  }
}
