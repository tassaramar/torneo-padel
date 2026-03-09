/**
 * Servicio CRUD para esquemas_copa (el plan de copas del torneo).
 * Abstrae todas las operaciones de Supabase sobre esta tabla.
 */

/**
 * Carga todos los esquemas del torneo activo, ordenados.
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @returns {Array} - Array de esquemas o [] en caso de error
 */
export async function cargarEsquemas(supabase, torneoId) {
  const { data, error } = await supabase
    .from('esquemas_copa')
    .select('*')
    .eq('torneo_id', torneoId)
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error cargando esquemas_copa:', error);
    return [];
  }
  return data || [];
}

/**
 * Guarda un conjunto completo de esquemas para el torneo.
 * Borra los existentes y reinserta los nuevos (solo si el plan aún es editable).
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @param {Array}  esquemas  - Array de { nombre, orden, formato, reglas }
 * @returns {{ ok: boolean, msg?: string }}
 */
export async function guardarEsquemas(supabase, torneoId, esquemas) {
  // Verificar que el plan sea editable (no hay propuestas aprobadas)
  const bloqueado = await esPlanBloqueado(supabase, torneoId);
  if (bloqueado) {
    return { ok: false, msg: 'El plan está bloqueado: ya hay partidos de copa aprobados. Usá Reset para empezar de nuevo.' };
  }

  // Borrar esquemas existentes (en cascada borra propuestas_copa)
  const { error: errDel } = await supabase
    .from('esquemas_copa')
    .delete()
    .eq('torneo_id', torneoId);

  if (errDel) {
    console.error('Error borrando esquemas:', errDel);
    return { ok: false, msg: 'Error guardando el plan' };
  }

  if (!esquemas || esquemas.length === 0) {
    return { ok: true };
  }

  // Verificar que todos los esquemas tienen reglas
  const esquemasInvalidos = esquemas.filter(e => !e.reglas || e.reglas.length === 0);
  if (esquemasInvalidos.length > 0) {
    return { ok: false, msg: `Copa(s) sin reglas: ${esquemasInvalidos.map(e => e.nombre).join(', ')}` };
  }

  // Insertar nuevos esquemas
  const rows = esquemas.map((e, i) => ({
    torneo_id: torneoId,
    nombre:    e.nombre,
    orden:     e.orden ?? (i + 1),
    formato:   e.formato || 'bracket',
    reglas:    e.reglas  || []
  }));

  const { error: errIns } = await supabase
    .from('esquemas_copa')
    .insert(rows);

  if (errIns) {
    console.error('Error insertando esquemas:', errIns);
    return { ok: false, msg: 'Error guardando el plan' };
  }

  return { ok: true };
}

/**
 * Verifica si el plan está bloqueado (hay propuestas aprobadas).
 * El plan no es editable una vez que el admin aprobó alguna propuesta.
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @returns {boolean}
 */
export async function esPlanBloqueado(supabase, torneoId) {
  const { data, error } = await supabase
    .from('propuestas_copa')
    .select('id')
    .eq('estado', 'aprobado')
    .limit(1)
    .maybeSingle();

  // Si hay join necesario con esquemas_copa para filtrar por torneo
  // (propuestas_copa no tiene torneo_id directo)
  if (error) {
    console.error('Error verificando bloqueo de plan:', error);
    return false;
  }

  // Verificar con join
  const { data: aprobadas } = await supabase
    .from('propuestas_copa')
    .select('id, esquemas_copa!inner(torneo_id)')
    .eq('estado', 'aprobado')
    .eq('esquemas_copa.torneo_id', torneoId)
    .limit(1);

  return (aprobadas?.length || 0) > 0;
}

/**
 * Carga propuestas de copa del torneo, enriquecidas con nombres de esquema y parejas.
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @returns {Array} - Propuestas agrupadas por esquema_copa_id
 */
export async function cargarPropuestas(supabase, torneoId) {
  const { data, error } = await supabase
    .from('propuestas_copa')
    .select(`
      id,
      ronda,
      orden,
      estado,
      pareja_a:parejas!propuestas_copa_pareja_a_id_fkey ( id, nombre ),
      pareja_b:parejas!propuestas_copa_pareja_b_id_fkey ( id, nombre ),
      esquema:esquemas_copa!inner ( id, nombre, orden, formato, torneo_id )
    `)
    .eq('esquemas_copa.torneo_id', torneoId)
    .order('orden', { ascending: true });

  if (error) {
    console.error('Error cargando propuestas:', error);
    return [];
  }
  return data || [];
}

