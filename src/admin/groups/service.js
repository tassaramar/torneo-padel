import { supabase, TORNEO_ID, logMsg } from '../context.js';
import { state } from '../state.js';
import { calcularTablaGrupo, ordenarAutomatico, ordenarConOverrides, detectarEmpatesReales } from './compute.js';

export async function resetPartidosGrupos() {
  logMsg('🧹 Eliminando partidos de grupos…');

  const { error } = await supabase
    .from('partidos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .is('copa_id', null);

  if (error) {
    console.error(error);
    logMsg('❌ Error eliminando partidos de grupos');
    return false;
  }

  logMsg('🧹 Partidos de grupos eliminados');
  return true;
}

export async function generarPartidosGrupos() {
  logMsg('🎾 Generando partidos de grupos…');

  const { data: grupos, error: errGrupos } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errGrupos || !grupos || grupos.length === 0) {
    console.error(errGrupos);
    logMsg('❌ No hay grupos');
    return false;
  }

  const { data: parejas, error: errParejas } = await supabase
    .from('parejas')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('orden');

  if (errParejas || !parejas || parejas.length < 2) {
    console.error(errParejas);
    logMsg('❌ No hay suficientes parejas');
    return false;
  }

  if (parejas.length % grupos.length !== 0) {
    logMsg(`❌ Formato inválido: ${parejas.length} parejas / ${grupos.length} grupos`);
    return false;
  }

  const parejasPorGrupo = parejas.length / grupos.length;

  let cursor = 0;
  const gruposMap = {};
  for (const grupo of grupos) {
    gruposMap[grupo.id] = parejas.slice(cursor, cursor + parejasPorGrupo);
    cursor += parejasPorGrupo;
  }

  let total = 0;
  let errores = 0;

  for (const grupo of grupos) {
    const ps = gruposMap[grupo.id];
    console.log(`Generando partidos para grupo ${grupo.nombre}:`, ps.map(p => p.nombre));
    
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const { error } = await supabase
          .from('partidos')
          .insert({
            torneo_id: TORNEO_ID,
            grupo_id: grupo.id,
            pareja_a_id: ps[i].id,
            pareja_b_id: ps[j].id,
            copa_id: null
          });

        if (!error) {
          total++;
        } else {
          errores++;
          console.error(`Error creando partido en grupo ${grupo.nombre}:`, error);
        }
      }
    }
  }

  if (errores > 0) {
    logMsg(`⚠️ ${total} partidos creados con ${errores} errores`);
  } else {
    logMsg(`✅ ${total} partidos de grupos creados`);
  }
  
  return total > 0;
}

export async function fetchGrupos() {
  const { data: grupos, error } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (error) {
    console.error(error);
    return { ok: false, msg: 'Error cargando grupos', grupos: [] };
  }

  return { ok: true, grupos: grupos || [] };
}

export async function cargarGrupoCierre(grupo) {
  const { data: partidos, error: errPartidos } = await supabase
    .from('partidos')
    .select(`
      id,
      games_a,
      games_b,
      pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
    `)
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupo.id)
    .is('copa_id', null);

  if (errPartidos) {
    console.error(errPartidos);
    return { ok: false, msg: 'Error cargando partidos del grupo' };
  }

  const totalPartidos = (partidos || []).length;
  const jugados = (partidos || []).filter(p => p.games_a !== null && p.games_b !== null).length;
  const faltan = totalPartidos - jugados;

  const rowsBase = calcularTablaGrupo(partidos || []);
  const autoOrder = ordenarAutomatico(rowsBase);

  const autoPosMap = {};
  autoOrder.forEach((r, idx) => (autoPosMap[r.pareja_id] = idx + 1));

  const { tieSet, tieLabel } = detectarEmpatesReales(rowsBase);

  const { data: ov, error: errOv } = await supabase
    .from('posiciones_manual')
    .select('pareja_id, orden_manual')
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupo.id);

  if (errOv) console.error(errOv);

  const ovMap = {};
  (ov || []).forEach(x => {
    if (x.orden_manual !== null) ovMap[x.pareja_id] = x.orden_manual;
  });

  const hasSavedOverride = Object.keys(ovMap).length > 0;

  const rowsOrdenadas = ordenarConOverrides(rowsBase, ovMap);

  state.groups[grupo.id] = {
    grupo,
    meta: { totalPartidos, jugados, faltan },
    rows: rowsOrdenadas,
    editableBase: faltan === 0,
    unlocked: false,
    autoPosMap,
    tieSet,
    tieLabel,
    hasSavedOverride
  };

  return { ok: true, groupId: grupo.id };
}

export async function guardarOrdenGrupo(groupId) {
  const g = state.groups[groupId];
  if (!g) return false;

  const payload = g.rows.map((r, i) => ({
    torneo_id: TORNEO_ID,
    grupo_id: groupId,
    pareja_id: r.pareja_id,
    orden_manual: i + 1
  }));

  const { error } = await supabase
    .from('posiciones_manual')
    .upsert(payload, { onConflict: 'torneo_id,grupo_id,pareja_id' });

  if (error) {
    console.error(error);
    logMsg('❌ Error guardando orden manual');
    return false;
  }

  logMsg(`✅ Orden manual guardado para grupo ${g.grupo.nombre}`);
  state.groups[groupId].hasSavedOverride = true;
  return true;
}

export async function resetOrdenGrupo(groupId) {
  const g = state.groups[groupId];
  if (!g) return false;

  const { error } = await supabase
    .from('posiciones_manual')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', groupId);

  if (error) {
    console.error(error);
    logMsg('❌ Error reseteando orden manual');
    return false;
  }

  logMsg(`🧽 Orden manual reseteado para grupo ${g.grupo.nombre}`);
  return true;
}
