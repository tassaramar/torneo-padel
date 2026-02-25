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

async function cargarCopasAdmin() {
  const container = document.getElementById('copas-admin');
  if (!container) return;

  container.innerHTML = '<p style="color:var(--muted);">⏳ Cargando…</p>';

  const [esquemas, propuestas, { data: copas }] = await Promise.all([
    cargarEsquemas(supabase, TORNEO_ID),
    cargarPropuestas(supabase, TORNEO_ID),
    supabase.from('copas').select('id, nombre, esquema_copa_id').eq('torneo_id', TORNEO_ID)
  ]);

  const hasPropuestas = propuestas.some(p => p.estado === 'pendiente');
  const hasCopas      = (copas || []).length > 0;

  if (!hasPropuestas && !hasCopas) {
    renderPlanEditor(container, () => cargarCopasAdmin());
  } else {
    renderStatusView(container, esquemas, propuestas, copas || [], () => cargarCopasAdmin());
  }
}
