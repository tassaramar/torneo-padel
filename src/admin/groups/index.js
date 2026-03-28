import { dom, logMsg } from '../context.js';
import { fetchGrupos, cargarGrupoCierre, cargarTablaGeneral } from './service.js';
import { renderOrUpdateGrupoCard, renderGrupoError, renderTablaGeneralCard } from './ui.js';
import { state } from '../state.js';

export function initGroups() {
  console.log('INIT GROUPS');
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

  // Tabla General al final (después de todas las cards de grupos individuales)
  await cargarTablaGeneral();
  renderTablaGeneralCard();

  logMsg('✅ Grupos cargados');
}
