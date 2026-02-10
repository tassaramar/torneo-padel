/**
 * Lógica compartida para la cola de partidos del fixture
 * Usado por: fixture.js, vistaPersonal.js
 */

import { tieneResultado } from './formatoResultado.js';

/**
 * Determina si un partido tiene resultado cargado
 */
export function esPartidoFinalizado(partido) {
  return tieneResultado(partido);
}

/**
 * Determina si un partido está pendiente (no finalizado, no en juego, no terminado)
 */
export function esPartidoPendiente(partido) {
  return !esPartidoFinalizado(partido) && partido.estado !== 'en_juego' && partido.estado !== 'terminado';
}

/**
 * Determina si un partido va en "Ya jugados" (tiene resultado o fue marcado terminado)
 */
export function esPartidoYaJugado(partido) {
  return esPartidoFinalizado(partido) || partido.estado === 'terminado';
}

/**
 * Calcula la cola sugerida de partidos pendientes
 * Orden: por ronda ascendente, intercalando grupos dentro de cada ronda
 * @param {Array} partidos - Todos los partidos del torneo
 * @param {Array} grupos - Todos los grupos del torneo
 * @returns {Array} - Cola ordenada de partidos pendientes
 */
export function calcularColaSugerida(partidos, grupos) {
  // Filtrar solo partidos pendientes
  const pendientes = partidos.filter(p => esPartidoPendiente(p));
  
  // Grupos ordenados alfabéticamente
  const gruposOrdenados = grupos.map(g => g.nombre).sort();
  
  // Crear mapa de partidos por ronda y grupo
  const porRondaYGrupo = {};
  pendientes.forEach(p => {
    const ronda = p.ronda || 999;
    const grupo = p.grupos?.nombre || 'Sin Grupo';
    const key = `${ronda}-${grupo}`;
    if (!porRondaYGrupo[key]) {
      porRondaYGrupo[key] = [];
    }
    porRondaYGrupo[key].push(p);
  });
  
  // Obtener rondas únicas y ordenarlas
  const rondasSet = new Set();
  pendientes.forEach(p => {
    if (p.ronda) rondasSet.add(p.ronda);
  });
  const rondas = Array.from(rondasSet).sort((a, b) => a - b);
  
  // Construir cola intercalando grupos por ronda
  const cola = [];
  rondas.forEach(ronda => {
    // Para cada grupo en orden, agregar sus partidos de esta ronda
    gruposOrdenados.forEach(grupo => {
      const key = `${ronda}-${grupo}`;
      const partidosDelGrupo = porRondaYGrupo[key] || [];
      cola.push(...partidosDelGrupo);
    });
  });
  
  return cola;
}

/**
 * Crea un mapa de ID de partido -> posición global en la cola
 * @param {Array} cola - Cola de partidos (resultado de calcularColaSugerida)
 * @returns {Map} - Map(partidoId -> posición global 1-based)
 */
export function crearMapaPosiciones(cola) {
  const mapa = new Map();
  cola.forEach((p, i) => {
    mapa.set(p.id, i + 1);
  });
  return mapa;
}
