/**
 * Mensajes divertidos para mostrar al cargar resultados
 */

export const MENSAJES_VICTORIA = [
  "🎉 ¡Que bien que ganaste! ¡A celebrar!",
  "💪 ¡Tremenda victoria! ¡Felicitaciones!",
  "⭐ ¡Jugaron increíble! ¡Sigan así!",
  "🏆 ¡Campeones! ¿Quién puede pararlos?",
  "🔥 ¡Imparables! ¡Gran partido!",
  "🎊 ¡Victoria épica! ¡Los felicito!",
  "✨ ¡Brillaron en la cancha! ¡Bien ahí!",
  "🚀 ¡Demoledores! ¡Qué partidazo!",
  "🎯 ¡Precisión quirúrgica! Gran victoria",
  "💎 ¡Partido de oro! ¡Fenomenal!"
];

export const MENSAJES_DERROTA = [
  "😔 Que lástima que perdiste... ¡La próxima es tuya!",
  "💙 No fue tu día, pero vas a volver más fuerte",
  "🌟 Perdieron la batalla, pero no la guerra",
  "🎯 La revancha va a ser épica, ¡a entrenar!",
  "💪 Cabeza arriba, el próximo partido es el bueno",
  "🔄 A veces se gana, a veces se aprende",
  "⚡ El que persevera, alcanza. ¡Vamos todavía!",
  "🌈 Después de la tormenta, viene la calma",
  "🎾 No es fracaso, es experiencia. ¡Arriba!",
  "✊ Los grandes también pierden. ¡A levantarse!"
];

export const MENSAJES_EMPATE = [
  "🤔 Mmm... no se puede empatar en pádel, revisá los números",
  "🎾 Houston, tenemos un problema: ¡el empate no existe!",
  "😅 Lindos los empates, pero no aplican acá",
  "🤷 El pádel no hace tablas, alguien tiene que ganar",
  "❌ Error 404: Empate no encontrado en pádel"
];

/**
 * Obtiene un mensaje random de un array
 */
export function getMensajeRandom(mensajes) {
  const index = Math.floor(Math.random() * mensajes.length);
  return mensajes[index];
}

/**
 * Determina el ganador y retorna mensaje apropiado
 * @param {number} gamesA - Games de pareja A
 * @param {number} gamesB - Games de pareja B
 * @param {boolean} soyParejaA - Si el usuario es pareja A
 * @returns {Object} { ganador: 'yo'|'rival'|'empate', mensaje: string, tipo: 'victoria'|'derrota'|'empate' }
 */
export function getMensajeResultado(gamesA, gamesB, soyParejaA) {
  if (gamesA === gamesB) {
    return {
      ganador: 'empate',
      mensaje: getMensajeRandom(MENSAJES_EMPATE),
      tipo: 'empate'
    };
  }

  const ganaA = gamesA > gamesB;
  const yoGano = (ganaA && soyParejaA) || (!ganaA && !soyParejaA);

  if (yoGano) {
    return {
      ganador: 'yo',
      mensaje: getMensajeRandom(MENSAJES_VICTORIA),
      tipo: 'victoria'
    };
  } else {
    return {
      ganador: 'rival',
      mensaje: getMensajeRandom(MENSAJES_DERROTA),
      tipo: 'derrota'
    };
  }
}
