/**
 * Motor de matchups para copas v2.
 * Funciones puras, sin IO, sin dependencias de Supabase.
 *
 * Recibe standings enriquecidos (del RPC obtener_standings_torneo + enriquecimiento JS)
 * y reglas del esquema de copa.
 * Retorna pool de clasificados y cruces optimizados.
 */

// ============================================================
// Helper interno
// ============================================================

function esEmpateStats(a, b) {
  return (
    a.puntos === b.puntos &&
    a.ds === b.ds &&
    (a.dg || 0) === (b.dg || 0) &&
    a.gf === b.gf
  );
}

function _signo(n) { return n >= 0 ? '+' : ''; }

// ============================================================
// Función 1: cmpStandings
// ============================================================

/**
 * Comparador para standings cross-grupo. Orden descendente por stats, ascendente por sorteo.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export function cmpStandings(a, b) {
  if (b.puntos !== a.puntos) return b.puntos - a.puntos;
  if (b.ds !== a.ds) return b.ds - a.ds;
  if ((b.dg || 0) !== (a.dg || 0)) return (b.dg || 0) - (a.dg || 0);
  if (b.gf !== a.gf) return b.gf - a.gf;
  const sA = a.sorteo_orden ?? 999999;
  const sB = b.sorteo_orden ?? 999999;
  if (sA !== sB) return sA - sB;
  return String(a.nombre).localeCompare(String(b.nombre));
}

// ============================================================
// Función 2: armarPoolParaCopa
// ============================================================

/**
 * Construye la lista ordenada de clasificados para una copa,
 * respetando las reglas del esquema.
 *
 * @param {Array}  standings          - Standings enriquecidos del RPC
 * @param {Array}  grupos             - Array de grupos { id, nombre }
 * @param {Array}  reglas             - Reglas del esquema (campo esquema.reglas)
 * @param {Set}    equiposYaUsadosIds - Set<string> de pareja_id ya usados
 * @returns {{ pool, pendientes }}
 */
export function armarPoolParaCopa(standings, grupos, reglas, equiposYaUsadosIds) {
  const gruposCompletosIds = new Set(
    standings.filter(s => s.grupo_completo).map(s => s.grupo_id)
  );
  const gruposIncompletos = grupos.filter(g => !gruposCompletosIds.has(g.id));

  // Excluir equipos ya usados
  const standingsDisponibles = standings.filter(
    s => !equiposYaUsadosIds.has(s.pareja_id)
  );

  const pool = [];
  const pendientes = [];

  const hasGlobal = reglas.some(r => r.modo === 'global');

  if (hasGlobal) {
    const globalRule = reglas.find(r => r.modo === 'global') || {};
    const desde = globalRule.desde || 1;
    const hasta = globalRule.hasta || 4;

    const allSorted = standingsDisponibles
      .filter(s => s.grupo_completo)
      .sort(cmpStandings);

    const inScope = allSorted.slice(desde - 1, hasta);
    inScope.forEach((t, i) => {
      pool.push({ ...t, seed: desde + i, grupoId: t.grupo_id, grupoNombre: t.grupoNombre });
    });

    for (const g of gruposIncompletos) {
      pendientes.push({ grupoId: g.id, grupoNombre: g.nombre });
    }

  } else {
    // Seeding por posición de grupo
    for (const regla of reglas) {
      const posicion = regla.posicion;
      const cantidad = regla.cantidad;
      const criterio = regla.criterio;

      let candidates = standingsDisponibles
        .filter(s => s.posicion_en_grupo === posicion && s.grupo_completo)
        .sort(cmpStandings);

      if (!criterio) {
        // Sin criterio: uno por grupo (todos los grupos completos aportan esta posición)
        candidates.forEach(t => {
          pool.push({ ...t, seed: pool.length + 1, grupoId: t.grupo_id, grupoNombre: t.grupoNombre });
        });
        for (const g of gruposIncompletos) {
          if (!pendientes.some(p => p.grupoId === g.id)) {
            pendientes.push({ grupoId: g.id, grupoNombre: g.nombre });
          }
        }
      } else {
        if (criterio === 'peor') candidates = [...candidates].reverse();
        const limit = cantidad || candidates.length;
        const taken = candidates.slice(0, limit);
        taken.forEach(t => {
          pool.push({ ...t, seed: pool.length + 1, grupoId: t.grupo_id, grupoNombre: t.grupoNombre });
        });
      }
    }
  }

  return { pool, pendientes };
}

