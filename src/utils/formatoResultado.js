/**
 * Utilidades centralizadas para manejo de resultados de partidos
 * 
 * MODELO DE DATOS:
 * - Fuente de verdad: set1_*, set2_*, set3_*, num_sets, stb_puntos_*
 * - Derivados (calculados por trigger, NO escribir desde app):
 *   - sets_a / sets_b: sets ganados
 *   - games_totales_a / games_totales_b: suma de games
 * 
 * IMPORTANTE: La app NUNCA debe hacer .update() a campos derivados.
 */

// =============================================================================
// FUNCIONES DE ESTADO
// =============================================================================

/**
 * Determina si un partido tiene resultado cargado
 * @param {Object} partido - Objeto del partido
 * @returns {boolean}
 */
export function tieneResultado(partido) {
  if (!partido) return false;
  
  // Si tenemos sets_a calculado (derivado), el partido tiene resultado
  if (partido.sets_a !== null && partido.sets_a !== undefined) {
    return true;
  }
  
  // Fallback: verificar sets directamente
  // Al menos el set1 debe estar completo para considerarse "con resultado"
  return partido.set1_a !== null && partido.set1_a !== undefined &&
         partido.set1_b !== null && partido.set1_b !== undefined;
}

/**
 * Determina si un partido está completo (tiene un ganador definido)
 * @param {Object} partido - Objeto del partido
 * @returns {boolean}
 */
export function partidoCompleto(partido) {
  if (!partido) return false;
  
  const { setsA, setsB } = calcularSetsGanados(partido);
  const numSets = partido.num_sets || 1;
  
  // Partido a 1 set: completo si set1 tiene ganador
  if (numSets === 1) {
    return setsA === 1 || setsB === 1;
  }
  
  // Partido a 3 sets: completo si alguien ganó 2
  return setsA >= 2 || setsB >= 2;
}

/**
 * Determina el ganador del partido
 * @param {Object} partido - Objeto del partido
 * @returns {'a' | 'b' | null} - 'a' si gana pareja A, 'b' si gana pareja B, null si no hay ganador
 */
export function determinarGanador(partido) {
  if (!partido || !tieneResultado(partido)) return null;
  
  const { setsA, setsB } = calcularSetsGanados(partido);
  
  if (setsA > setsB) return 'a';
  if (setsB > setsA) return 'b';
  return null; // Empate o incompleto
}

/**
 * Determina el ganador desde la perspectiva de una pareja
 * @param {Object} partido - Objeto del partido
 * @param {string} parejaId - ID de la pareja consultante
 * @returns {'yo' | 'rival' | null}
 */
export function determinarGanadorParaPareja(partido, parejaId) {
  const ganador = determinarGanador(partido);
  if (!ganador) return null;
  
  const soyA = partido.pareja_a_id === parejaId || partido.pareja_a?.id === parejaId;
  
  if (ganador === 'a') return soyA ? 'yo' : 'rival';
  return soyA ? 'rival' : 'yo';
}

// =============================================================================
// FUNCIONES DE CÁLCULO
// =============================================================================

/**
 * Calcula sets ganados por cada pareja
 * @param {Object} partido - Objeto del partido
 * @returns {{ setsA: number, setsB: number }}
 */
export function calcularSetsGanados(partido) {
  // Si ya tenemos los derivados calculados, usarlos
  if (partido.sets_a !== null && partido.sets_a !== undefined &&
      partido.sets_b !== null && partido.sets_b !== undefined) {
    return { setsA: partido.sets_a, setsB: partido.sets_b };
  }
  
  // Calcular desde sets
  let setsA = 0;
  let setsB = 0;
  
  if (partido.set1_a !== null && partido.set1_b !== null) {
    if (partido.set1_a > partido.set1_b) setsA++;
    else if (partido.set1_b > partido.set1_a) setsB++;
  }
  
  if (partido.set2_a !== null && partido.set2_b !== null) {
    if (partido.set2_a > partido.set2_b) setsA++;
    else if (partido.set2_b > partido.set2_a) setsB++;
  }
  
  if (partido.set3_a !== null && partido.set3_b !== null) {
    if (partido.set3_a > partido.set3_b) setsA++;
    else if (partido.set3_b > partido.set3_a) setsB++;
  }
  
  return { setsA, setsB };
}

/**
 * Calcula games totales por cada pareja
 * @param {Object} partido - Objeto del partido
 * @returns {{ gamesTotalesA: number, gamesTotalesB: number }}
 */
export function calcularGamesTotales(partido) {
  // Si ya tenemos los derivados calculados, usarlos
  if (partido.games_totales_a !== null && partido.games_totales_a !== undefined &&
      partido.games_totales_b !== null && partido.games_totales_b !== undefined) {
    return { 
      gamesTotalesA: partido.games_totales_a, 
      gamesTotalesB: partido.games_totales_b 
    };
  }
  
  // Calcular desde sets
  let gamesTotalesA = 0;
  let gamesTotalesB = 0;
  
  if (partido.set1_a !== null && partido.set1_b !== null) {
    gamesTotalesA += partido.set1_a;
    gamesTotalesB += partido.set1_b;
  }
  
  if (partido.set2_a !== null && partido.set2_b !== null) {
    gamesTotalesA += partido.set2_a;
    gamesTotalesB += partido.set2_b;
  }
  
  if (partido.set3_a !== null && partido.set3_b !== null) {
    gamesTotalesA += partido.set3_a;
    gamesTotalesB += partido.set3_b;
  }
  
  return { gamesTotalesA, gamesTotalesB };
}

