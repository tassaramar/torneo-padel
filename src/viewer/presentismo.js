/**
 * Módulo de Presentismo por Torneo
 * Maneja el estado de presencia de cada jugador de una pareja
 * 
 * Storage: Supabase (campo `presentes` en tabla `parejas`)
 * El campo es un array de nombres: ['Tincho', 'Max']
 */

// Cliente Supabase se pasa en la inicialización
let supabase = null;

/**
 * Inicializa el módulo con el cliente Supabase
 * @param {object} supabaseClient - Cliente de Supabase
 */
export function initPresentismo(supabaseClient) {
  supabase = supabaseClient;
}

/**
 * Obtiene el estado de presentismo de una pareja desde la BD
 * @param {string} parejaId - ID de la pareja
 * @returns {Promise<string[]>} - Array de nombres presentes
 */
export async function obtenerPresentes(parejaId) {
  if (!supabase) {
    console.error('Presentismo no inicializado');
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from('parejas')
      .select('presentes')
      .eq('id', parejaId)
      .single();
    
    if (error) {
      console.error('Error obteniendo presentes:', error);
      return [];
    }
    
    return data?.presentes || [];
  } catch (e) {
    console.error('Error obteniendo presentes:', e);
    return [];
  }
}

/**
 * Marca a un jugador como presente
 * @param {string} parejaId - ID de la pareja
 * @param {string} nombre - Nombre del jugador a marcar
 * @returns {Promise<boolean>} - true si se marcó correctamente
 */
export async function marcarPresente(parejaId, nombre) {
  if (!supabase) {
    console.error('Presentismo no inicializado');
    return false;
  }
  
  try {
    // Obtener presentes actuales
    const presentes = await obtenerPresentes(parejaId);
    
    // Si ya está, no hacer nada
    if (presentes.includes(nombre)) {
      return true;
    }
    
    // Agregar el nombre
    const nuevosPresentes = [...presentes, nombre];
    
    const { error } = await supabase
      .from('parejas')
      .update({ presentes: nuevosPresentes })
      .eq('id', parejaId);
    
    if (error) {
      console.error('Error marcando presente:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Error marcando presente:', e);
    return false;
  }
}

/**
 * Marca a ambos jugadores como presentes
 * @param {string} parejaId - ID de la pareja
 * @param {string} nombre1 - Nombre del primer jugador
 * @param {string} nombre2 - Nombre del segundo jugador
 * @returns {Promise<boolean>}
 */
export async function marcarAmbosPresentes(parejaId, nombre1, nombre2) {
  if (!supabase) {
    console.error('Presentismo no inicializado');
    return false;
  }
  
  try {
    const { error } = await supabase
      .from('parejas')
      .update({ presentes: [nombre1, nombre2] })
      .eq('id', parejaId);
    
    if (error) {
      console.error('Error marcando ambos presentes:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Error marcando ambos presentes:', e);
    return false;
  }
}

/**
 * Desmarca a un jugador (lo quita de presentes)
 * @param {string} parejaId - ID de la pareja
 * @param {string} nombre - Nombre del jugador a desmarcar
 * @returns {Promise<boolean>}
 */
export async function desmarcarPresente(parejaId, nombre) {
  if (!supabase) {
    console.error('Presentismo no inicializado');
    return false;
  }
  
  try {
    const presentes = await obtenerPresentes(parejaId);
    const nuevosPresentes = presentes.filter(n => n !== nombre);
    
    const { error } = await supabase
      .from('parejas')
      .update({ presentes: nuevosPresentes })
      .eq('id', parejaId);
    
    if (error) {
      console.error('Error desmarcando presente:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Error desmarcando presente:', e);
    return false;
  }
}

/**
 * Desmarca a ambos jugadores
 * @param {string} parejaId - ID de la pareja
 * @returns {Promise<boolean>}
 */
export async function desmarcarTodos(parejaId) {
  if (!supabase) {
    console.error('Presentismo no inicializado');
    return false;
  }
  
  try {
    const { error } = await supabase
      .from('parejas')
      .update({ presentes: [] })
      .eq('id', parejaId);
    
    if (error) {
      console.error('Error desmarcando todos:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Error desmarcando todos:', e);
    return false;
  }
}

/**
 * Verifica si un jugador está presente
 * @param {string[]} presentes - Array de nombres presentes
 * @param {string} nombre - Nombre a verificar
 * @returns {boolean}
 */
export function estaPresente(presentes, nombre) {
  return presentes.includes(nombre);
}

/**
 * Verifica si la pareja está completa (ambos presentes)
 * @param {string[]} presentes - Array de nombres presentes
 * @param {string} nombre1 - Nombre del primer jugador
 * @param {string} nombre2 - Nombre del segundo jugador
 * @returns {boolean}
 */
export function parejaCompleta(presentes, nombre1, nombre2) {
  return presentes.includes(nombre1) && presentes.includes(nombre2);
}

/**
 * Obtiene un resumen del estado de presentismo
 * @param {string[]} presentes - Array de nombres presentes
 * @param {string} miNombre - Nombre del usuario actual
 * @param {string} companero - Nombre del compañero
 * @returns {{ estado: 'ninguno' | 'solo_yo' | 'solo_companero' | 'completo', yoPresente: boolean, companeroPresente: boolean }}
 */
export function estadoPresentismo(presentes, miNombre, companero) {
  const yoPresente = presentes.includes(miNombre);
  const companeroPresente = presentes.includes(companero);
  
  let estado = 'ninguno';
  if (yoPresente && companeroPresente) {
    estado = 'completo';
  } else if (yoPresente) {
    estado = 'solo_yo';
  } else if (companeroPresente) {
    estado = 'solo_companero';
  }
  
  return { estado, yoPresente, companeroPresente };
}

// === localStorage helpers para UX (toast visto, etc.) ===

const TOAST_VISTO_PREFIX = 'presentismo_toast_visto_';

/**
 * Verifica si el usuario ya vio el toast de presentismo
 * @param {string} torneoId - ID del torneo
 * @param {string} parejaId - ID de la pareja
 * @returns {boolean}
 */
export function toastYaVisto(torneoId, parejaId) {
  try {
    const key = `${TOAST_VISTO_PREFIX}${torneoId}_${parejaId}`;
    return localStorage.getItem(key) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Marca el toast como visto
 * @param {string} torneoId - ID del torneo
 * @param {string} parejaId - ID de la pareja
 */
export function marcarToastVisto(torneoId, parejaId) {
  try {
    const key = `${TOAST_VISTO_PREFIX}${torneoId}_${parejaId}`;
    localStorage.setItem(key, 'true');
  } catch (e) {
    console.error('Error marcando toast visto:', e);
  }
}

/**
 * Limpia el flag de toast visto (para testing)
 * @param {string} torneoId - ID del torneo
 * @param {string} parejaId - ID de la pareja
 */
export function limpiarToastVisto(torneoId, parejaId) {
  try {
    const key = `${TOAST_VISTO_PREFIX}${torneoId}_${parejaId}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Error limpiando toast visto:', e);
  }
}
