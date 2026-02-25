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
 * @param {Array} equipos - Array ordenado mejor primero (IDs o objetos con .id)
 * @returns {Array<[any, any]>} Pares de cruces para las semis
 */
export function seedingBombo(equipos) {
  const n = equipos.length;
  if (n >= 4) {
    return [
      [equipos[0], equipos[3]],
      [equipos[1], equipos[2]]
    ];
  }
  if (n === 3) {
    // Bye al mejor (equipos[0]), semi entre 2do y 3ro
    return [[equipos[1], equipos[2]]];
  }
  if (n === 2) {
    return [[equipos[0], equipos[1]]];
  }
  return [];
}