// ============================================================
// Función 3: seedingMejorPeor
// ============================================================

/**
 * Aplica seeding Mejor-Peor al pool: el mejor vs el peor,
 * el segundo vs el anteúltimo, etc.
 *
 * @param {Array} pool - Array ordenado de mejor a peor. Puede contener null.
 * @returns {Array} - Array de cruces { ronda, orden, parejaA, parejaB, endogeno }
 */
export function seedingMejorPeor(pool) {
  const real = pool.filter(e => e != null);
  const nulls = pool.filter(e => e == null);
  const sorted = [...real, ...nulls];

  let cruces = [];

  if (sorted.length === 2) {
    cruces = [{ ronda: 'direct', orden: 1, parejaA: sorted[0], parejaB: sorted[1] }];
  } else if (sorted.length === 3) {
    cruces = [{ ronda: 'SF', orden: 1, parejaA: sorted[1], parejaB: sorted[2] }];
  } else if (sorted.length === 4) {
    cruces = [
      { ronda: 'SF', orden: 1, parejaA: sorted[0], parejaB: sorted[3] },
      { ronda: 'SF', orden: 2, parejaA: sorted[1], parejaB: sorted[2] }
    ];
  } else if (sorted.length === 8) {
    cruces = [
      { ronda: 'QF', orden: 1, parejaA: sorted[0], parejaB: sorted[7] },
      { ronda: 'QF', orden: 2, parejaA: sorted[1], parejaB: sorted[6] },
      { ronda: 'QF', orden: 3, parejaA: sorted[2], parejaB: sorted[5] },
      { ronda: 'QF', orden: 4, parejaA: sorted[3], parejaB: sorted[4] }
    ];
  }

  // Calcular endogeno para cada cruce
  return cruces.map(c => ({
    ...c,
    endogeno: !!(c.parejaA && c.parejaB && c.parejaA.grupoId === c.parejaB.grupoId)
  }));
}

// ============================================================
// Función 4: optimizarEndogenos
// ============================================================

/**
 * Recorre cruces secuencialmente y swappea para evitar que dos equipos
 * del mismo grupo se enfrenten.
 *
 * @param {Array} cruces                  - Array de cruces (output de seedingMejorPeor)
 * @param {Set}   equiposProtegidosIds    - Set<string> de pareja_id que NO se deben mover
 * @returns {Array} - Nuevo array de cruces (no muta el input)
 */