/**
 * Invoca el motor de propuestas en Supabase (función RPC).
 * Se llama cuando un resultado pasa a 'confirmado' o cuando el admin fuerza.
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @returns {{ ok: boolean, propuestas_creadas: number, msg?: string }}
 */
export async function invocarMotorPropuestas(supabase, torneoId) {
  const { data, error } = await supabase
    .rpc('verificar_y_proponer_copas', { p_torneo_id: torneoId });

  if (error) {
    console.error('Error invocando motor de propuestas:', error);
    return { ok: false, msg: error.message };
  }

  return { ok: true, propuestas_creadas: data?.propuestas_creadas ?? 0 };
}

/**
 * Aprueba las propuestas pendientes de un esquema (crea copa + partidos).
 *
 * @param {Object} supabase       - Cliente de Supabase
 * @param {string} esquemaCopaid  - ID del esquema_copa
 * @returns {{ ok: boolean, copa_id?: string, partidos_creados?: number, msg?: string }}
 */
export async function aprobarPropuestas(supabase, esquemaCopaid) {
  const { data, error } = await supabase
    .rpc('aprobar_propuestas_copa', { p_esquema_copa_id: esquemaCopaid });

  if (error) {
    console.error('Error aprobando propuestas:', error);
    return { ok: false, msg: error.message };
  }

  if (data?.error) {
    return { ok: false, msg: data.error };
  }

  return {
    ok: true,
    copa_id: data?.copa_id,
    partidos_creados: data?.partidos_creados ?? 0
  };
}

/**
 * Aprueba una sola propuesta pendiente de un esquema (partido individual).
 * Crea la copa si aún no existe, luego crea el partido para esa propuesta.
 *
 * @param {Object} supabase      - Cliente de Supabase
 * @param {string} esquemaCopaid - ID del esquema_copa
 * @param {string} propuestaId   - ID de la propuesta a aprobar
 * @returns {{ ok: boolean, copa_id?: string, partidos_creados?: number, msg?: string }}
 */
export async function aprobarPropuestaIndividual(supabase, esquemaCopaid, propuestaId) {
  const { data, error } = await supabase
    .rpc('aprobar_propuestas_copa', {
      p_esquema_copa_id: esquemaCopaid,
      p_propuesta_ids:   [propuestaId]
    });

  if (error) {
    console.error('Error aprobando propuesta individual:', error);
    return { ok: false, msg: error.message };
  }

  if (data?.error) {
    return { ok: false, msg: data.error };
  }

  return {
    ok: true,
    copa_id:          data?.copa_id,
    partidos_creados: data?.partidos_creados ?? 0
  };
}

/**
 * Avanza el bracket de una copa a la siguiente ronda cuando todos los partidos
 * de la ronda actual están confirmados. Genérico: QF→SF, SF→F(+3P).
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} copaId    - ID de la copa
 * @returns {{ ok: boolean, partidos_creados?: number, msg?: string }}
 */
export async function avanzarRondaCopa(supabase, copaId) {
  const { data, error } = await supabase
    .rpc('avanzar_ronda_copa', { p_copa_id: copaId });

  if (error) {
    console.error('Error avanzando ronda copa:', error);
    return { ok: false, msg: error.message };
  }

  return { ok: true, partidos_creados: data?.partidos_creados ?? 0, msg: data?.msg };
}

/**
 * Resetea todas las copas del torneo (borra partidos y copas, conserva el plan).
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @returns {{ ok: boolean, msg?: string }}
 */
export async function resetCopas(supabase, torneoId) {
  const { data, error } = await supabase
    .rpc('reset_copas_torneo', { p_torneo_id: torneoId });

  if (error) {
    console.error('Error en reset copas:', error);
    return { ok: false, msg: error.message };
  }

  return {
    ok: true,
    partidos_borrados: data?.partidos_borrados ?? 0,
    copas_borradas: data?.copas_borradas ?? 0
  };
}

/**
 * Carga todos los presets de copa de la BD.
 *
 * @param {Object} supabase - Cliente de Supabase
 * @returns {Array} - Array de presets ordenados por fecha de creación
 */
