/**
 * Módulo centralizado para cálculo de tablas de posiciones
 * 
 * MODELO DE DATOS (nuevo):
 * - Fuente de verdad: set1_*, set2_*, set3_*, num_sets
 * - Derivados (BD): sets_a/sets_b, games_totales_a/games_totales_b
 * 
 * Estadísticas por pareja:
 * - PJ: Partidos jugados
 * - PG: Partidos ganados
 * - PP: Partidos perdidos
 * - SF: Sets a favor
 * - SC: Sets en contra
 * - DS: Diferencia de sets (SF - SC)
 * - GF: Games a favor (totales)
 * - GC: Games en contra (totales)
 * - DG: Diferencia de games (GF - GC)
 * - P: Puntos
 * 
 * Criterios de ordenamiento:
 * 1. Puntos (P) - descendente
 * 2. Diferencia de sets (DS) - descendente
 * 3. Diferencia de games (DG) - descendente
 * 4. Games a favor (GF) - descendente
 * 5. Enfrentamiento directo - si se enfrentaron, la ganadora primero
 * 6. Nombre alfabético - desempate final
 * 
 * Overrides manuales: Solo se aplican cuando hay empate real
 */

import { 
  tieneResultado, 
  calcularSetsGanados, 
  calcularGamesTotales,
  determinarGanador 
} from './formatoResultado.js';

// Configuración de puntos (por defecto)
export const PUNTOS_POR_VICTORIA = 2;
export const PUNTOS_POR_DERROTA = 1;

/**
 * Valida si un partido cuenta para la tabla de posiciones
 * @param {Object} partido - Objeto del partido
 * @returns {boolean}
 */
export function esPartidoValido(partido) {
  // Estado válido + tiene resultado cargado
  const estadoValido = partido.estado === 'confirmado' || partido.estado === 'a_confirmar';
  return estadoValido && tieneResultado(partido);
}

/**
 * Calcula las estadísticas de una pareja desde los partidos
 * Incluye Sets (SF/SC/DS) y Games (GF/GC/DG)
 * @param {string} parejaId - ID de la pareja
 * @param {Array} partidos - Array de partidos
 * @param {Object} configPuntos - Configuración de puntos { victoria: number, derrota: number }
 */
function calcularEstadisticasPareja(parejaId, partidos, configPuntos = {}) {
  const puntosVictoria = configPuntos.victoria ?? PUNTOS_POR_VICTORIA;
  const puntosDerrota = configPuntos.derrota ?? PUNTOS_POR_DERROTA;

  const stats = {
    pareja_id: parejaId,
    nombre: null,
    PJ: 0,   // Partidos jugados
    PG: 0,   // Partidos ganados
    PP: 0,   // Partidos perdidos
    SF: 0,   // Sets a favor
    SC: 0,   // Sets en contra
    DS: 0,   // Diferencia de sets
    GF: 0,   // Games a favor (totales)
    GC: 0,   // Games en contra (totales)
    DG: 0,   // Diferencia de games
    P: 0     // Puntos
  };

  for (const p of partidos) {
    if (!esPartidoValido(p)) continue;

    const esParejaA = p.pareja_a_id === parejaId || p.pareja_a?.id === parejaId;
    const esParejaB = p.pareja_b_id === parejaId || p.pareja_b?.id === parejaId;

    if (!esParejaA && !esParejaB) continue;

    // Obtener sets y games (desde derivados o calculados)
    const { setsA, setsB } = calcularSetsGanados(p);
    const { gamesTotalesA, gamesTotalesB } = calcularGamesTotales(p);

    stats.PJ += 1;

    if (esParejaA) {
      // Soy pareja A
      stats.SF += setsA;
      stats.SC += setsB;
      stats.GF += gamesTotalesA;
      stats.GC += gamesTotalesB;
      
      // Determinar ganador para puntos
      const ganador = determinarGanador(p);
      if (ganador === 'a') {
        stats.P += puntosVictoria;
        stats.PG += 1;
      } else if (ganador === 'b') {
        stats.P += puntosDerrota;
        stats.PP += 1;
      }
    } else {
      // Soy pareja B
      stats.SF += setsB;
      stats.SC += setsA;
      stats.GF += gamesTotalesB;
      stats.GC += gamesTotalesA;
      
      const ganador = determinarGanador(p);
      if (ganador === 'b') {
        stats.P += puntosVictoria;
        stats.PG += 1;
      } else if (ganador === 'a') {
        stats.P += puntosDerrota;
        stats.PP += 1;
      }
    }
  }

  stats.DS = stats.SF - stats.SC;
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

    // Usar determinarGanador que trabaja con sets
    const ganador = determinarGanador(p);
    
    if (ganador === 'a') {
      // Ganó pareja A del partido
      if (idA === parejaAId) return 'ganaA';
      return 'ganaB';
    } else if (ganador === 'b') {
      // Ganó pareja B del partido
      if (idB === parejaAId) return 'ganaA';
      return 'ganaB';
    }

    return null; // Empate (no debería pasar)
  }

  return null; // No se enfrentaron
}

