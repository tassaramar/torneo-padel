import { supabase, TORNEO_ID, logMsg } from '../context.js';
import { state } from '../state.js';
import { calcularTablaGrupo, ordenarAutomatico, ordenarConOverrides, detectarEmpatesReales } from './compute.js';
import { enriquecerConPosiciones } from '../../utils/tablaPosiciones.js';

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
      estado,
      pareja_a_id,
      pareja_b_id,
      set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
      sets_a, sets_b,
      games_totales_a, games_totales_b,
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
  // Usar sets_a para determinar si tiene resultado (campo derivado)
  const jugados = (partidos || []).filter(p => p.sets_a !== null).length;
  const faltan = totalPartidos - jugados;

  const partidosArray = partidos || [];
  const rowsBase = calcularTablaGrupo(partidosArray);
  const autoOrder = ordenarAutomatico(rowsBase, partidosArray);

  const autoPosMap = {};
  autoOrder.forEach((r, idx) => (autoPosMap[r.pareja_id] = idx + 1));

  const { data: ov, error: errOv } = await supabase
    .from('sorteos')
    .select('pareja_id, orden_sorteo')
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupo.id);

  if (errOv) console.error(errOv);

  const ovMap = {};
  (ov || []).forEach(x => {
    if (x.orden_sorteo !== null) ovMap[x.pareja_id] = x.orden_sorteo;
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
    ovMap,
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

  // Solo guardar equipos que pertenecen a un cluster de empate.
  const tiedIds = new Set();
  if (g.tieGroups) {
    g.tieGroups.forEach(tg => tg.parejaIds.forEach(id => tiedIds.add(id)));
  }

  // También incluir equipos que YA tenían sorteo guardado (ovMap),
  // por si el admin está re-ordenando un cluster ya sorteado.
  if (g.ovMap) {
    Object.keys(g.ovMap).forEach(id => tiedIds.add(id));
  }

  if (tiedIds.size === 0) {
    logMsg('⚠️ No hay empates que requieran sorteo');
    return false;
  }

  // Determinar orden relativo dentro de cada cluster.
  // Recorrer g.rows en orden de la UI; asignar orden_sorteo 1, 2, 3...
  // solo a los que están en tiedIds. El orden se reinicia por cluster.
  const payload = [];
  let currentClusterOrder = 0;
  let prevWasTied = false;

  g.rows.forEach(r => {
    if (tiedIds.has(r.pareja_id)) {
      if (!prevWasTied) currentClusterOrder = 0; // nuevo cluster
      currentClusterOrder++;
      payload.push({
        torneo_id: TORNEO_ID,
        grupo_id: groupId,
        pareja_id: r.pareja_id,
        orden_sorteo: currentClusterOrder,
        tipo: 'intra_grupo'
      });
      prevWasTied = true;
    } else {
      prevWasTied = false;
    }
  });

  // Primero borrar sorteos intra_grupo existentes de este grupo
  const { error: errDel } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', groupId)
    .eq('tipo', 'intra_grupo');

  if (errDel) {
    console.error(errDel);
    logMsg('❌ Error limpiando sorteos previos');
    return false;
  }

  // Luego insertar los nuevos
  const { error } = await supabase
    .from('sorteos')
    .insert(payload);

  if (error) {
    console.error(error);
    logMsg('❌ Error guardando sorteo');
    return false;
  }

  logMsg(`✅ Sorteo guardado para grupo ${g.grupo.nombre}`);
  state.groups[groupId].hasSavedOverride = true;
  return true;
}

export async function resetOrdenGrupo(groupId) {
  const g = state.groups[groupId];
  if (!g) return false;

  const { error } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', groupId)
    .eq('tipo', 'intra_grupo');

  if (error) {
    console.error(error);
    logMsg('❌ Error reseteando orden manual');
    return false;
  }

  logMsg(`🧽 Sorteo reseteado para grupo ${g.grupo.nombre}`);
  return true;
}

export async function cargarTablaGeneral() {
  const { data, error } = await supabase.rpc('obtener_standings_torneo', {
    p_torneo_id: TORNEO_ID
  });

  if (error) {
    console.error(error);
    return { ok: false, msg: 'Error cargando tabla general' };
  }

  const standings = data || [];
  if (standings.length === 0) return { ok: false, msg: 'Sin datos' };

  // Enriquecer con nombres y posicion_en_grupo desde state.groups (ya cargados y ordenados)
  const gruposMap = {};
  Object.values(state.groups).forEach(g => {
    gruposMap[g.grupo.id] = g.grupo.nombre;
    g.rows.forEach((r, idx) => {
      const match = standings.find(s => s.pareja_id === r.pareja_id);
      if (match) {
        match.nombre = r.nombre;
        match.posicion_en_grupo = idx + 1;
      }
    });
  });

  // Ordenar: posicion_en_grupo ASC → stats → sorteo_inter ASC → nombre
  standings.sort((a, b) =>
    (a.posicion_en_grupo ?? 999) - (b.posicion_en_grupo ?? 999) ||
    (b.puntos - a.puntos) ||
    (b.ds - a.ds) ||
    ((b.dg || 0) - (a.dg || 0)) ||
    (b.gf - a.gf) ||
    ((a.sorteo_inter || 0) - (b.sorteo_inter || 0)) ||
    String(a.nombre || '').localeCompare(String(b.nombre || ''))
  );

  // Detectar clusters inter-grupo empatados
  const tiers = new Map();
  standings.filter(s => s.grupo_completo).forEach(s => {
    const key = `${s.posicion_en_grupo}|${s.puntos}|${s.ds}|${s.dg || 0}|${s.gf}`;
    if (!tiers.has(key)) tiers.set(key, []);
    tiers.get(key).push(s);
  });

  const tieGroupsInter = [];
  const tieSetInter = new Set();

  for (const arr of tiers.values()) {
    const gruposDistintos = new Set(arr.map(s => s.grupo_id));
    if (gruposDistintos.size < 2) continue;
    if (arr.length < 2) continue;

    const sinSorteo = arr.filter(s => !s.sorteo_inter);
    if (sinSorteo.length < 2) continue; // ya resuelto

    tieGroupsInter.push({
      parejaIds: arr.map(s => s.pareja_id),
      posicion: arr[0].posicion_en_grupo,
      stats: `${arr[0].puntos} pts, DS ${arr[0].ds}, DG ${arr[0].dg || 0}`
    });
    arr.forEach(s => tieSetInter.add(s.pareja_id));
  }

  // Cargar overrides inter-grupo existentes
  const { data: interSorteos } = await supabase
    .from('sorteos')
    .select('pareja_id, orden_sorteo')
    .eq('torneo_id', TORNEO_ID)
    .eq('tipo', 'inter_grupo');

  const interOvMap = {};
  (interSorteos || []).forEach(s => {
    if (s.orden_sorteo !== null) interOvMap[s.pareja_id] = s.orden_sorteo;
  });

  const hasSavedInterOverride = Object.keys(interOvMap).length > 0;

  state.general = {
    standings,
    gruposMap,
    tieGroupsInter,
    tieSetInter,
    interOvMap,
    hasSavedInterOverride
  };

  return { ok: true };
}

export async function guardarSorteoInterGrupo() {
  const gen = state.general;
  if (!gen) return false;

  const tiedIds = new Set();
  gen.tieGroupsInter.forEach(tg => tg.parejaIds.forEach(id => tiedIds.add(id)));
  if (gen.interOvMap) {
    Object.keys(gen.interOvMap).forEach(id => tiedIds.add(id));
  }

  if (tiedIds.size === 0) {
    logMsg('⚠️ No hay empates inter-grupo que requieran sorteo');
    return false;
  }

  const payload = [];
  let currentClusterOrder = 0;
  let prevWasTied = false;

  gen.standings.forEach(s => {
    if (tiedIds.has(s.pareja_id)) {
      if (!prevWasTied) currentClusterOrder = 0;
      currentClusterOrder++;
      payload.push({
        torneo_id: TORNEO_ID,
        grupo_id: null,
        pareja_id: s.pareja_id,
        orden_sorteo: currentClusterOrder,
        tipo: 'inter_grupo'
      });
      prevWasTied = true;
    } else {
      prevWasTied = false;
    }
  });

  const { error: errDel } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('tipo', 'inter_grupo');

  if (errDel) {
    console.error(errDel);
    logMsg('❌ Error limpiando sorteos inter-grupo previos');
    return false;
  }

  const { error } = await supabase
    .from('sorteos')
    .insert(payload);

  if (error) {
    console.error(error);
    logMsg('❌ Error guardando sorteo inter-grupo');
    return false;
  }

  logMsg('✅ Sorteo inter-grupo guardado');
  return true;
}

export async function resetSorteoInterGrupo() {
  const { error } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .eq('tipo', 'inter_grupo');

  if (error) {
    console.error(error);
    logMsg('❌ Error reseteando sorteo inter-grupo');
    return false;
  }

  logMsg('🧽 Sorteo inter-grupo reseteado');
  return true;
}
