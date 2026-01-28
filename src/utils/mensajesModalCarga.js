/**
 * Mensajes divertidos para el modal de carga de resultados
 * Organizados por nivel (SET/PARTIDO) y categoría (GANAR/PERDER/EMPATE)
 * Fácil de modificar para personalizar la experiencia del usuario
 */

// Nivel SET - Mensajes mientras se carga un set específico
export const MENSAJES_SET_GANAR = [
  "¡Bien arrancaste! Contame cómo fue el segundo set",
  "¡Vamos! Arrancaste ganando. ¿Qué pasó en el segundo?",
  "¡Bien ahí! Primer set ganado. Contame del segundo",
  "¡Arrancaste fuerte! ¿Cómo siguió en el segundo set?",
  "¡Bien! Ganaste el primero. Contame qué pasó después"
];

export const MENSAJES_SET_PERDER = [
  "Levantaste en el 2do set?",
  "uhh ¿Cómo te fue en el segundo set?",
  "¿Pudiste remontar en el 2do set?",
  "¿Qué pasó en el segundo set?",
  "Contame del segundo set, ¿Les fue mejor?"
];

export const MENSAJES_SET_EMPATE = [
  "Tremendo! Contame cómo fue el Super Tiebreak!",
  "¡Se viene el Super Tiebreak! Contame cómo terminó",
  "¡Todo al Super Tiebreak! Contame cómo fue",
  "¡Super Tiebreak! Contame qué pasó",
  "¡Que partido ajsutado! Contame cómo fue el Tie Braek!"
];

// Nivel PARTIDO - Mensajes cuando el partido está completo o se puede determinar resultado
export const MENSAJES_PARTIDO_GANAR = [
  "¡Felicitaciones! Partido cerrado",
  "¡Buena victoria!",
  "¡Felicitaciones! Partido ganado!",
  "¡Excelente! Partido ganado",
  "¡Felicitaciones! Palo y a la bolsa!"
];

export const MENSAJES_PARTIDO_PERDER = [
  "Buen partido, la próxima será",
  "Por lo menos ganaste experiencia, buen partido",
  "Buen partido, el próximo va a ser mejor",
  "Buen partido, a seguir entrenando",
  "Buen partido, pensá que despues viene la comida!"
];

export const MENSAJES_PARTIDO_EMPATE = [
  "Campeón, no podes empatar un set!",
  "Revisá porque no se puede empatar!",
  "No se puede empatar un set, revisá los valores",
  "Los valores no pueden ser iguales, corregí el resultado",
  "Un set no puede terminar empatado, revisá los números"
];

/**
 * Obtiene un mensaje aleatorio según nivel y categoría
 * @param {string} nivel - 'SET' o 'PARTIDO'
 * @param {string} categoria - 'GANAR', 'PERDER' o 'EMPATE'
 * @returns {string} Mensaje aleatorio
 */
export function getMensajeModalCarga(nivel, categoria) {
  let mensajes;
  
  if (nivel === 'SET') {
    if (categoria === 'GANAR') {
      mensajes = MENSAJES_SET_GANAR;
    } else if (categoria === 'PERDER') {
      mensajes = MENSAJES_SET_PERDER;
    } else if (categoria === 'EMPATE') {
      mensajes = MENSAJES_SET_EMPATE;
    } else {
      return '';
    }
  } else if (nivel === 'PARTIDO') {
    if (categoria === 'GANAR') {
      mensajes = MENSAJES_PARTIDO_GANAR;
    } else if (categoria === 'PERDER') {
      mensajes = MENSAJES_PARTIDO_PERDER;
    } else if (categoria === 'EMPATE') {
      mensajes = MENSAJES_PARTIDO_EMPATE;
    } else {
      return '';
    }
  } else {
    return '';
  }
  
  if (!mensajes || mensajes.length === 0) {
    return '';
  }
  
  const index = Math.floor(Math.random() * mensajes.length);
  return mensajes[index];
}
