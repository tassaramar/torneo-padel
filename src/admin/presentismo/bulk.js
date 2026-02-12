/**
 * Operaciones masivas de presentismo
 */

import { supabase, TORNEO_ID, logMsg } from '../context.js';
import { marcarAmbosPresentes, desmarcarTodos } from '../../viewer/presentismo.js';
import { refreshTodasLasVistas } from './index.js';

export async function initOperacionesMasivas() {
  // Botón "Marcar todos presentes"
  const btnMarcarTodos = document.getElementById('marcar-todos-presentes');
  btnMarcarTodos.addEventListener('click', marcarTodosPresentes);

  // Botón "Limpiar todos" (requiere safety lock)
  const btnDesmarcarTodos = document.getElementById('desmarcar-todos');
  btnDesmarcarTodos.addEventListener('click', limpiarTodos);

  // Renderizar botones por grupo
  await renderGruposBulk();
}

async function renderGruposBulk() {
  const container = document.getElementById('grupos-bulk-container');

  const { data: grupos, error } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (error) {
    console.error('Error cargando grupos:', error);
    container.innerHTML = '<p class="helper">Error cargando grupos</p>';
    return;
  }

  container.innerHTML = grupos.map(g => `
    <div class="grupo-bulk-item">
      <span class="grupo-bulk-label">Grupo ${g.nombre}</span>
      <div class="grupo-bulk-actions">
        <button class="btn-small" onclick="window.marcarGrupoPresente('${g.id}', '${g.nombre}')">
          ✅ Marcar
        </button>
        <button class="btn-small btn-danger" data-danger="hard" onclick="window.limpiarGrupo('${g.id}', '${g.nombre}')">
          🧹 Limpiar
        </button>
      </div>
    </div>
  `).join('');
}

async function marcarTodosPresentes() {
  logMsg('🔄 Marcando TODOS los jugadores como presentes...');

  const { data: parejas, error } = await supabase
    .from('parejas')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID);

  if (error) {
    console.error('Error cargando parejas:', error);
    logMsg('❌ Error cargando parejas');
    return;
  }

  let ok = 0, fail = 0;
  const total = parejas.length;

  for (const pareja of parejas) {
    const [nombre1, nombre2] = pareja.nombre.split(' - ').map(s => s.trim());
    const success = await marcarAmbosPresentes(pareja.id, nombre1, nombre2);

    if (success) ok++;
    else fail++;

    // Log progreso cada 20%
    if ((ok + fail) % Math.ceil(total / 5) === 0) {
      logMsg(`📊 Progreso: ${ok + fail}/${total} (${Math.round(((ok + fail) / total) * 100)}%)`);
    }
  }

  logMsg(`✅ Completado: ${ok} OK, ${fail} errores`);
  await refreshTodasLasVistas();
}

async function limpiarTodos() {
  // Confirmación
  const confirmacion = confirm(
    '⚠️ LIMPIAR TODOS LOS PRESENTISMOS\n\n' +
    'Esto va a marcar a TODOS los jugadores como ausentes.\n' +
    'NO se puede deshacer automáticamente.\n\n' +
    '¿Continuar?'
  );

  if (!confirmacion) {
    logMsg('❌ Operación cancelada');
    return;
  }

  logMsg('🧹 Limpiando TODOS los presentismos...');

  const { data: parejas, error } = await supabase
    .from('parejas')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID);

  if (error) {
    console.error('Error cargando parejas:', error);
    logMsg('❌ Error cargando parejas');
    return;
  }

  let ok = 0, fail = 0;
  const total = parejas.length;

  for (const pareja of parejas) {
    const success = await desmarcarTodos(pareja.id);
    if (success) ok++;
    else fail++;

    // Log progreso cada 20%
    if ((ok + fail) % Math.ceil(total / 5) === 0) {
      logMsg(`📊 Progreso: ${ok + fail}/${total}`);
    }
  }

  logMsg(`✅ Limpieza completada: ${ok} OK, ${fail} errores`);
  await refreshTodasLasVistas();
}

// Exponer funciones globales para botones por grupo
window.marcarGrupoPresente = async function(grupoId, grupoNombre) {
  logMsg(`🔄 Marcando grupo ${grupoNombre} como presente...`);

  const { data: parejas, error } = await supabase
    .from('parejas')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupoId);

  if (error) {
    console.error('Error cargando parejas del grupo:', error);
    logMsg(`❌ Error cargando parejas del grupo ${grupoNombre}`);
    return;
  }

  let ok = 0, fail = 0;
  for (const pareja of parejas) {
    const [nombre1, nombre2] = pareja.nombre.split(' - ').map(s => s.trim());
    const success = await marcarAmbosPresentes(pareja.id, nombre1, nombre2);
    if (success) ok++;
    else fail++;
  }

  logMsg(`✅ Grupo ${grupoNombre}: ${ok} parejas marcadas, ${fail} errores`);
  await refreshTodasLasVistas();
};

window.limpiarGrupo = async function(grupoId, grupoNombre) {
  const confirmacion = confirm(
    `⚠️ LIMPIAR GRUPO ${grupoNombre}\n\n` +
    'Esto va a marcar a todos los jugadores del grupo como ausentes.\n' +
    '¿Continuar?'
  );

  if (!confirmacion) {
    logMsg('❌ Operación cancelada');
    return;
  }

  logMsg(`🧹 Limpiando grupo ${grupoNombre}...`);

  const { data: parejas, error } = await supabase
    .from('parejas')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupoId);

  if (error) {
    console.error('Error cargando parejas del grupo:', error);
    logMsg(`❌ Error cargando parejas del grupo ${grupoNombre}`);
    return;
  }

  let ok = 0, fail = 0;
  for (const pareja of parejas) {
    const success = await desmarcarTodos(pareja.id);
    if (success) ok++;
    else fail++;
  }

  logMsg(`✅ Grupo ${grupoNombre} limpiado: ${ok} parejas, ${fail} errores`);
  await refreshTodasLasVistas();
};
