/**
 * Módulo de gestión de identidad de pareja
 * Maneja localStorage y parseo de jugadores
 */

const STORAGE_KEY = 'torneo_identidad';

/**
 * Parsea parejas en jugadores individuales
 * @param {Array} parejas - Array de objetos pareja con { id, nombre, grupo, orden }
 * @returns {Array} Array de jugadores individuales
 */
export function parseJugadores(parejas) {
  const jugadores = [];
  
  parejas.forEach(pareja => {
    const partes = pareja.nombre.split(' - ');
    if (partes.length === 2) {
      const [j1, j2] = partes.map(s => s.trim());
      
      jugadores.push({
        nombre: j1,
        nombreBusqueda: j1.toLowerCase(),
        companero: j2,
        parejaId: pareja.id,
        parejaNombre: pareja.nombre,
        grupo: pareja.grupo,
        orden: pareja.orden
      });
      
      jugadores.push({
        nombre: j2,
        nombreBusqueda: j2.toLowerCase(),
        companero: j1,
        parejaId: pareja.id,
        parejaNombre: pareja.nombre,
        grupo: pareja.grupo,
        orden: pareja.orden
      });
    }
  });
  
  return jugadores;
}

/**
 * Lee la identidad guardada en localStorage
 * @returns {Object|null} Objeto con datos de identidad o null si no existe
 */
export function getIdentidad() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const identidad = JSON.parse(saved);
    
    // Validar que tenga los campos necesarios
    if (identidad.parejaId && identidad.parejaNombre) {
      return identidad;
    }
    
    return null;
  } catch (e) {
    console.error('Error leyendo identidad:', e);
    clearIdentidad();
    return null;
  }
}

/**
 * Guarda la identidad en localStorage y registra visita automáticamente
 * @param {Object} identidad - Objeto con parejaId, parejaNombre, miNombre, companero, grupo, orden
 * @param {Object} supabase - Cliente de Supabase (opcional, para tracking)
 */
export function saveIdentidad(identidad, supabase = null) {
  const data = {
    ...identidad,
    validatedAt: new Date().toISOString()
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  
  // Tracking automático de visita (no bloqueante)
  if (supabase) {
    import('../tracking/trackingService.js')
      .then(({ trackVisita }) => trackVisita(supabase, data))
      .catch(err => console.warn('Error tracking visita:', err));
  }
}

/**
 * Borra la identidad guardada
 */
export function clearIdentidad() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Verifica si una combinación de jugador + compañero existe en las parejas
 * @param {String} nombreJugador 
 * @param {String} nombreCompanero 
 * @param {Array} parejas 
 * @returns {Object|null} Pareja encontrada o null
 */
export function verificarPareja(nombreJugador, nombreCompanero, parejas) {
  return parejas.find(p => {
    const [j1, j2] = p.nombre.split(' - ').map(s => s.trim());
    return (j1 === nombreJugador && j2 === nombreCompanero) ||
           (j2 === nombreJugador && j1 === nombreCompanero);
  });
}

/**
 * Genera opciones de compañero para validación (1 correcto + 2 random)
 * @param {String} companeroCorrecto 
 * @param {String} nombreJugador 
 * @param {Array} todosLosJugadores 
 * @returns {Array} Array con 3 opciones shuffleadas
 */
export function generarOpcionesCompanero(companeroCorrecto, nombreJugador, todosLosJugadores) {
  // Filtrar otros jugadores (sin el correcto ni el jugador mismo)
  const otros = todosLosJugadores
    .filter(j => j.nombre !== companeroCorrecto && j.nombre !== nombreJugador)
    .map(j => j.nombre);
  
  // Eliminar duplicados
  const otrosUnicos = [...new Set(otros)];
  
  // Shuffle y tomar 2
  const shuffled = otrosUnicos.sort(() => Math.random() - 0.5);
  const incorrectos = shuffled.slice(0, 2);
  
  // Crear array con 1 correcto + 2 incorrectos
  const opciones = [
    { nombre: companeroCorrecto, correcto: true },
    { nombre: incorrectos[0], correcto: false },
    { nombre: incorrectos[1], correcto: false }
  ];
  
  // Shuffle para que el correcto no esté siempre primero
  return opciones.sort(() => Math.random() - 0.5);
}
