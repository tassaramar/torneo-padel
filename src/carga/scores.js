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
 * Validación simplificada: solo verifica que sean numéricos, >= 0, no nulos y no iguales
 * No aplica reglas de padel (mínimo 6, diferencia 2, límite 7, etc.)
 * @param {number} setA - Games de pareja A en el set
 * @param {number} setB - Games de pareja B en el set
 * @returns {Object} { ok: boolean, msg: string }
 */
export function validarSet(setA, setB) {
  // Verificar que no sean null o undefined
  if (setA === null || setB === null || setA === undefined || setB === undefined || setA === '' || setB === '') {
    return { ok: false, msg: 'Completá ambos resultados del set' };
  }

  const a = Number(setA);
  const b = Number(setB);

  // Verificar que sean numéricos
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return { ok: false, msg: 'Resultado inválido' };
  }

  // Verificar que sean enteros
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return { ok: false, msg: 'Usá números enteros' };
  }

  // Verificar que sean >= 0
  if (a < 0 || b < 0) {
    return { ok: false, msg: 'No se permiten números negativos' };
  }

  // Verificar que no sean iguales (no se permiten empates)
  if (a === b) {
    return { ok: false, msg: 'No se puede empatar un set' };
  }

  return { ok: true, msg: '' };
}

/**
 * Valida múltiples sets
 * Usa validación simplificada para todos los sets (incluido Set 3 / Super Tiebreak)
 * @param {Array} sets - Array de objetos { setA, setB } para cada set
 * @param {number} numSets - Número de sets del partido (1, 2 o 3)
 * @returns {Object} { ok: boolean, msg: string }
 */
export function validarSets(sets, numSets = 3) {
  if (!sets || sets.length === 0) {
    return { ok: false, msg: 'Completá al menos el primer set' };
  }

  // Determinar cuántos sets se deben validar según el modo
  let setsRequeridos;
  if (numSets === 1) {
    setsRequeridos = 1;
  } else if (numSets === 2) {
    setsRequeridos = 2;
  } else {
    // numSets === 3 o null/indefinido (se infiere de la cantidad de sets cargados)
    // Si hay 2 sets y alguien ganó 2-0, solo se validan 2 sets
    // Si hay empate 1-1 o 3 sets cargados, se validan hasta 3 sets
    setsRequeridos = sets.length >= 2 ? Math.min(sets.length, 3) : 2;
  }
  
  // Validar que todos los sets requeridos estén completos y sean válidos
  for (let i = 0; i < setsRequeridos && i < sets.length; i++) {
    if (!sets[i]) {
      return { ok: false, msg: `Completá el set ${i + 1}` };
    }
    
    // Usar validación simplificada para todos los sets (incluido Set 3)
    const validacion = validarSet(sets[i].setA, sets[i].setB);
    if (!validacion.ok) {
      return { ok: false, msg: `Set ${i + 1}: ${validacion.msg}` };
    }
  }

  // Validar que alguien haya ganado
  let setsGanadosA = 0;
  let setsGanadosB = 0;

  for (let i = 0; i < sets.length && i < 3; i++) {
    if (sets[i] && sets[i].setA !== null && sets[i].setB !== null) {
      const { setA, setB } = sets[i];
      if (setA > setB) setsGanadosA++;
      else if (setB > setA) setsGanadosB++;
    }
  }

  // Determinar sets necesarios según el modo
  const setsNecesarios = numSets === 1 ? 1 : 2;
  
  // Verificar que alguien haya ganado los sets necesarios
  if (setsGanadosA < setsNecesarios && setsGanadosB < setsNecesarios) {
    return { ok: false, msg: `Alguien debe ganar al menos ${setsNecesarios} set${setsNecesarios > 1 ? 's' : ''}` };
  }

  // Si hay un Set 3 cargado, también debe ser válido
  if (sets.length > 2 && sets[2] && sets[2].setA !== null && sets[2].setB !== null) {
    const validacion = validarSet(sets[2].setA, sets[2].setB);
    if (!validacion.ok) {
      return { ok: false, msg: `Set 3: ${validacion.msg}` };
    }
  }

  return { ok: true, msg: '' };
}
