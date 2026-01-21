import { dom, logMsg } from '../context.js';
import { fetchGrupos, cargarGrupoCierre, resetPartidosGrupos, generarPartidosGrupos, guardarOrdenGrupo } from './service.js';
import { renderOrUpdateGrupoCard, renderGrupoError } from './ui.js';
import { state, isEditable } from '../state.js';

export function initGroups() {
  console.log('INIT GROUPS');

  const btnGen = document.getElementById('gen-grupos');

  if (btnGen) {
    btnGen.onclick = async () => {
      const ok = await generarPartidosGrupos();
      if (ok) await cargarCierreGrupos();
    };
  }

  // Botones globales de ranking
  const btnGenerarRanking = document.getElementById('generar-ranking');
  const btnGuardarRanking = document.getElementById('guardar-ranking');
  const btnRefrescarRanking = document.getElementById('refrescar-ranking');

  if (btnGenerarRanking) {
    btnGenerarRanking.onclick = async () => {
      await cargarCierreGrupos();
    };
  }

  if (btnGuardarRanking) {
    btnGuardarRanking.onclick = async () => {
      await guardarTodosLosGrupos();
    };
  }

  if (btnRefrescarRanking) {
    btnRefrescarRanking.onclick = async () => {
      await cargarCierreGrupos();
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

async function guardarTodosLosGrupos() {
  const grupoIds = Object.keys(state.groups);
  
  if (grupoIds.length === 0) {
    logMsg('⚠️ No hay grupos cargados');
    return;
  }

  logMsg('💾 Guardando orden final de todos los grupos...');
  
  let guardados = 0;
  let saltados = 0;
  
  for (const groupId of grupoIds) {
    if (isEditable(groupId)) {
      await guardarOrdenGrupo(groupId);
      guardados++;
    } else {
      saltados++;
    }
  }
  
  logMsg(`✅ Guardados: ${guardados} grupos`);
  if (saltados > 0) {
    logMsg(`⚠️ Saltados: ${saltados} grupos (partidos incompletos)`);
  }
  
  // Refrescar vista
  await cargarCierreGrupos();
}