// =============================================================================
// FUNCIONES DE FORMATEO
// =============================================================================

/**
 * Formatea el resultado de un partido para mostrar (sets detallados)
 * @param {Object} partido - Objeto del partido
 * @param {Object} options - Opciones de formateo
 * @param {boolean} options.incluirSTB - Si true, muestra puntos reales del STB entre paréntesis
 * @returns {string} Resultado formateado (ej: "6-4, 4-6, 7-6 (10-8)" o "6-4")
 */
export function formatearResultado(partido, options = {}) {
  const { incluirSTB = true } = options;
  
  if (!partido) return 'Pendiente';
  
  // Construir lista de sets
  const sets = [];
  
  // Set 1
  if (partido.set1_a !== null && partido.set1_b !== null) {
    sets.push(`${partido.set1_a}-${partido.set1_b}`);
  }
  
  // Set 2
  if (partido.set2_a !== null && partido.set2_b !== null) {
    sets.push(`${partido.set2_a}-${partido.set2_b}`);
  }
  
  // Set 3 (puede ser STB)
  if (partido.set3_a !== null && partido.set3_b !== null) {
    let set3Str = `${partido.set3_a}-${partido.set3_b}`;
    
    // Si tiene puntos de STB, mostrarlos entre paréntesis
    if (incluirSTB && 
        partido.stb_puntos_a !== null && partido.stb_puntos_a !== undefined &&
        partido.stb_puntos_b !== null && partido.stb_puntos_b !== undefined) {
      set3Str += ` (${partido.stb_puntos_a}-${partido.stb_puntos_b})`;
    }
    
    sets.push(set3Str);
  }
  
  if (sets.length > 0) {
    return sets.join(', ');
  }
  
  return 'Pendiente';
}

/**
 * Formatea el resultado en modo compacto (solo sets ganados)
 * @param {Object} partido - Objeto del partido
 * @returns {string} Resultado compacto (ej: "Sets: 2-1" o "6-4" para partido a 1 set)
 */
export function formatearResultadoCompacto(partido) {
  if (!partido || !tieneResultado(partido)) {
    return 'Pendiente';
  }
  
  const { setsA, setsB } = calcularSetsGanados(partido);
  const numSets = partido.num_sets || 1;
  
  // Si es partido a 1 set, mostrar el resultado del set
  if (numSets === 1 && partido.set1_a !== null && partido.set1_b !== null) {
    return `${partido.set1_a}-${partido.set1_b}`;
  }
  
  // Mostrar sets ganados
  return `Sets: ${setsA}-${setsB}`;
}

/**
 * Formatea el resultado con badge de sets y detalle
 * @param {Object} partido - Objeto del partido
 * @returns {{ badge: string, detalle: string }}
 */
export function formatearResultadoConBadge(partido) {
  if (!partido || !tieneResultado(partido)) {
    return { badge: '', detalle: 'Pendiente' };
  }
  
  const { setsA, setsB } = calcularSetsGanados(partido);
  const detalle = formatearResultado(partido);
  const numSets = partido.num_sets || 1;
  
  // Si es partido a 1 set, no mostrar badge de sets
  if (numSets === 1) {
    return { badge: '', detalle };
  }
  
  return {
    badge: `${setsA}-${setsB}`,
    detalle
  };
}

// =============================================================================
// FUNCIONES DE NORMALIZACIÓN (para guardar STB)
// =============================================================================

/**
 * Normaliza un resultado de Super Tiebreak para guardar en BD
 * @param {number} puntosA - Puntos reales de A (ej: 10)
 * @param {number} puntosB - Puntos reales de B (ej: 8)
 * @returns {{ set3_a: number, set3_b: number, stb_puntos_a: number, stb_puntos_b: number }}
 */
export function normalizarSTB(puntosA, puntosB) {
  // Determinar ganador del STB
  const ganaA = puntosA > puntosB;
  
  return {
    // Normalizado para ranking (1-0 / 0-1) - solo suma 1 game al ganador
    // Esto es más justo porque un set normal (6-4) suma 6 games, 
    // mientras que un STB es solo un desempate que vale 1 set
    set3_a: ganaA ? 1 : 0,
    set3_b: ganaA ? 0 : 1,
    // Puntos reales para UX
    stb_puntos_a: puntosA,
    stb_puntos_b: puntosB
  };
}

/**
 * Verifica si el set3 es un Super Tiebreak (tiene puntos STB guardados)
 * @param {Object} partido - Objeto del partido
 * @returns {boolean}
 */
export function esSTB(partido) {
  return partido.stb_puntos_a !== null && partido.stb_puntos_a !== undefined &&
         partido.stb_puntos_b !== null && partido.stb_puntos_b !== undefined;
}
