import { dom, logMsg } from '../context.js';
import { fetchGrupos, cargarGrupoCierre, resetPartidosGrupos, generarPartidosGrupos } from './service.js';
import { renderOrUpdateGrupoCard, renderGrupoError } from './ui.js';
import { state } from '../state.js';

export function initGroups() {
  console.log('INIT GROUPS');

  const btnReset = document.getElementById('reset-grupos');
  const btnGen = document.getElementById('gen-grupos');

  if (btnReset) {
    btnReset.onclick = async () => {
      const ok = await resetPartidosGrupos();
      if (ok) await cargarCierreGrupos();
    };
  }

  if (btnGen) {
    btnGen.onclick = async () => {
      const ok = await generarPartidosGrupos();
      if (ok) await cargarCierreGrupos();
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
