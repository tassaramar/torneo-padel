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
 * Verifica si el plan está bloqueado (hay partidos de copa creados).
 * El plan no es editable una vez que se crearon partidos de copa.
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @returns {boolean}
 */
export async function esPlanBloqueado(supabase, torneoId) {
  const { data: copas } = await supabase
    .from('copas')
    .select('id')
    .eq('torneo_id', torneoId)
    .limit(1);

  if (!copas?.length) return false;

  const copaIds = copas.map(c => c.id);
  const { data: partidos } = await supabase
    .from('partidos')
    .select('id')
    .in('copa_id', copaIds)
    .limit(1);

  return (partidos?.length || 0) > 0;
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

/**
 * Carga standings del torneo enriquecidos con nombres de parejas y grupos.
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
 * Crea una copa y sus partidos iniciales usando los cruces calculados client-side.
 * Llama al RPC crear_partidos_copa de E1.
 *
 * @param {Object} supabase    - Cliente de Supabase
 * @param {string} esquemaId   - ID del esquema_copa
 * @param {Array}  cruces      - Array de { ronda, orden, parejaA, parejaB }
 *                               donde parejaA/B son objetos con { pareja_id }
 * @returns {{ ok: boolean, copa_id?: string, partidos_creados?: number, msg?: string }}
 */
export async function crearPartidosCopa(supabase, esquemaId, cruces) {
  const payload = (cruces || []).map(c => ({
    ronda:        c.ronda,
    orden:        c.orden,
    pareja_a_id:  c.parejaA?.pareja_id ?? null,
    pareja_b_id:  c.parejaB?.pareja_id ?? null
  }));

  const { data, error } = await supabase.rpc('crear_partidos_copa', {
    p_esquema_copa_id: esquemaId,
    p_cruces:          payload
  });

  if (error) {
    console.error('Error creando partidos copa:', error);
    return { ok: false, msg: error.message };
  }

  return {
    ok:               true,
    copa_id:          data?.copa_id,
    partidos_creados: data?.partidos_creados ?? 0
  };
}
