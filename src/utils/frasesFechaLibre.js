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
 * Obtiene una frase aleatoria para fecha libre
 * @returns {string} Frase con emoji
 */
export function obtenerFraseFechaLibre() {
  const index = Math.floor(Math.random() * FRASES_FECHA_LIBRE.length);
  return FRASES_FECHA_LIBRE[index];
}
