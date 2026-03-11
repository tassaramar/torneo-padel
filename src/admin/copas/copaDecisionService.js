/**
 * CRUD para tabla sorteos.
 * Maneja sorteos intra-grupo (desde Tab Grupos) e inter-grupo (desde Tab Copas).
 */

export async function cargarSorteos(supabase, torneoId) {
  const { data, error } = await supabase
    .from('sorteos')
    .select('id, torneo_id, grupo_id, pareja_id, orden_sorteo, tipo')
    .eq('torneo_id', torneoId);

  if (error) {
    console.error('Error cargando sorteos:', error);
    return [];
  }
  return data || [];
}

export async function guardarSorteoIntraGrupo(supabase, torneoId, grupoId, ordenParejas) {
  const payload = ordenParejas.map(op => ({
    torneo_id: torneoId,
    grupo_id: grupoId,
    pareja_id: op.pareja_id,
    orden_sorteo: op.orden_sorteo,
    tipo: 'intra_grupo'
  }));

  const { error } = await supabase
    .from('sorteos')
    .upsert(payload, { onConflict: 'torneo_id,pareja_id' });

  if (error) {
    console.error('Error guardando sorteo intra-grupo:', error);
    return { ok: false, msg: error.message };
  }
  return { ok: true };
}

export async function guardarSorteoInterGrupo(supabase, torneoId, ordenParejas) {
  const payload = ordenParejas.map(op => ({
    torneo_id: torneoId,
    grupo_id: null,
    pareja_id: op.pareja_id,
    orden_sorteo: op.orden_sorteo,
    tipo: 'inter_grupo'
  }));

  const { error } = await supabase
    .from('sorteos')
    .upsert(payload, { onConflict: 'torneo_id,pareja_id' });

  if (error) {
    console.error('Error guardando sorteo inter-grupo:', error);
    return { ok: false, msg: error.message };
  }
  return { ok: true };
}

export async function resetSorteo(supabase, torneoId, grupoId) {
  let query = supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', torneoId);

  if (grupoId) {
    query = query.eq('grupo_id', grupoId);
  }

  const { error } = await query;

  if (error) {
    console.error('Error reseteando sorteo:', error);
    return { ok: false, msg: error.message };
  }
  return { ok: true };
}
