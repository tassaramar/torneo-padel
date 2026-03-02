import { dom, logMsg, supabase, TORNEO_ID } from '../context.js';
import { fetchGrupos, cargarGrupoCierre, resetPartidosGrupos, generarPartidosGrupos } from './service.js';
import { renderOrUpdateGrupoCard, renderGrupoError } from './ui.js';
import { state } from '../state.js';

export function initGroups() {
  console.log('INIT GROUPS');

  const btnGen = document.getElementById('gen-grupos');

  if (btnGen) {
    btnGen.onclick = async () => {
      const ok = confirm(
        '🔥 REGENERAR TORNEO\n\n' +
        'Borra TODO y regenera desde cero:\n' +
        '🗑️ Partidos de grupos (y los regenera)\n' +
        '🗑️ Copas: partidos, copas, propuestas y plan\n\n' +
        '✅ Mantiene: parejas y grupos\n\n' +
        'Usá esto para empezar el torneo de cero. ¿Continuar?'
      );
      if (!ok) return;

      logMsg('🔥 Regenerando torneo...');

      // 1. Reset copas (partidos, copas, propuestas, esquemas)
      const { resetCopas } = await import('../copas/planService.js');
      const resetResult = await resetCopas(supabase, TORNEO_ID);
      if (!resetResult.ok) {
        logMsg(`❌ Error reseteando copas: ${resetResult.msg}`);
        return;
      }
      logMsg(`✅ Copas reseteadas (${resetResult.partidos_borrados ?? 0} partidos, ${resetResult.copas_borradas ?? 0} copas)`);

      // 2. Regenerar partidos de grupos
      const result = await generarPartidosGrupos();
      if (result) await cargarCierreGrupos();
    };
  }

  cargarCierreGrupos();
}

export async function cargarCierreGrupos() {
  if (!dom.contGrupos) return;

  dom.contGrupos.innerHTML = '';
  state.groups = {};

  const res = await fetchGrupos();
  if (!res.ok) {
    dom.contGrupos.textContent = res.msg || 'Error cargando grupos';
    return;
  }

  if (!res.grupos.length) {
    dom.contGrupos.textContent = 'No hay grupos.';
    return;
  }

  for (const grupo of res.grupos) {
    const r = await cargarGrupoCierre(grupo);
    if (!r.ok) renderGrupoError(grupo, r.msg);
    else renderOrUpdateGrupoCard(r.groupId);
  }

  logMsg('✅ Grupos cargados');
}
