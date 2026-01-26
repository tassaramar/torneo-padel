/**
 * Utilidades para formatear resultados de partidos
 * Soporta tanto el formato legacy (games) como el nuevo formato (sets)
 */

/**
 * Formatea el resultado de un partido para mostrar
 * @param {Object} partido - Objeto del partido
 * @returns {string} Resultado formateado (ej: "6-4, 4-6, 6-2" o "2-1")
 */
export function formatearResultado(partido) {
  // Si tiene sets, mostrar sets
  if (partido.set1_a !== null && partido.set1_b !== null) {
    const sets = [];
    
    // Set 1
    if (partido.set1_a !== null && partido.set1_b !== null) {
      sets.push(`${partido.set1_a}-${partido.set1_b}`);
    }
    
    // Set 2
    if (partido.set2_a !== null && partido.set2_b !== null) {
      sets.push(`${partido.set2_a}-${partido.set2_b}`);
    }
    
    // Set 3 (si existe)
    if (partido.set3_a !== null && partido.set3_b !== null) {
      sets.push(`${partido.set3_a}-${partido.set3_b}`);
    }
    
    if (sets.length > 0) {
      return sets.join(', ');
    }
  }
  
  // Fallback a games (formato legacy)
  if (partido.games_a !== null && partido.games_b !== null) {
    return `${partido.games_a}-${partido.games_b}`;
  }
  
  return 'Pendiente';
}

/**
 * Formatea el resultado para mostrar en modo compacto (solo sets ganados)
 * @param {Object} partido - Objeto del partido
 * @returns {string} Resultado compacto (ej: "2-1" para sets ganados)
 */
export function formatearResultadoCompacto(partido) {
  // Si tiene sets, calcular sets ganados
  if (partido.set1_a !== null && partido.set1_b !== null) {
    let setsA = 0;
    let setsB = 0;
    
    if (partido.set1_a > partido.set1_b) setsA++;
    else if (partido.set1_b > partido.set1_a) setsB++;
    
    if (partido.set2_a !== null && partido.set2_b !== null) {
      if (partido.set2_a > partido.set2_b) setsA++;
      else if (partido.set2_b > partido.set2_a) setsB++;
    }
    
    if (partido.set3_a !== null && partido.set3_b !== null) {
      if (partido.set3_a > partido.set3_b) setsA++;
      else if (partido.set3_b > partido.set3_a) setsB++;
    }
    
    if (setsA > 0 || setsB > 0) {
      return `${setsA}-${setsB}`;
    }
  }
  
  // Fallback a games
  if (partido.games_a !== null && partido.games_b !== null) {
    return `${partido.games_a}-${partido.games_b}`;
  }
  
  return 'Pendiente';
}

/**
 * Determina si un partido tiene resultado completo
 * @param {Object} partido - Objeto del partido
 * @returns {boolean}
 */
export function tieneResultado(partido) {
  // Verificar sets primero
  if (partido.set1_a !== null && partido.set1_b !== null &&
      partido.set2_a !== null && partido.set2_b !== null) {
    const numSets = partido.num_sets || 3;
    if (numSets === 2) {
      return true; // Partido a 2 sets completo
    }
    // Para 3 sets, el tercero es opcional si ya se ganaron 2
    let setsA = 0, setsB = 0;
    if (partido.set1_a > partido.set1_b) setsA++;
    else if (partido.set1_b > partido.set1_a) setsB++;
    if (partido.set2_a > partido.set2_b) setsA++;
    else if (partido.set2_b > partido.set2_a) setsB++;
    
    if (setsA >= 2 || setsB >= 2) {
      return true; // Ya se ganaron 2 sets, partido completo
    }
    // Si no, necesita el set 3
    return partido.set3_a !== null && partido.set3_b !== null;
  }
  
  // Fallback a games (legacy)
  return partido.games_a !== null && partido.games_b !== null;
}