export function optimizarEndogenos(cruces, equiposProtegidosIds) {
  // Clonar para no mutar el input
  const result = cruces.map(c => ({ ...c }));
  const protegidos = new Set(equiposProtegidosIds);

  for (let i = 0; i < result.length; i++) {
    const cruce = result[i];

    // Solo procesar si es endógeno
    if (!(cruce.parejaA && cruce.parejaB && cruce.parejaA.grupoId === cruce.parejaB.grupoId)) {
      continue;
    }

    const peorDelCruce = cruce.parejaB;

    // Si el peor del cruce está protegido, no podemos moverlo
    if (peorDelCruce && protegidos.has(peorDelCruce.pareja_id)) {
      result[i] = { ...cruce, endogeno: true };
      continue;
    }

    let swapEncontrado = false;

    // Buscar swap válido de abajo hacia arriba (desde el último hasta i+1)
    outer:
    for (let j = result.length - 1; j > i; j--) {
      const cruceJ = result[j];

      // Preferir parejaB primero, luego parejaA
      for (const slot of ['parejaB', 'parejaA']) {
        const candidato = cruceJ[slot];

        if (candidato == null) continue;
        if (protegidos.has(candidato.pareja_id)) continue;
        if (candidato.grupoId === peorDelCruce.grupoId) continue;

        // Verificar que el swap no crea nuevo endógeno en cruce j
        const otroSlot = slot === 'parejaB' ? 'parejaA' : 'parejaB';
        const otroEquipoCruceJ = cruceJ[otroSlot];
        if (otroEquipoCruceJ && otroEquipoCruceJ.grupoId === peorDelCruce.grupoId) continue;

        // Swap válido: intercambiar peorDelCruce ↔ candidato
        const nuevoPeorEnJ = { ...peorDelCruce };
        const nuevoCandidatoEnI = { ...candidato };

        // Actualizar cruce i: parejaB pasa a ser candidato
        result[i] = {
          ...result[i],
          parejaB: nuevoCandidatoEnI,
          optimizado: true,
          endogeno: !!(result[i].parejaA && nuevoCandidatoEnI &&
            result[i].parejaA.grupoId === nuevoCandidatoEnI.grupoId)
        };

        // Actualizar cruce j: el slot del candidato pasa a ser peorDelCruce
        const cruceJActualizado = { ...result[j] };
        cruceJActualizado[slot] = nuevoPeorEnJ;
        cruceJActualizado.optimizado = true;
        const jA = cruceJActualizado.parejaA;
        const jB = cruceJActualizado.parejaB;
        cruceJActualizado.endogeno = !!(jA && jB && jA.grupoId === jB.grupoId);
        result[j] = cruceJActualizado;

        // Proteger ambos pareja_ids para no re-tocarlos
        if (peorDelCruce.pareja_id) protegidos.add(peorDelCruce.pareja_id);
        if (candidato.pareja_id) protegidos.add(candidato.pareja_id);

        swapEncontrado = true;
        break outer;
      }
    }

    if (!swapEncontrado) {
      // No se pudo resolver: marcar endogeno
      result[i] = { ...result[i], endogeno: true };
    }
  }

  return result;
}

// ============================================================
// Función 5: detectarEmpates
// ============================================================

/**
 * Detecta empates que afectan la composición del pool: frontera
 * (último clasificado vs primer excluido) e inter-grupo (mismo tier,
 * distintos grupos).
 *
 * @param {Array} pool         - Array de clasificados (output de armarPoolParaCopa)
 * @param {Array} allStandings - Todos los standings del torneo
 * @param {Array} reglas       - Reglas del esquema
 * @returns {{ warnings }}
 */
