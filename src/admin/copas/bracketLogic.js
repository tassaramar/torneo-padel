/**
 * Módulo de lógica de bracket para copas
 * Extraído de src/admin/copas/index.js
 * Maneja: ganador/perdedor de partidos, comparación de stats, seeding bombo
 */

/**
 * Extrae ganador y perdedor de un partido de copa con resultado cargado.
 * @param {Object} p - Partido con { sets_a, sets_b, pareja_a_id, pareja_b_id }
 * @returns {{ winnerId: string, loserId: string } | null} null si no hay resultado o empate
 */
export function winnerLoserFromMatch(p) {
  const ga = p.sets_a;
  const gb = p.sets_b;
  if (ga === null || gb === null) return null;
  if (ga === gb) return null;

  if (ga > gb) {
    return { winnerId: p.pareja_a_id, loserId: p.pareja_b_id };
  }
  return { winnerId: p.pareja_b_id, loserId: p.pareja_a_id };
}

/**
 * Comparador de stats descendente para seeding.
 * Orden: puntos → diferencia de games → games a favor → nombre
 */
export function cmpStatsDesc(a, b) {
  if (b.P !== a.P) return b.P - a.P;
  if (b.DS !== a.DS) return b.DS - a.DS;
  if (b.DG !== a.DG) return b.DG - a.DG;
  if (b.GF !== a.GF) return b.GF - a.GF;
  return String(a.nombre).localeCompare(String(b.nombre));
}

/**
 * Aplica seeding de bombo: mejor vs peor, segundo vs tercero.
 * Soporta NULLs en el array (equipos pendientes de grupos incompletos).
 * Los NULLs se reordenan al final (son el "peor seed" desconocido).
 *
 * @param {Array} equipos - Array ordenado mejor primero; puede contener nulls
 * @returns {Array<[any, any]>} Pares de cruces [[A, D], [B, C]]
 */
export function seedingBombo(equipos) {
  // NULLs representan equipos pendientes — van al final (peor seed)
  const real = equipos.filter(e => e != null);
  const nulls = equipos.filter(e => e == null);
  const sorted = [...real, ...nulls];
  const n = sorted.length;

  if (n >= 4) {
    return [
      [sorted[0], sorted[3]],
      [sorted[1], sorted[2]]
    ];
  }
  if (n === 3) {
    // Bye al mejor (sorted[0]), semi entre 2do y 3ro
    return [[sorted[1], sorted[2]]];
  }
  if (n === 2) {
    return [[sorted[0], sorted[1]]];
  }
  return [];
}

/**
 * Filtra del pool los equipos que ya están en propuestas aprobadas.
 * @param {Array} equipos - Array de objetos con .pareja_id o .id
 * @param {Array} propuestasAprobadas - Propuestas con estado 'aprobado'
 * @returns {Array} Equipos no comprometidos en propuestas aprobadas
 */
export function excluirAprobados(equipos, propuestasAprobadas) {
  const aprobadosIds = new Set(
    (propuestasAprobadas || [])
      .flatMap(p => [p.pareja_a?.id, p.pareja_b?.id])
      .filter(Boolean)
  );
  return (equipos || []).filter(e => {
    if (e == null) return true; // conservar nulls (slots pendientes)
    const id = e.pareja_id || e.id;
    return !aprobadosIds.has(id);
  });
}
