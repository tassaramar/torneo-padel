/**
 * Módulo centralizado para obtener el torneo activo.
 * Reemplaza todas las constantes TORNEO_ID hardcodeadas.
 */

let _torneoId = null;

/**
 * Obtiene el ID del torneo activo desde la BD (con cache en memoria).
 * @param {Object} supabase - Cliente de Supabase
 * @returns {Promise<string|null>} UUID del torneo activo, o null si no hay ninguno
 */
export async function obtenerTorneoActivo(supabase) {
  if (_torneoId) return _torneoId;
  const { data, error } = await supabase.rpc('obtener_torneo_activo');
  if (error) {
    console.error('[torneoActivo] Error al obtener torneo activo:', error);
    return null;
  }
  _torneoId = data;
  return _torneoId;
}

/**
 * Invalida el cache para forzar re-consulta en el próximo llamado.
 * Usar al cambiar de torneo activo (desde torneos.html).
 */
export function invalidarCacheTorneo() {
  _torneoId = null;
}
