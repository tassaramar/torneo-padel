/**
 * Módulo centralizado para cálculo de tablas de posiciones
 * 
 * Criterios de ordenamiento:
 * 1. Puntos (P) - descendente
 * 2. Diferencia de games (DG) - descendente
 * 3. Games a favor (GF) - descendente
 * 4. Enfrentamiento directo - si se enfrentaron, la ganadora primero
 * 5. Nombre alfabético - desempate final
 * 
 * Overrides manuales: Solo se aplican cuando hay empate real (mismo P, DG, GF, sin enfrentamiento directo)
 * 
 * Puntos configurables:
 * - PUNTOS_POR_VICTORIA: Puntos que se otorgan al ganador (por defecto: 2)
 * - PUNTOS_POR_DERROTA: Puntos que se otorgan al perdedor (por defecto: 1)
 * 
 * TODO: En el futuro, estos valores se leerán de la configuración del torneo en la BD
 */

// Configuración de puntos (por defecto)
// TODO: En el futuro, estos valores se leerán de la tabla torneos o una tabla de configuración
export const PUNTOS_POR_VICTORIA = 2;
export const PUNTOS_POR_DERROTA = 1;

/**
 * Valida si un partido cuenta para la tabla de posiciones
 */
export function esPartidoValido(partido) {
  return (partido.estado === 'confirmado' || partido.estado === 'a_confirmar') &&
         partido.games_a !== null && 
         partido.games_b !== null;
}

/**
 * Calcula las estadísticas básicas de una pareja desde los partidos
 * @param {string} parejaId - ID de la pareja
 * @param {Array} partidos - Array de partidos
 * @param {Object} configPuntos - Configuración de puntos { victoria: number, derrota: number }
 */
function calcularEstadisticasPareja(parejaId, partidos, configPuntos = {}) {
  const puntosVictoria = configPuntos.victoria ?? PUNTOS_POR_VICTORIA;
  const puntosDerrota = configPuntos.derrota ?? PUNTOS_POR_DERROTA;

  const stats = {
    pareja_id: parejaId,
    nombre: null, // Se completa después
    PJ: 0,
    PG: 0,
    PP: 0,
    GF: 0,
    GC: 0,
    DG: 0,
    P: 0
  };

  for (const p of partidos) {
    if (!esPartidoValido(p)) continue;

    const esParejaA = p.pareja_a_id === parejaId || p.pareja_a?.id === parejaId;
    const esParejaB = p.pareja_b_id === parejaId || p.pareja_b?.id === parejaId;

    if (!esParejaA && !esParejaB) continue;

    const ga = Number(p.games_a);
    const gb = Number(p.games_b);

    stats.PJ += 1;

    if (esParejaA) {
      stats.GF += ga;
      stats.GC += gb;
      if (ga > gb) {
        stats.P += puntosVictoria;
        stats.PG += 1;
      } else if (gb > ga) {
        stats.P += puntosDerrota;
        stats.PP += 1;
      }
    } else {
      stats.GF += gb;
      stats.GC += ga;
      if (gb > ga) {
        stats.P += puntosVictoria;
        stats.PG += 1;
      } else if (ga > gb) {
        stats.P += puntosDerrota;
        stats.PP += 1;
      }
    }
  }

  stats.DG = stats.GF - stats.GC;
  return stats;
}

/**
 * Obtiene el resultado del enfrentamiento directo entre dos parejas
 * @returns 'ganaA' | 'ganaB' | null (si no se enfrentaron o hay empate)
 */
export function obtenerEnfrentamientoDirecto(parejaAId, parejaBId, partidos) {
  for (const p of partidos) {
    if (!esPartidoValido(p)) continue;

    const idA = p.pareja_a_id || p.pareja_a?.id;
    const idB = p.pareja_b_id || p.pareja_b?.id;

    const esEnfrentamiento = 
      (idA === parejaAId && idB === parejaBId) ||
      (idA === parejaBId && idB === parejaAId);

    if (!esEnfrentamiento) continue;

    const ga = Number(p.games_a);
    const gb = Number(p.games_b);

    // Determinar quién ganó según el orden del partido
    if (idA === parejaAId && idB === parejaBId) {
      if (ga > gb) return 'ganaA';
      if (gb > ga) return 'ganaB';
    } else {
      if (gb > ga) return 'ganaA';
      if (ga > gb) return 'ganaB';
    }

    return null; // Empate en games (no debería pasar)
  }

  return null; // No se enfrentaron
}

/**
 * Compara dos parejas considerando enfrentamiento directo
 */
