/**
 * Labels centralizados para rondas de copa.
 * Fuente única de verdad — importar desde acá en lugar de definir labels localmente.
 */

const LABELS_LARGO = {
  QF:     'Cuartos de final',
  SF:     'Semifinal',
  F:      'Final',
  '3P':   '3er y 4to puesto',
  direct: 'Final',
};

const LABELS_CORTO = {
  QF:     'Cuartos',
  SF:     'Semi',
  F:      'Final',
  '3P':   '3° Puesto',
  direct: 'Final',
};

/**
 * Retorna el label de una ronda de copa.
 * @param {string} ronda - Código de ronda: 'QF', 'SF', 'F', '3P', 'direct'
 * @param {boolean} corto - Si true, usa labels cortos (para UI compacta)
 * @returns {string} Label localizado, o el código original si no se reconoce, o '' si ronda es falsy
 */
export function labelRonda(ronda, corto = false) {
  if (!ronda) return '';
  return (corto ? LABELS_CORTO : LABELS_LARGO)[ronda] ?? ronda;
}
