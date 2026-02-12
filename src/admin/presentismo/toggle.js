/**
 * Toggle global de presentismo_activo
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';

const toggleInput = document.getElementById('presentismo-global-toggle');
const statusDiv = document.getElementById('presentismo-status');

export async function initToggleGlobal() {
  // Fetch estado actual
  const { data: torneo, error } = await supabase
    .from('torneos')
    .select('presentismo_activo')
    .eq('id', TORNEO_ID)
    .single();

  if (error) {
    console.error('Error cargando estado de presentismo:', error);
    logMsg('❌ Error cargando estado de presentismo');
    return;
  }

  const activo = torneo?.presentismo_activo ?? true;
  toggleInput.checked = activo;
  updateStatusUI(activo);

  // Handler de cambio
  toggleInput.addEventListener('change', async () => {
    const nuevoEstado = toggleInput.checked;

    const { error: updateError } = await supabase
      .from('torneos')
      .update({ presentismo_activo: nuevoEstado })
      .eq('id', TORNEO_ID);

    if (updateError) {
      console.error('Error actualizando estado de presentismo:', updateError);
      logMsg('❌ Error actualizando estado de presentismo');
      // Revertir toggle
      toggleInput.checked = !nuevoEstado;
      return;
    }

    updateStatusUI(nuevoEstado);
    logMsg(nuevoEstado ?
      '✅ Sistema de presentismo ACTIVADO' :
      '❌ Sistema de presentismo DESACTIVADO'
    );
  });
}

function updateStatusUI(activo) {
  statusDiv.textContent = activo ? 'Activo ✅' : 'Desactivado ❌';
  statusDiv.className = 'presentismo-toggle-status ' + (activo ? 'status-active' : 'status-inactive');
}