/**
 * Compara dos parejas para ordenamiento
 * Orden: P → DS → DG → GF → H2H → Nombre
 */
function compararParejas(a, b, partidos) {
  // 1. Puntos (P) - descendente
  if (b.P !== a.P) return b.P - a.P;

  // 2. Diferencia de sets (DS) - descendente
  if (b.DS !== a.DS) return b.DS - a.DS;

  // 3. Diferencia de games (DG) - descendente
  if (b.DG !== a.DG) return b.DG - a.DG;

  // 4. Games a favor (GF) - descendente
  if (b.GF !== a.GF) return b.GF - a.GF;

  // 5. Enfrentamiento directo
  if (partidos) {
    const enfrentamiento = obtenerEnfrentamientoDirecto(a.pareja_id, b.pareja_id, partidos);
    if (enfrentamiento === 'ganaA') return -1; // A antes que B
    if (enfrentamiento === 'ganaB') return 1;  // B antes que A
  }

  // 6. Nombre alfabético - desempate final
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
 * Detecta si dos parejas están en empate real
 * Empate real = mismo P, DS, DG, GF, sin enfrentamiento directo
 */
function esEmpateReal(a, b, partidos) {
  if (a.P !== b.P || a.DS !== b.DS || a.DG !== b.DG || a.GF !== b.GF) return false;
  
  // Si se enfrentaron, no es empate real
  if (partidos) {
    const enfrentamiento = obtenerEnfrentamientoDirecto(a.pareja_id, b.pareja_id, partidos);
    if (enfrentamiento !== null) return false;
  }
  
  return true;
}

/**
 * Aplica overrides SOLO en caso de empate real
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

    for (let j = i + 1; j < tablaOrdenada.length; j++) {
      if (procesados.has(j)) continue;

      const parejaComparar = tablaOrdenada[j];
      
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
    
    const conOverride = [];
    const sinOverride = [];

    parejasEnGrupo.forEach(pareja => {
      if (overridesMap[pareja.pareja_id] !== undefined) {
        conOverride.push({ pareja, orden: overridesMap[pareja.pareja_id] });
      } else {
        sinOverride.push(pareja);
      }
    });

    conOverride.sort((a, b) => a.orden - b.orden);

    const grupoOrdenado = [
      ...conOverride.map(x => x.pareja),
      ...sinOverride
    ];

    grupo.forEach((idxOriginal, posEnGrupo) => {
      const nuevaPareja = grupoOrdenado[posEnGrupo];
      const idxNuevo = resultado.findIndex(p => p.pareja_id === nuevaPareja.pareja_id);
      
      if (idxNuevo !== -1 && idxNuevo !== idxOriginal) {
        [resultado[idxOriginal], resultado[idxNuevo]] = 
          [resultado[idxNuevo], resultado[idxOriginal]];
      }
    });
  });

  return resultado;
}

/**
 * Detecta empates reales considerando todos los criterios
 */
export function detectarEmpatesReales(tabla, partidos, overridesMap = {}) {
  const ovMap = overridesMap || {};
  
  const buckets = new Map();
  
  for (const r of tabla) {
    // Clave: P|DS|DG|GF (todos los criterios antes de H2H)
    const key = `${r.P}|${r.DS}|${r.DG}|${r.GF}`;
    
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }

  const colors = [
    { bg: '#fff3cd', border: '#d39e00' },
    { bg: '#e3f2fd', border: '#1976d2' },
    { bg: '#e8f5e9', border: '#43a047' },
    { bg: '#fce4ec', border: '#c2185b' },
    { bg: '#f3e5f5', border: '#7b1fa2' },
    { bg: '#fff8e1', border: '#f57c00' },
  ];

  const tieGroups = [];
  const tieSet = new Set();
  const sizes = [];
  let colorIndex = 0;

  for (const arr of buckets.values()) {
    if (arr.length < 2) continue;

    const empatesReales = [];
    for (let i = 0; i < arr.length; i++) {
      let esEmpate = true;
      
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        
        const enfrentamiento = obtenerEnfrentamientoDirecto(
          arr[i].pareja_id, 
          arr[j].pareja_id, 
          partidos
        );
        
        if (enfrentamiento !== null) {
          esEmpate = false;
          break;
        }
      }
      
      if (ovMap[arr[i].pareja_id] !== undefined) {
        esEmpate = false;
      }
      
      if (esEmpate) {
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