export async function cargarPresets(supabase) {
  const { data, error } = await supabase
    .from('presets_copa')
    .select('id, nombre, clave, descripcion, esquemas')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error cargando presets_copa:', error);
    return [];
  }
  return data || [];
}

/**
 * Guarda un preset custom en la BD.
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {Object} preset    - { nombre, clave, descripcion?, esquemas }
 * @returns {{ ok: boolean, id?: string, msg?: string }}
 */
export async function guardarPreset(supabase, { nombre, clave, descripcion, esquemas }) {
  const { data, error } = await supabase
    .from('presets_copa')
    .insert({ nombre, clave, descripcion: descripcion ?? null, esquemas })
    .select('id')
    .single();

  if (error) {
    console.error('Error guardando preset:', error);
    return { ok: false, msg: error.message };
  }
  return { ok: true, id: data.id };
}

/**
 * Elimina un preset custom de la BD.
 * Solo puede eliminar presets no-default (es_default = false).
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} presetId  - ID del preset a eliminar
 * @returns {{ ok: boolean, msg?: string }}
 */
export async function eliminarPreset(supabase, presetId) {
  const { error } = await supabase
    .from('presets_copa')
    .delete()
    .eq('id', presetId);

  if (error) {
    console.error('Error eliminando preset:', error);
    return { ok: false, msg: error.message };
  }
  return { ok: true };
}

/**
 * Detecta el formato del torneo desde Supabase y retorna el contexto.
 * Movida desde presets.js (el fallback estático fue eliminado).
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @returns {{ numGrupos, numParejas, parejasPorGrupo }}
 */
export async function detectarYSugerirPreset(supabase, torneoId) {
  const [{ data: grupos }, { data: parejas }] = await Promise.all([
    supabase.from('grupos').select('id').eq('torneo_id', torneoId),
    supabase.from('parejas').select('id, grupo_id').eq('torneo_id', torneoId)
  ]);

  const numGrupos       = grupos?.length  || 0;
  const numParejas      = parejas?.length || 0;
  const parejasPorGrupo = numGrupos > 0 ? numParejas / numGrupos : 0;

  // Mínimo de parejas en cualquier grupo (para filtrar plantillas correctamente
  // cuando los grupos tienen distinto número de equipos)
  let minParejasPorGrupo = Math.round(parejasPorGrupo);
  if (numGrupos > 0 && parejas?.length) {
    const cuentas = {};
    for (const p of parejas) cuentas[p.grupo_id] = (cuentas[p.grupo_id] || 0) + 1;
    const vals = Object.values(cuentas);
    if (vals.length > 0) minParejasPorGrupo = Math.min(...vals);
  }

  return { numGrupos, numParejas, parejasPorGrupo, minParejasPorGrupo };
}

// ============================================================
// Funciones de cálculo puro (sin IO) — para Decisión 1 y Decisión 2
// ============================================================

/**
 * Carga standings del torneo enriquecidos con nombres de parejas y grupos.
 * Fuente de datos para calcularClasificadosConWarnings y calcularCrucesConWarnings.
 *
 * @returns {{ standings, grupos, todosCompletos }}
 */
export async function cargarStandingsParaCopas(supabase, torneoId) {
  const [standingsRes, gruposRes, parejasRes] = await Promise.all([
    supabase.rpc('obtener_standings_torneo', { p_torneo_id: torneoId }),
    supabase.from('grupos').select('id, nombre').eq('torneo_id', torneoId),
    supabase.from('parejas').select('id, nombre').eq('torneo_id', torneoId)
  ]);

  const grupos = gruposRes.data || [];
  const parejasMap = Object.fromEntries((parejasRes.data || []).map(p => [p.id, p.nombre]));
  const gruposMap = Object.fromEntries(grupos.map(g => [g.id, g.nombre]));

  const standings = (standingsRes.data || []).map(s => ({
    ...s,
    nombre:      parejasMap[s.pareja_id] || '?',
    grupoNombre: gruposMap[s.grupo_id]   || '?'
  }));

  const gruposCompletosIds = new Set(standings.filter(s => s.grupo_completo).map(s => s.grupo_id));
  const todosCompletos = grupos.length > 0 && grupos.every(g => gruposCompletosIds.has(g.id));

  return { standings, grupos, todosCompletos };
}

