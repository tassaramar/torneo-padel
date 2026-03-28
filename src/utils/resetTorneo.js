/**
 * Pirámide de resets del torneo.
 *
 * Cada nivel limpia lo suyo + todo lo que está arriba (dependencias primero).
 * La ejecución siempre va de arriba hacia abajo:
 *
 *   5. resetResultadosCopa   — scores de copa
 *   4. resetCopas             — + copas, propuestas, sorteos inter (mantiene esquemas)
 *   3. resetResultadosGrupos  — + scores de grupo, posiciones manual
 *   2. resetPartidosGrupos    — + partidos de grupo
 *   1. resetParejas           — + parejas, grupos, esquemas, sorteos intra
 *
 * Todas las funciones reciben (supabase, torneoId, log?) donde log es
 * un callback opcional para reportar progreso (ej: logMsg del admin).
 */

const noop = () => {};

// ── Campos que se limpian en un reset de scores ──
const CAMPOS_RESET_SCORES = {
  set1_a: null, set1_b: null,
  set2_a: null, set2_b: null,
  set3_a: null, set3_b: null,
  set1_temp_a: null, set1_temp_b: null,
  set2_temp_a: null, set2_temp_b: null,
  set3_temp_a: null, set3_temp_b: null,
  estado: 'pendiente',
  cargado_por_pareja_id: null,
  notas_revision: null,
};

// ═══════════════════════════════════════════════════
// Nivel 5: Reset resultados de copa (solo scores)
// ═══════════════════════════════════════════════════
export async function resetResultadosCopa(supabase, torneoId, log = noop) {
  log('🧹 Limpiando resultados de copas…');

  const { data: copas } = await supabase
    .from('copas')
    .select('id')
    .eq('torneo_id', torneoId);

  const copaIds = (copas || []).map(c => c.id);
  if (!copaIds.length) {
    log('ℹ️ No hay copas — nada que limpiar');
    return { ok: true, count: 0 };
  }

  const { error, count } = await supabase
    .from('partidos')
    .update({ ...CAMPOS_RESET_SCORES, updated_at: new Date().toISOString() })
    .in('copa_id', copaIds)
    .select('id', { count: 'exact', head: false });

  if (error) {
    log(`❌ Error limpiando resultados de copa: ${error.message}`);
    return { ok: false, error };
  }

  log(`✅ Resultados de ${count || 0} partidos de copa limpiados`);
  return { ok: true, count: count || 0 };
}

// ═══════════════════════════════════════════════════
// Nivel 4: Reset copas (mantiene esquemas/plan)
// ═══════════════════════════════════════════════════
export async function resetCopas(supabase, torneoId, log = noop) {
  // Primero: limpiar lo de arriba
  const r5 = await resetResultadosCopa(supabase, torneoId, log);
  if (!r5.ok) return r5;

  log('🧹 Eliminando copas, propuestas y sorteos inter-grupo…');

  // Borrar partidos de copa
  const { error: errPartidos, count: countPartidos } = await supabase
    .from('partidos')
    .delete()
    .eq('torneo_id', torneoId)
    .not('copa_id', 'is', null)
    .select('id', { count: 'exact', head: false });

  if (errPartidos) {
    log(`❌ Error eliminando partidos de copa: ${errPartidos.message}`);
    return { ok: false, error: errPartidos };
  }

  // Borrar copas (CASCADE borra propuestas_copa)
  const { error: errCopas, count: countCopas } = await supabase
    .from('copas')
    .delete()
    .eq('torneo_id', torneoId)
    .select('id', { count: 'exact', head: false });

  if (errCopas) {
    log(`❌ Error eliminando copas: ${errCopas.message}`);
    return { ok: false, error: errCopas };
  }

  // Borrar sorteos inter-grupo
  const { error: errSorteos } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', torneoId)
    .eq('tipo', 'inter_grupo');

  if (errSorteos) {
    log(`❌ Error eliminando sorteos inter-grupo: ${errSorteos.message}`);
    return { ok: false, error: errSorteos };
  }

  log(`✅ Copas reseteadas: ${countPartidos || 0} partidos, ${countCopas || 0} copas eliminadas`);
  return { ok: true, partidos_borrados: countPartidos || 0, copas_borradas: countCopas || 0 };
}