function compararParejas(a, b, partidos) {
  // 1. Puntos (P) - descendente
  if (b.P !== a.P) return b.P - a.P;

  // 2. Diferencia de games (DG) - descendente
  if (b.DG !== a.DG) return b.DG - a.DG;

  // 3. Games a favor (GF) - descendente
  if (b.GF !== a.GF) return b.GF - a.GF;

  // 4. Enfrentamiento directo
  if (partidos) {
    const enfrentamiento = obtenerEnfrentamientoDirecto(a.pareja_id, b.pareja_id, partidos);
    if (enfrentamiento === 'ganaA') return -1; // A antes que B
    if (enfrentamiento === 'ganaB') return 1;  // B antes que A
  }

  // 5. Nombre alfabético - desempate final
  return String(a.nombre || '').localeCompare(String(b.nombre || ''));
}

/**
 * Ordena una tabla automáticamente usando todos los criterios
 */
export function ordenarTabla(tabla, partidos) {
  return [...tabla].sort((a, b) => compararParejas(a, b, partidos));
}

/**
 * Calcula la tabla de posiciones de un grupo desde los partidos
 * @param {Array} partidos - Array de partidos del grupo
 * @param {Array} parejas - Array de parejas del grupo (opcional, para obtener nombres)
 * @param {Object} configPuntos - Configuración de puntos { victoria: number, derrota: number } (opcional)
 * @returns {Array} Tabla con estadísticas de cada pareja
 */
export function calcularTablaGrupo(partidos, parejas = [], configPuntos = {}) {
  // Crear mapa de parejas para obtener nombres
  const parejasMap = {};
  parejas.forEach(p => {
    parejasMap[p.id] = p.nombre;
  });

  // Obtener IDs únicos de parejas
  const parejasIds = new Set();
  partidos.forEach(p => {
    const idA = p.pareja_a_id || p.pareja_a?.id;
    const idB = p.pareja_b_id || p.pareja_b?.id;
    if (idA) parejasIds.add(idA);
    if (idB) parejasIds.add(idB);
  });

  // Calcular estadísticas para cada pareja
  const tabla = Array.from(parejasIds).map(parejaId => {
    const stats = calcularEstadisticasPareja(parejaId, partidos, configPuntos);
    
    // Obtener nombre de la pareja
    if (parejasMap[parejaId]) {
      stats.nombre = parejasMap[parejaId];
    } else {
      // Intentar obtener del primer partido donde aparece
      const partido = partidos.find(p => 
        (p.pareja_a_id === parejaId || p.pareja_a?.id === parejaId) ||
        (p.pareja_b_id === parejaId || p.pareja_b?.id === parejaId)
      );
      if (partido) {
        if (partido.pareja_a_id === parejaId || partido.pareja_a?.id === parejaId) {
          stats.nombre = partido.pareja_a?.nombre || 'Sin nombre';
        } else {
          stats.nombre = partido.pareja_b?.nombre || 'Sin nombre';
        }
      } else {
        stats.nombre = 'Sin nombre';
      }
    }

    return stats;
  });

  // Ordenar automáticamente
  return ordenarTabla(tabla, partidos);
}

/**
 * Carga overrides manuales desde la base de datos
 */
export async function cargarOverrides(supabase, torneoId, grupoId) {
  const { data, error } = await supabase
    .from('posiciones_manual')
    .select('pareja_id, orden_manual')
    .eq('torneo_id', torneoId)
    .eq('grupo_id', grupoId);

  if (error) {
    console.error('Error cargando overrides:', error);
    return {};
  }

  const overridesMap = {};
  (data || []).forEach(ov => {
    if (ov.orden_manual !== null) {
      overridesMap[ov.pareja_id] = ov.orden_manual;
    }
  });

  return overridesMap;
}

/**
 * Detecta si dos parejas están en empate real (mismo P, DG, GF, sin enfrentamiento directo)
 */
function esEmpateReal(a, b, partidos) {
  if (a.P !== b.P || a.DG !== b.DG || a.GF !== b.GF) return false;
  
  // Si se enfrentaron, no es empate real (el enfrentamiento ya desempata)
  if (partidos) {
    const enfrentamiento = obtenerEnfrentamientoDirecto(a.pareja_id, b.pareja_id, partidos);
    if (enfrentamiento !== null) return false; // Hay enfrentamiento, no es empate
  }
  
  return true;
}

/**
 * Aplica overrides SOLO en caso de empate real
 * Overrides solo se aplican cuando hay empate (mismo P, DG, GF, sin enfrentamiento directo)
 */
