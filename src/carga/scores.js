export function validarScore(gamesA, gamesB) {
  if (gamesA === null || gamesB === null) return { ok: false, msg: 'Completá ambos resultados' };

  if (Number.isNaN(gamesA) || Number.isNaN(gamesB)) return { ok: false, msg: 'Resultado inválido' };
  if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB)) return { ok: false, msg: 'Usá números enteros' };
  if (gamesA < 0 || gamesB < 0) return { ok: false, msg: 'No se permiten números negativos' };

  if (gamesA === gamesB) return { ok: false, msg: 'No se permiten empates (games iguales)' };

  return { ok: true, msg: '' };
}

/**
 * Valida un set individual
 * @param {number} setA - Games de pareja A en el set
 * @param {number} setB - Games de pareja B en el set
 * @returns {Object} { ok: boolean, msg: string }
 */
export function validarSet(setA, setB) {
  if (setA === null || setB === null || setA === '' || setB === '') {
    return { ok: false, msg: 'Completá ambos resultados del set' };
  }

  const a = Number(setA);
  const b = Number(setB);

  if (Number.isNaN(a) || Number.isNaN(b)) return { ok: false, msg: 'Resultado inválido' };
  if (!Number.isInteger(a) || !Number.isInteger(b)) return { ok: false, msg: 'Usá números enteros' };
  if (a < 0 || b < 0) return { ok: false, msg: 'No se permiten números negativos' };
  if (a > 7 || b > 7) return { ok: false, msg: 'Un set no puede tener más de 7 games' };

  // En padel, un set se gana con diferencia de 2 games o llegando a 7
  if (a === b) return { ok: false, msg: 'No se puede empatar un set' };
  
  // Validar que el ganador tenga al menos 6 games o llegue a 7
  const ganador = a > b ? a : b;
  const perdedor = a > b ? b : a;
  
  if (ganador < 6) return { ok: false, msg: 'Para ganar un set necesitás al menos 6 games' };
  if (ganador === 6 && perdedor >= 5) return { ok: false, msg: 'Con 6-5 necesitás ganar 7-5 o llegar a tie-break' };
  if (ganador === 7 && perdedor < 5) return { ok: false, msg: 'No se puede ganar 7-0, 7-1, 7-2, 7-3 o 7-4' };

  return { ok: true, msg: '' };
}

/**
 * Valida múltiples sets
 * @param {Array} sets - Array de objetos { setA, setB } para cada set
 * @param {number} numSets - Número de sets del partido (2 o 3)
 * @returns {Object} { ok: boolean, msg: string }
 */
export function validarSets(sets, numSets = 3) {
  if (!sets || sets.length === 0) {
    return { ok: false, msg: 'Completá al menos el primer set' };
  }

  // Validar que todos los sets requeridos estén completos
  const setsRequeridos = numSets === 2 ? 2 : 3;
  
  for (let i = 0; i < setsRequeridos; i++) {
    if (!sets[i]) {
      return { ok: false, msg: `Completá el set ${i + 1}` };
    }
    
    const validacion = validarSet(sets[i].setA, sets[i].setB);
    if (!validacion.ok) {
      return { ok: false, msg: `Set ${i + 1}: ${validacion.msg}` };
    }
  }

  // Validar que alguien haya ganado (al menos 2 sets en partido a 2, o 2 sets en partido a 3)
  let setsGanadosA = 0;
  let setsGanadosB = 0;

  for (let i = 0; i < setsRequeridos; i++) {
    const { setA, setB } = sets[i];
    if (setA > setB) setsGanadosA++;
    else if (setB > setA) setsGanadosB++;
  }

  const setsNecesarios = numSets === 2 ? 2 : 2; // Al mejor de 2 o 3, siempre se necesitan 2 sets ganados
  if (setsGanadosA < setsNecesarios && setsGanadosB < setsNecesarios) {
    return { ok: false, msg: `Alguien debe ganar al menos ${setsNecesarios} sets` };
  }

  // Si alguien ya ganó 2 sets, no debería haber un tercer set (para partidos a 3 sets)
  if (numSets === 3 && (setsGanadosA >= 2 || setsGanadosB >= 2) && sets.length > 2) {
    // El tercer set es opcional si ya se ganaron 2
    // Pero si está completo, debe ser válido
    if (sets[2] && sets[2].setA !== null && sets[2].setB !== null) {
      const validacion = validarSet(sets[2].setA, sets[2].setB);
      if (!validacion.ok) {
        return { ok: false, msg: `Set 3: ${validacion.msg}` };
      }
    }
  }

  return { ok: true, msg: '' };
}
