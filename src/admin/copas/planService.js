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
 * Genera finales + 3er puesto para una copa cuando las semis están confirmadas.
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} copaId    - ID de la copa
 * @returns {{ ok: boolean, msg?: string }}
 */
export async function generarFinalesCopa(supabase, copaId) {
  const { data, error } = await supabase
    .rpc('generar_finales_copa', { p_copa_id: copaId });

  if (error) {
    console.error('Error generando finales:', error);
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
 * Carga todos los presets de copa (defaults + custom) de la BD.
 *
 * @param {Object} supabase - Cliente de Supabase
 * @returns {Array} - Array de presets ordenados (defaults primero)
 */
export async function cargarPresets(supabase) {
  const { data, error } = await supabase
    .from('presets_copa')
    .select('id, nombre, clave, descripcion, esquemas, es_default')
    .order('es_default', { ascending: false })  // defaults primero
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
    .insert({ nombre, clave, descripcion: descripcion ?? null, esquemas, es_default: false })
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
    .eq('id', presetId)
    .eq('es_default', false);  // seguridad: no se pueden borrar los defaults

  if (error) {
    console.error('Error eliminando preset:', error);
    return { ok: false, msg: error.message };
  }
  return { ok: true };
}

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