/**
 * Función pura. Recibe standings enriquecidos y las reglas del esquema;
 * retorna quiénes clasifican, zona gris (empates en frontera) y warnings.
 *
 * @param {{ standings, grupos }} standingsData
 * @param {Object} esquema - Con campo `reglas`
 * @param {Array}  propuestasAprobadas - Propuestas ya aprobadas de este esquema
 * @returns {{ clasificados, zonaGris, pendientes, warnings }}
 */
export function calcularClasificadosConWarnings(standingsData, esquema, propuestasAprobadas) {
  const { standings, grupos } = standingsData;
  const reglas = esquema.reglas || [];

  const aprobadosIds = new Set(
    (propuestasAprobadas || [])
      .flatMap(p => [p.pareja_a?.id, p.pareja_b?.id])
      .filter(Boolean)
  );

  const clasificados = [];
  let zonaGris = [];
  const pendientes = [];
  const warnings = [];

  const gruposCompletosIds = new Set(standings.filter(s => s.grupo_completo).map(s => s.grupo_id));
  const gruposIncompletos  = grupos.filter(g => !gruposCompletosIds.has(g.id));
  const hasGlobal          = reglas.some(r => r.modo === 'global');

  if (hasGlobal) {
    const globalRule = reglas.find(r => r.modo === 'global') || {};
    const desde = globalRule.desde || 1;
    const hasta = globalRule.hasta || 4;

    const allSorted = standings.filter(s => s.grupo_completo).sort(_cmpDesc);
    const inScope   = allSorted.slice(desde - 1, hasta);
    const nextTeam  = allSorted[hasta] || null;

    inScope.forEach((t, i) => clasificados.push({
      ...t, seed: desde + i, aprobado: aprobadosIds.has(t.pareja_id)
    }));

    // Zona gris: empate entre último clasificado y el primero excluido
    if (nextTeam && inScope.length > 0) {
      const ultimo = inScope[inScope.length - 1];
      if (_empate(nextTeam, ultimo)) {
        zonaGris = allSorted.slice(hasta).filter(t => _empate(t, ultimo));
        warnings.push({
          tipo: 'empate_frontera',
          equipos: [ultimo.nombre, ...zonaGris.map(z => z.nombre)],
          detalle: `${ultimo.puntos} pts, DS ${_signo(ultimo.ds)}${Math.abs(ultimo.ds)}`
        });
      }
    }

    for (const g of gruposIncompletos) {
      pendientes.push({ grupoId: g.id, grupoNombre: g.nombre });
    }

  } else {
    // Seeding por posición de grupo
    for (const regla of reglas) {
      const posicion = regla.posicion;
      const cantidad = regla.cantidad;
      const criterio = regla.criterio;

      let candidates = standings
        .filter(s => s.posicion_en_grupo === posicion && s.grupo_completo)
        .sort(_cmpDesc);

      if (!criterio) {
        // Sin criterio: uno por grupo (todos los grupos aportan esta posición)
        candidates.forEach(t => clasificados.push({
          ...t, seed: clasificados.length + 1, aprobado: aprobadosIds.has(t.pareja_id)
        }));
        for (const g of gruposIncompletos) {
          if (!pendientes.some(p => p.grupoId === g.id)) {
            pendientes.push({ grupoId: g.id, grupoNombre: g.nombre });
          }
        }
      } else {
        if (criterio === 'peor') candidates = [...candidates].reverse();
        const limit = cantidad || candidates.length;
        const taken = candidates.slice(0, limit);
        const next  = candidates[limit];

        taken.forEach(t => clasificados.push({
          ...t, seed: clasificados.length + 1, aprobado: aprobadosIds.has(t.pareja_id)
        }));

        if (next && taken.length > 0) {
          const ultimo = taken[taken.length - 1];
          if (_empate(next, ultimo)) {
            const newZona = candidates.slice(limit).filter(t => _empate(t, ultimo));
            zonaGris = [...zonaGris, ...newZona];
            warnings.push({
              tipo: 'empate_frontera',
              equipos: [ultimo.nombre, ...newZona.map(z => z.nombre)],
              detalle: `${ultimo.puntos} pts, DS ${_signo(ultimo.ds)}${Math.abs(ultimo.ds)}`
            });
          }
        }
      }
    }

    // Detectar empates a 3+ dentro de un grupo (afectan posición → copa destino)
    for (const grupoId of gruposCompletosIds) {
      const grupoTeams = standings.filter(s => s.grupo_id === grupoId && s.grupo_completo);
      const statsGroups = {};
      for (const t of grupoTeams) {
        const key = `${t.puntos}_${t.ds}_${t.gf}`;
        if (!statsGroups[key]) statsGroups[key] = [];
        statsGroups[key].push(t);
      }
      for (const tied of Object.values(statsGroups)) {
        if (tied.length >= 3) {
          const grupoNombre = grupos.find(g => g.id === grupoId)?.nombre || grupoId;
          const positions   = tied.map(t => `${t.posicion_en_grupo}°`).join('-');
          warnings.push({ tipo: 'empate_grupo', grupoNombre, posiciones: positions, grupoId });
        }
      }
    }
  }

  return { clasificados, zonaGris, pendientes, warnings };
}