export function ordenarConOverrides(tabla, overridesMap, partidos) {
  if (!overridesMap || Object.keys(overridesMap).length === 0) {
    return ordenarTabla(tabla, partidos);
  }

  // Primero ordenar automáticamente
  const tablaOrdenada = ordenarTabla(tabla, partidos);

  // Detectar grupos de empate real
  const gruposEmpate = [];
  const procesados = new Set();

  for (let i = 0; i < tablaOrdenada.length; i++) {
    if (procesados.has(i)) continue;

    const grupo = [i];
    const parejaActual = tablaOrdenada[i];

    // Buscar otras parejas en empate real con esta
    for (let j = i + 1; j < tablaOrdenada.length; j++) {
      if (procesados.has(j)) continue;

      const parejaComparar = tablaOrdenada[j];
      
      // Si no están empatadas, no puede haber más en el grupo
      if (!esEmpateReal(parejaActual, parejaComparar, partidos)) {
        break;
      }

      grupo.push(j);
      procesados.add(j);
    }

    if (grupo.length >= 2) {
      gruposEmpate.push(grupo);
      grupo.forEach(idx => procesados.add(idx));
    }
  }

  // Aplicar overrides solo en grupos de empate
  const resultado = [...tablaOrdenada];

  gruposEmpate.forEach(grupo => {
    const parejasEnGrupo = grupo.map(idx => tablaOrdenada[idx]);
    
    // Separar las que tienen override de las que no
    const conOverride = [];
    const sinOverride = [];

    parejasEnGrupo.forEach(pareja => {
      if (overridesMap[pareja.pareja_id] !== undefined) {
        conOverride.push({ pareja, orden: overridesMap[pareja.pareja_id] });
      } else {
        sinOverride.push(pareja);
      }
    });

    // Ordenar las que tienen override por orden_manual
    conOverride.sort((a, b) => a.orden - b.orden);

    // Reconstruir el grupo: primero las con override, luego las sin override
    const grupoOrdenado = [
      ...conOverride.map(x => x.pareja),
      ...sinOverride
    ];

    // Aplicar el nuevo orden en el resultado
    grupo.forEach((idxOriginal, posEnGrupo) => {
      const nuevaPareja = grupoOrdenado[posEnGrupo];
      const idxNuevo = resultado.findIndex(p => p.pareja_id === nuevaPareja.pareja_id);
      
      if (idxNuevo !== -1 && idxNuevo !== idxOriginal) {
        // Intercambiar posiciones
        [resultado[idxOriginal], resultado[idxNuevo]] = 
          [resultado[idxNuevo], resultado[idxOriginal]];
      }
    });
  });

  return resultado;
}

/**
 * Detecta empates reales considerando enfrentamiento directo y overrides
 */
export function detectarEmpatesReales(tabla, partidos, overridesMap = {}) {
  // Asegurar que overridesMap sea un objeto, no null
  const ovMap = overridesMap || {};
  
  const buckets = new Map();
  
  for (const r of tabla) {
    // Clave: P|DG|GF
    const key = `${r.P}|${r.DG}|${r.GF}`;
    
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }

  // Colores para diferentes grupos de empate
  const colors = [
    { bg: '#fff3cd', border: '#d39e00' }, // Amarillo
    { bg: '#e3f2fd', border: '#1976d2' }, // Azul
    { bg: '#e8f5e9', border: '#43a047' }, // Verde
    { bg: '#fce4ec', border: '#c2185b' }, // Rosa
    { bg: '#f3e5f5', border: '#7b1fa2' }, // Púrpura
    { bg: '#fff8e1', border: '#f57c00' }, // Naranja claro
  ];

  const tieGroups = [];
  const tieSet = new Set();
  const sizes = [];
  let colorIndex = 0;

  for (const arr of buckets.values()) {
    if (arr.length < 2) continue;

    // Filtrar: solo considerar empates reales (sin enfrentamiento directo)
    const empatesReales = [];
    for (let i = 0; i < arr.length; i++) {
      let esEmpateReal = true;
      
      // Verificar si tiene enfrentamiento directo con alguna otra del grupo
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        
        const enfrentamiento = obtenerEnfrentamientoDirecto(
          arr[i].pareja_id, 
          arr[j].pareja_id, 
          partidos
        );
        
        if (enfrentamiento !== null) {
          esEmpateReal = false;
          break;
        }
      }
      
      // Verificar si tiene override aplicado (ya está resuelto)
      if (ovMap[arr[i].pareja_id] !== undefined) {
        esEmpateReal = false;
      }
      
      if (esEmpateReal) {
        empatesReales.push(arr[i]);
      }
    }

    if (empatesReales.length >= 2) {
      sizes.push(empatesReales.length);
      const color = colors[colorIndex % colors.length];
      
      const group = {
        parejaIds: empatesReales.map(x => x.pareja_id),
        color: color,
        size: empatesReales.length
      };
      
      tieGroups.push(group);
      empatesReales.forEach(x => tieSet.add(x.pareja_id));
      colorIndex++;
    }
  }

  let tieLabel = '';
  if (sizes.length) {
    sizes.sort((a, b) => b - a);
    tieLabel = `Empate real: ${sizes.join(' + ')}`;
  }

  return { tieSet, tieLabel, tieGroups };
}

/**
 * Agrega metadata de overrides aplicados a cada pareja
 */
export function agregarMetadataOverrides(tabla, overridesMap) {
  return tabla.map(pareja => ({
    ...pareja,
    tieneOverrideAplicado: overridesMap?.[pareja.pareja_id] !== undefined,
    ordenManual: overridesMap?.[pareja.pareja_id] || null
  }));
}
