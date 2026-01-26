// Re-exportar funciones del módulo centralizado para mantener compatibilidad
import {
  calcularTablaGrupo,
  ordenarTabla,
  ordenarConOverrides,
  detectarEmpatesReales
} from '../../utils/tablaPosiciones.js';

// Exportar con nombres compatibles
export { calcularTablaGrupo };
export const ordenarAutomatico = ordenarTabla;
export { ordenarConOverrides, detectarEmpatesReales };
