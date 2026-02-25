/**
 * Utilitario: calcular tabla de posiciones de un grupo desde la BD
 * Extraído de src/admin/copas/index.js para reutilización en múltiples módulos.
 */

import { calcularTablaGrupo, ordenarAutomatico } from '../admin/groups/compute.js';

/**
 * Calcula la tabla de posiciones de un grupo leyendo desde Supabase.
 * Solo incluye partidos sin copa_id (partidos de fase de grupos).
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @param {string} grupoId   - ID del grupo
 * @returns {{ ok: boolean, rows: Array, ordenParejas: string[], partidos: Array, msg?: string }}
 */
export async function calcularTablaGrupoDB(supabase, torneoId, grupoId) {
  const { data: partidos, error } = await supabase
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
    .eq('torneo_id', torneoId)
    .eq('grupo_id', grupoId)
    .is('copa_id', null);

  if (error) {
    console.error(error);
    return { ok: false, msg: 'Error leyendo partidos del grupo' };
  }

  const total = (partidos || []).length;
  const jugados = (partidos || []).filter(p => p.sets_a !== null).length;

  if (total > 0 && jugados < total) {
    return { ok: false, msg: `faltan partidos (${jugados}/${total})` };
  }

  const partidosArray = partidos || [];
  const rows = calcularTablaGrupo(partidosArray);
  const ordenadas = ordenarAutomatico(rows, partidosArray);

  if (ordenadas.length < 2) {
    return { ok: false, msg: `grupo incompleto: ${ordenadas.length} pareja(s)` };
  }

  return {
    ok: true,
    rows,
    ordenParejas: ordenadas.map(r => r.pareja_id),
    partidos: partidosArray
  };
}
