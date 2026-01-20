/**
 * Frases divertidas para mostrar cuando un equipo tiene fecha libre
 * Cada frase incluye un emoji temático para hacerlo más visual
 */

const FRASES_FECHA_LIBRE = [
  '☕ A tomar un café',
  '🧘 A meditar un rato',
  '📋 A revisar la estrategia',
  '🦵 A descansar las piernas',
  '💧 A hidratarse',
  '👀 A hacer comentarios desde afuera',
  '🤸 A estirar un poco',
  '👁️ A mirar cómo juegan los demás',
  '🧠 A pensar jugadas maestras',
  '🤝 A charlar con los sponsors',
  '📱 A checkear Instagram',
  '🎾 A practicar el saque mental',
  '📝 A buscar excusas por adelantado',
  '💺 A calentar el banco',
  '⏸️ De break estratégico'
];

/**
 * Mezcla un array usando algoritmo Fisher-Yates
 * @param {Array} array - Array a mezclar
 * @returns {Array} Array mezclado
 */
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Obtiene una lista de frases sin repetir
 * @param {number} cantidad - Cantidad de frases necesarias
 * @returns {Array<string>} Array de frases únicas
 */
export function obtenerFrasesUnicas(cantidad) {
  const frasesMezcladas = shuffle(FRASES_FECHA_LIBRE);
  
  // Si se necesitan más frases que las disponibles, repetir el array mezclado
  if (cantidad > frasesMezcladas.length) {
    const veces = Math.ceil(cantidad / frasesMezcladas.length);
    const frasesExtendidas = [];
    for (let i = 0; i < veces; i++) {
      frasesExtendidas.push(...shuffle(FRASES_FECHA_LIBRE));
    }
    return frasesExtendidas.slice(0, cantidad);
  }
  
  return frasesMezcladas.slice(0, cantidad);
}
