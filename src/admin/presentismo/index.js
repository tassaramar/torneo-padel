/**
 * Orquestador del módulo de presentismo admin
 * Re-exporta las funciones init de cada submódulo
 */

import { initToggleGlobal } from './toggle.js';
import { initEstadisticas, refreshEstadisticas } from './stats.js';
import { initOperacionesMasivas } from './bulk.js';
import { initControlGranular, refreshParejas } from './granular.js';
import { initAusentes, refreshAusentes } from './ausentes.js';

export {
  initToggleGlobal,
  initEstadisticas,
  initOperacionesMasivas,
  initControlGranular,
  initAusentes,
  refreshEstadisticas,
  refreshParejas,
  refreshAusentes
};

/**
 * Refresca todas las vistas de datos (stats, parejas, ausentes)
 */
export async function refreshTodasLasVistas() {
  await Promise.all([
    refreshEstadisticas(),
    refreshParejas(),
    refreshAusentes()
  ]);
}
