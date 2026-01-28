import { supabase, TORNEO_ID, logMsg } from '../context.js';
import { state } from '../state.js';
import { calcularTablaGrupo, ordenarAutomatico, ordenarConOverrides, detectarEmpatesReales } from './compute.js';

/**
 * Circle Method (Berger Tables) para generar pairings óptimos de round-robin
 */
function circleMethod(equipos) {
  let teams = [...equipos];
  const n = teams.length;
  
  if (n % 2 !== 0) {
    teams.push('BYE');
  }
  
  const numRounds = teams.length - 1;
  const matchesPerRound = teams.length / 2;
  const rounds = [];
  
  const fixed = teams[0];
  let rotating = teams.slice(1);
  
  for (let r = 0; r < numRounds; r++) {
    const roundPairings = [];
    roundPairings.push([fixed, rotating[0]]);
    
    for (let i = 1; i < matchesPerRound; i++) {
      roundPairings.push([
        rotating[i],
        rotating[rotating.length - i]
      ]);
    }
    
    rounds.push(roundPairings);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  
  return rounds;
}

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
  // Primero eliminar partidos existentes
  logMsg('🧹 Eliminando partidos de grupos existentes…');
  const { error: delError } = await supabase
    .from('partidos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .is('copa_id', null);

  if (delError) {
    console.error(delError);
    logMsg('❌ Error eliminando partidos existentes');
    return false;
  }
  
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
    .select('id, nombre, grupo_id, orden')
    .eq('torneo_id', TORNEO_ID)
    .order('orden');

  if (errParejas || !parejas || parejas.length < 2) {
    console.error(errParejas);
    logMsg('❌ No hay suficientes parejas');
    return false;
  }

  // Soporta 2 modos:
  // 1) Nuevo: parejas.grupo_id seteado (permite grupos desparejos, ej: 5+6)
  // 2) Legacy: si NO hay grupo_id en ninguna pareja, se sigue usando "split" parejo por orden.
  const hayGrupoId = (parejas || []).some(p => p.grupo_id);

  const gruposMap = {};
  if (hayGrupoId) {
    for (const g of grupos) {
      gruposMap[g.id] = (parejas || [])
        .filter(p => p.grupo_id === g.id)
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    }
  } else {
    if (parejas.length % grupos.length !== 0) {
      logMsg(`❌ Formato inválido (legacy): ${parejas.length} parejas / ${grupos.length} grupos`);
      logMsg('💡 Solución: asegurate de tener parejas.grupo_id (import nuevo) para soportar grupos desparejos.');
      return false;
    }

    const parejasPorGrupo = parejas.length / grupos.length;
    let cursor = 0;
    for (const g of grupos) {
      gruposMap[g.id] = parejas.slice(cursor, cursor + parejasPorGrupo);
      cursor += parejasPorGrupo;
    }
  }

  let total = 0;
  let errores = 0;

  for (const grupo of grupos) {
    const ps = gruposMap[grupo.id];
    if (!ps || ps.length < 2) {
      logMsg(`⚠️ Grupo ${grupo.nombre}: tiene ${ps?.length ?? 0} pareja(s). Se saltea.`);
      continue;
    }
    console.log(`Generando partidos para grupo ${grupo.nombre}:`, ps.map(p => p.nombre));
    
    // Usar Circle Method para generar pairings con rondas
    const nombresParaCircle = ps.map(p => p.nombre);
    const pairings = circleMethod(nombresParaCircle);
    
    // Crear mapa de nombre a ID para búsqueda rápida
    const nombreAId = {};
    ps.forEach(p => {
      nombreAId[p.nombre] = p.id;
    });
    
    // Crear partidos con número de ronda
    for (let rondaIdx = 0; rondaIdx < pairings.length; rondaIdx++) {
      const rondaPairings = pairings[rondaIdx];
      const numeroRonda = rondaIdx + 1;
      
      for (const [nombre1, nombre2] of rondaPairings) {
        // Saltar partidos con BYE
        if (nombre1 === 'BYE' || nombre2 === 'BYE') continue;
        
        const pareja1Id = nombreAId[nombre1];
        const pareja2Id = nombreAId[nombre2];
        
        if (!pareja1Id || !pareja2Id) {
          console.error(`No se encontró ID para ${nombre1} o ${nombre2}`);
          errores++;
          continue;
        }
        
        const { error } = await supabase
          .from('partidos')
          .insert({
            torneo_id: TORNEO_ID,
            grupo_id: grupo.id,
            pareja_a_id: pareja1Id,
            pareja_b_id: pareja2Id,
            copa_id: null,
            ronda: numeroRonda
          });

        if (!error) {
          total++;
        } else {
          errores++;
          console.error(`Error creando partido R${numeroRonda} (${nombre1} vs ${nombre2}):`, error);
        }
      }
    }
  }

  if (errores > 0) {
    logMsg(`⚠️ ${total} partidos creados con ${errores} errores`);
  } else {
    logMsg(`✅ ${total} partidos de grupos creados (con rondas asignadas)`);
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
      estado,
      pareja_a_id,
      pareja_b_id,
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

  const partidosArray = partidos || [];
  const rowsBase = calcularTablaGrupo(partidosArray);
  const autoOrder = ordenarAutomatico(rowsBase, partidosArray);

  const autoPosMap = {};
  autoOrder.forEach((r, idx) => (autoPosMap[r.pareja_id] = idx + 1));

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

  // Aplicar overrides con nueva lógica (solo en empates reales)
  const rowsOrdenadas = ordenarConOverrides(rowsBase, ovMap, partidosArray);

  // Detectar empates considerando enfrentamiento directo y overrides
  const { tieSet, tieLabel, tieGroups } = detectarEmpatesReales(rowsOrdenadas, partidosArray, ovMap);

  state.groups[grupo.id] = {
    grupo,
    meta: { totalPartidos, jugados, faltan },
    rows: rowsOrdenadas,
    editableBase: faltan === 0,
    unlocked: false,
    autoPosMap,
    tieSet,
    tieLabel,
    tieGroups,
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