export function detectarEmpates(pool, allStandings, reglas) {
  const warnings = [];

  const gruposCompletosIds = new Set(
    allStandings.filter(s => s.grupo_completo).map(s => s.grupo_id)
  );
  const standingsCompletos = allStandings.filter(s => s.grupo_completo);
  const hasGlobal = reglas.some(r => r.modo === 'global');

  // ── A) Empates frontera ──────────────────────────────────
  if (hasGlobal) {
    const globalRule = reglas.find(r => r.modo === 'global') || {};
    const desde = globalRule.desde || 1;
    const hasta = globalRule.hasta || 4;

    const allSorted = [...standingsCompletos].sort(cmpStandings);
    const lastClassified = allSorted[hasta - 1];
    const firstExcluded = allSorted[hasta];

    if (lastClassified && firstExcluded && esEmpateStats(lastClassified, firstExcluded)) {
      const allTied = allSorted.filter(t => esEmpateStats(t, lastClassified));
      const dg = lastClassified.dg || 0;
      warnings.push({
        tipo: 'empate_frontera',
        equipos: allTied.map(t => ({
          nombre: t.nombre,
          grupoNombre: t.grupoNombre,
          pareja_id: t.pareja_id,
          puntos: t.puntos,
          ds: t.ds,
          dg: t.dg || 0,
          gf: t.gf
        })),
        detalle: `${lastClassified.puntos} pts, DS ${_signo(lastClassified.ds)}${Math.abs(lastClassified.ds)}, DG ${_signo(dg)}${Math.abs(dg)}`
      });
    }
  } else {
    for (const regla of reglas) {
      const criterio = regla.criterio;
      const cantidad = regla.cantidad;
      if (!criterio || !cantidad) continue;

      let candidates = standingsCompletos
        .filter(s => s.posicion_en_grupo === regla.posicion)
        .sort(cmpStandings);

      if (criterio === 'peor') candidates = [...candidates].reverse();

      const lastClassified = candidates[cantidad - 1];
      const firstExcluded = candidates[cantidad];

      if (lastClassified && firstExcluded && esEmpateStats(lastClassified, firstExcluded)) {
        const allTied = candidates.filter(t => esEmpateStats(t, lastClassified));
        const dg = lastClassified.dg || 0;
        warnings.push({
          tipo: 'empate_frontera',
          equipos: allTied.map(t => ({
            nombre: t.nombre,
            grupoNombre: t.grupoNombre,
            pareja_id: t.pareja_id,
            puntos: t.puntos,
            ds: t.ds,
            dg: t.dg || 0,
            gf: t.gf
          })),
          detalle: `${lastClassified.puntos} pts, DS ${_signo(lastClassified.ds)}${Math.abs(lastClassified.ds)}, DG ${_signo(dg)}${Math.abs(dg)}`
        });
      }
    }
  }

  // ── B) Empates inter-grupo ───────────────────────────────
  // Agrupar pool por posicion_en_grupo
  const tierMap = {};
  for (const t of pool) {
    const pos = t.posicion_en_grupo;
    if (pos == null) continue;
    if (!tierMap[pos]) tierMap[pos] = [];
    tierMap[pos].push(t);
  }

  for (const [posStr, tier] of Object.entries(tierMap)) {
    if (tier.length < 2) continue;

    // Buscar grupos de empatados dentro de este tier
    // Recorrer pares para detectar stats idénticas
    const visitados = new Set();
    for (let a = 0; a < tier.length; a++) {
      if (visitados.has(a)) continue;
      const grupo = [tier[a]];
      for (let b = a + 1; b < tier.length; b++) {
        if (visitados.has(b)) continue;
        if (esEmpateStats(tier[a], tier[b])) {
          grupo.push(tier[b]);
          visitados.add(b);
        }
      }
      visitados.add(a);
      if (grupo.length >= 2) {
        const resueltoPorSorteo = grupo.every(t => t.sorteo_orden != null);
        if (!resueltoPorSorteo) {
          warnings.push({
            tipo: 'empate_inter_grupo',
            posicion: Number(posStr),
            equipos: grupo.map(t => ({
              nombre: t.nombre,
              grupoNombre: t.grupoNombre,
              pareja_id: t.pareja_id,
              puntos: t.puntos,
              ds: t.ds,
              dg: t.dg || 0,
              gf: t.gf,
              sorteo_orden: t.sorteo_orden
            })),
            resueltoPorSorteo: false
          });
        }
      }
    }
  }

  // ── C) Empates intra-grupo ───────────────────────────────
  for (const grupoId of gruposCompletosIds) {
    const grupoTeams = allStandings.filter(s => s.grupo_id === grupoId && s.grupo_completo);
    const statsGroups = {};
    for (const t of grupoTeams) {
      const key = `${t.puntos}_${t.ds}_${t.dg || 0}_${t.gf}`;
      if (!statsGroups[key]) statsGroups[key] = [];
      statsGroups[key].push(t);
    }
    for (const tied of Object.values(statsGroups)) {
      if (tied.length >= 3) {
        const grupoNombre = tied[0].grupoNombre || grupoId;
        const positions = tied.map(t => `${t.posicion_en_grupo}°`).join('-');
        warnings.push({
          tipo: 'empate_intra_grupo',
          grupoId,
          grupoNombre,
          posiciones: positions,
          equipos: tied.map(t => ({ nombre: t.nombre, pareja_id: t.pareja_id }))
        });
      }
    }
  }

  return { warnings };
}