// ═══════════════════════════════════════════════════
// Nivel 3: Reset resultados de grupos
// ═══════════════════════════════════════════════════
export async function resetResultadosGrupos(supabase, torneoId, log = noop) {
  // Primero: limpiar copas (dependen de resultados de grupo)
  const r4 = await resetCopas(supabase, torneoId, log);
  if (!r4.ok) return r4;

  log('🧹 Limpiando resultados de grupos…');

  const { error, count } = await supabase
    .from('partidos')
    .update({ ...CAMPOS_RESET_SCORES, updated_at: new Date().toISOString() })
    .eq('torneo_id', torneoId)
    .is('copa_id', null)
    .select('id', { count: 'exact', head: false });

  if (error) {
    log(`❌ Error limpiando resultados de grupo: ${error.message}`);
    return { ok: false, error };
  }

  // Limpiar posiciones manuales
  await supabase.from('posiciones_manual').delete().eq('torneo_id', torneoId);

  // Limpiar sorteos intra-grupo (resolución de empates)
  await supabase.from('sorteos').delete()
    .eq('torneo_id', torneoId)
    .eq('tipo', 'intra_grupo');

  log(`✅ Resultados de ${count || 0} partidos de grupo limpiados`);
  return { ok: true, count: count || 0 };
}

// ═══════════════════════════════════════════════════
// Nivel 2: Reset partidos de grupos (borra y NO regenera)
// ═══════════════════════════════════════════════════
export async function resetPartidosGrupos(supabase, torneoId, log = noop) {
  // Primero: limpiar resultados (y copas transitivamente)
  const r3 = await resetResultadosGrupos(supabase, torneoId, log);
  if (!r3.ok) return r3;

  log('🧹 Eliminando partidos de grupos…');

  const { error, count } = await supabase
    .from('partidos')
    .delete()
    .eq('torneo_id', torneoId)
    .is('copa_id', null)
    .select('id', { count: 'exact', head: false });

  if (error) {
    log(`❌ Error eliminando partidos de grupo: ${error.message}`);
    return { ok: false, error };
  }

  log(`✅ ${count || 0} partidos de grupo eliminados`);
  return { ok: true, count: count || 0 };
}

// ═══════════════════════════════════════════════════
// Nivel 1: Reset parejas (torneo queda vacío)
// ═══════════════════════════════════════════════════
export async function resetParejas(supabase, torneoId, log = noop) {
  // Primero: limpiar partidos (y copas/resultados transitivamente)
  const r2 = await resetPartidosGrupos(supabase, torneoId, log);
  if (!r2.ok) return r2;

  log('🧹 Eliminando parejas, grupos y esquemas de copa…');

  // Sorteos restantes (intra_grupo ya se borró en nivel 3, pero por si quedan otros tipos)
  await supabase.from('sorteos').delete().eq('torneo_id', torneoId);

  // Esquemas de copa (CASCADE borra propuestas_copa)
  const { error: errEsquemas } = await supabase
    .from('esquemas_copa')
    .delete()
    .eq('torneo_id', torneoId);

  if (errEsquemas) {
    log(`❌ Error eliminando esquemas de copa: ${errEsquemas.message}`);
    return { ok: false, error: errEsquemas };
  }

  // Parejas
  const { error: errParejas } = await supabase
    .from('parejas')
    .delete()
    .eq('torneo_id', torneoId);

  if (errParejas) {
    log(`❌ Error eliminando parejas: ${errParejas.message}`);
    return { ok: false, error: errParejas };
  }

  // Grupos
  const { error: errGrupos } = await supabase
    .from('grupos')
    .delete()
    .eq('torneo_id', torneoId);

  if (errGrupos) {
    log(`❌ Error eliminando grupos: ${errGrupos.message}`);
    return { ok: false, error: errGrupos };
  }

  log('✅ Torneo reseteado — listo para importar parejas');
  return { ok: true };
}