/**
 * Función pura. Recibe propuestas de un esquema y standings enriquecidos;
 * retorna cruces con info de grupo de origen y warnings de "mismo grupo".
 *
 * @param {Array}  propuestasEsquema - Todas las propuestas del esquema (pendientes + aprobadas)
 * @param {{ standings, grupos }} standingsData
 * @returns {{ cruces, warnings }}
 */
export function calcularCrucesConWarnings(propuestasEsquema, standingsData) {
  const { standings, grupos } = standingsData;

  // Mapa parejaId → { grupoId, grupoNombre }
  const parejaGrupoMap = {};
  for (const s of standings) {
    parejaGrupoMap[s.pareja_id] = { grupoId: s.grupo_id, grupoNombre: s.grupoNombre };
  }

  const cruces = (propuestasEsquema || []).map(p => {
    const gA = p.pareja_a ? parejaGrupoMap[p.pareja_a.id] : null;
    const gB = p.pareja_b ? parejaGrupoMap[p.pareja_b.id] : null;

    const mismoGrupo = !!(gA && gB && gA.grupoId && gA.grupoId === gB.grupoId);

    return {
      id:       p.id,
      ronda:    p.ronda,
      orden:    p.orden,
      aprobado: p.estado === 'aprobado',
      parejaA:  p.pareja_a
        ? { id: p.pareja_a.id, nombre: p.pareja_a.nombre, grupoId: gA?.grupoId, grupoNombre: gA?.grupoNombre }
        : null,
      parejaB:  p.pareja_b
        ? { id: p.pareja_b.id, nombre: p.pareja_b.nombre, grupoId: gB?.grupoId, grupoNombre: gB?.grupoNombre }
        : null,
      mismoGrupo
    };
  });

  const warnings = cruces
    .filter(c => c.mismoGrupo && !c.aprobado)
    .map(c => ({
      tipo:    'mismo_grupo',
      orden:   c.orden,
      equipos: [c.parejaA?.nombre, c.parejaB?.nombre].filter(Boolean),
      grupo:   c.parejaA?.grupoNombre
    }));

  return { cruces, warnings };
}

// Helpers internos para calcularClasificadosConWarnings
function _cmpDesc(a, b) {
  if (b.puntos !== a.puntos) return b.puntos - a.puntos;
  if (b.ds     !== a.ds)     return b.ds     - a.ds;
  if (b.gf     !== a.gf)     return b.gf     - a.gf;
  return String(a.nombre).localeCompare(String(b.nombre));
}
function _empate(a, b) {
  return a.puntos === b.puntos && a.ds === b.ds && a.gf === b.gf;
}
function _signo(n) { return n >= 0 ? '+' : ''; }

// ============================================================

/**
 * Modifica el seeding de una propuesta pendiente (swap de parejas entre cruces).
 * Permite que el admin ajuste quién juega contra quién antes de aprobar.
 *
 * @param {Object} supabase    - Cliente de Supabase
 * @param {string} propuestaId - ID de la propuesta a modificar
 * @param {string} parejaAId   - Nuevo pareja_a_id
 * @param {string} parejaBId   - Nuevo pareja_b_id
 * @returns {{ ok: boolean, msg?: string }}
 */
export async function modificarPropuesta(supabase, propuestaId, parejaAId, parejaBId) {
  const { error } = await supabase
    .from('propuestas_copa')
    .update({ pareja_a_id: parejaAId, pareja_b_id: parejaBId })
    .eq('id', propuestaId)
    .eq('estado', 'pendiente');  // Solo si está pendiente

  if (error) {
    console.error('Error modificando propuesta:', error);
    return { ok: false, msg: error.message };
  }

  return { ok: true };
}
