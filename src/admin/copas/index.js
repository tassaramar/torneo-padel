import { supabase, TORNEO_ID, dom, logMsg, el } from '../context.js';
import { shuffle, cmpStatsDesc } from '../utils.js';
import { calcularTablaGrupo, ordenarAutomatico, ordenarConOverrides } from '../groups/compute.js';

export function initCopas() {
  console.log('INIT COPAS');

  const btnRefresh = document.getElementById('refresh-copas');
  const btnReset = document.getElementById('reset-copas');
  const btnAutoAsignar = document.getElementById('auto-asignar-copas');
  const btnGen = document.getElementById('gen-copas');
  const btnFinales = document.getElementById('gen-finales');
  const btnCrucesDirectos = document.getElementById('gen-cruces-directos-2x5');

  if (btnRefresh) btnRefresh.onclick = () => cargarCopasAdmin();
  if (btnReset) btnReset.onclick = () => resetCopasDelTorneo();
  if (btnAutoAsignar) btnAutoAsignar.onclick = () => aplicarAsignacionesAutomaticas();
  if (btnGen) btnGen.onclick = () => generarCopasYSemis();
  if (btnFinales) btnFinales.onclick = () => generarFinalesYTercerPuesto();
  if (btnCrucesDirectos) btnCrucesDirectos.onclick = () => generarCrucesDirectos2x5();

  cargarCopasAdmin();
}

export async function resetCopasDelTorneo() {
  logMsg('🧹 Reset Copas: borrando partidos de copa…');

  const { data: delPartidos, error: errP } = await supabase
    .from('partidos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .not('copa_id', 'is', null)
    .select('id');

  if (errP) {
    console.error(errP);
    logMsg('❌ Error borrando partidos de copa (ver consola)');
    return;
  }

  logMsg(`🧹 Partidos de copa borrados: ${delPartidos?.length ?? 0}`);

  logMsg('🧹 Reset Copas: borrando copas…');

  const { data: delCopas, error: errC } = await supabase
    .from('copas')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .select('id');

  if (errC) {
    console.error(errC);
    logMsg('❌ Error borrando copas (ver consola)');
    return;
  }

  logMsg(`✅ Copas borradas: ${delCopas?.length ?? 0}`);
  
  await cargarCopasAdmin();
}

/* =========================
   DETECCIÓN DE FORMATO
========================= */

async function detectarFormatoTorneo() {
  const { data: grupos } = await supabase
    .from('grupos')
    .select('id')
    .eq('torneo_id', TORNEO_ID);

  const { data: parejas } = await supabase
    .from('parejas')
    .select('id')
    .eq('torneo_id', TORNEO_ID);

  const numGrupos = grupos?.length || 0;
  const numParejas = parejas?.length || 0;
  const parejasPorGrupo = numGrupos > 0 ? numParejas / numGrupos : 0;

  const esFormatoEstandar = numGrupos === 4 && parejasPorGrupo === 3;

  return {
    numGrupos,
    numParejas,
    parejasPorGrupo,
    esFormatoEstandar
  };
}

/* =========================
   ANÁLISIS DE ESTADO DE COPAS
========================= */

async function calcularTablaGrupoDB(grupoId) {
  const { data: partidos, error } = await supabase
    .from('partidos')
    .select(`
      id,
      games_a,
      games_b,
      estado,
      pareja_a_id,
      pareja_b_id,
      pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
    `)
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupoId)
    .is('copa_id', null);

  if (error) {
    console.error(error);
    return { ok: false, msg: 'Error leyendo partidos del grupo' };
  }

  const total = (partidos || []).length;
  const jugados = (partidos || []).filter(p => p.games_a !== null && p.games_b !== null).length;

  if (total > 0 && jugados < total) {
    return { ok: false, msg: `faltan partidos (${jugados}/${total})` };
  }

  const partidosArray = partidos || [];
  const rows = calcularTablaGrupo(partidosArray);
  const ordenadas = ordenarAutomatico(rows, partidosArray);

  if (ordenadas.length < 2) {
    return { ok: false, msg: `grupo incompleto: ${ordenadas.length} pareja(s)` };
  }

  return { ok: true, rows, ordenParejas: ordenadas.map(r => r.pareja_id), partidos: partidosArray };
}

async function analizarEstadoCopa(copaId, copaNombre, copaOrden) {
  // 1. Obtener todos los partidos de esta copa
  const { data: partidosCopa, error: errPartidos } = await supabase
    .from('partidos')
    .select('id, pareja_a_id, pareja_b_id, ronda_copa')
    .eq('torneo_id', TORNEO_ID)
    .eq('copa_id', copaId);

  if (errPartidos) {
    console.error(errPartidos);
    return null;
  }

  // 2. Extraer IDs de parejas que ya están en partidos de esta copa
  const parejasConPartido = new Set();
  (partidosCopa || []).forEach(p => {
    parejasConPartido.add(p.pareja_a_id);
    parejasConPartido.add(p.pareja_b_id);
  });

  const semisExistentes = (partidosCopa || []).filter(p => p.ronda_copa === 'SF').length;

  // 3. Obtener grupos terminados y calcular posiciones
  const { data: grupos, error: errGrupos } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errGrupos) {
    console.error(errGrupos);
    return null;
  }

  const parejasDisponibles = [];

  for (const g of grupos) {
    // Ver si hay orden manual
    const { data: man, error: errM } = await supabase
      .from('posiciones_manual')
      .select('pareja_id, orden_manual')
      .eq('torneo_id', TORNEO_ID)
      .eq('grupo_id', g.id)
      .not('orden_manual', 'is', null)
      .order('orden_manual', { ascending: true });

    if (errM) console.error(errM);

    let orden = [];
    let grupoCompleto = false;

    if (man && man.length >= 2) {
      orden = man.map(x => x.pareja_id);
      grupoCompleto = true;
    } else {
      // Calcular automático
      const calc = await calcularTablaGrupoDB(g.id);
      if (calc.ok && calc.ordenParejas.length >= 2) {
        orden = calc.ordenParejas;
        grupoCompleto = true;
      }
    }

    if (!grupoCompleto) continue;

    // Determinar qué pareja de este grupo corresponde a esta copa
    // Copa Oro (orden 1) = 1° de cada grupo (index 0)
    // Copa Plata (orden 2) = 2° de cada grupo (index 1)
    // Copa Bronce (orden 3) = 3° de cada grupo (index 2)
    const indexEnGrupo = copaOrden - 1;
    
    // Validar que el índice existe para este formato
    if (indexEnGrupo >= orden.length) continue;
    
    const parejaId = orden[indexEnGrupo];

    // Si esta pareja NO tiene partido asignado, está disponible
    if (!parejasConPartido.has(parejaId)) {
      // Obtener nombre de la pareja
      const { data: pareja } = await supabase
        .from('parejas')
        .select('nombre')
        .eq('id', parejaId)
        .single();

      parejasDisponibles.push({
        pareja_id: parejaId,
        nombre: pareja?.nombre || 'Desconocido',
        grupo_nombre: g.nombre,
        posicion: indexEnGrupo === 0 ? '1°' : indexEnGrupo === 1 ? '2°' : '3°'
      });
    }
  }

  return {
    copa_id: copaId,
    copa_nombre: copaNombre,
    copa_orden: copaOrden,
    parejas_con_partido: Array.from(parejasConPartido),
    parejas_disponibles: parejasDisponibles,
    semis_existentes: semisExistentes
  };
}

/* =========================
   CREAR SEMIS INCREMENTALES
========================= */

async function crearSemiConEquipos(copaId, copaNombre, pareja1Id, pareja2Id) {
  // Obtener el próximo orden_copa disponible
  const { data: existingSemis, error: errEx } = await supabase
    .from('partidos')
    .select('orden_copa')
    .eq('torneo_id', TORNEO_ID)
    .eq('copa_id', copaId)
    .eq('ronda_copa', 'SF')
    .order('orden_copa', { ascending: false })
    .limit(1);

  if (errEx) {
    console.error(errEx);
    logMsg('❌ Error verificando orden de semis');
    return false;
  }

  const nextOrden = existingSemis?.length ? existingSemis[0].orden_copa + 1 : 1;

  // Crear partido
  const { error: errInsert } = await supabase.from('partidos').insert({
    torneo_id: TORNEO_ID,
    grupo_id: null,
    copa_id: copaId,
    pareja_a_id: pareja1Id,
    pareja_b_id: pareja2Id,
    ronda_copa: 'SF',
    orden_copa: nextOrden
  });

  if (errInsert) {
    console.error(errInsert);
    logMsg(`❌ Error creando semifinal en ${copaNombre}`);
    return false;
  }

  logMsg(`✅ ${copaNombre}: Semi ${nextOrden} creada`);
  return true;
}

async function crearSemisConCuatroEquipos(copaId, copaNombre, parejas) {
  // Con 4 equipos, usar sistema de bombos
  // Ordenar por stats si están disponibles
  const { data: gruposData } = await supabase
    .from('grupos')
    .select('id')
    .eq('torneo_id', TORNEO_ID);

  const statsMap = {};

  for (const p of parejas) {
    for (const grupo of (gruposData || [])) {
      const calc = await calcularTablaGrupoDB(grupo.id);
      if (calc.ok && calc.rows) {
        calc.rows.forEach(r => {
          if (r.pareja_id === p.pareja_id) {
            statsMap[p.pareja_id] = r;
          }
        });
      }
    }
  }

  // Preparar equipos con stats para seeding
  const players = parejas.map(p => ({
    pareja_id: p.pareja_id,
    nombre: p.nombre,
    P: statsMap[p.pareja_id]?.P ?? 0,
    DG: statsMap[p.pareja_id]?.DG ?? 0,
    GF: statsMap[p.pareja_id]?.GF ?? 0
  }));

  players.sort(cmpStatsDesc);

  const seed1 = players[0];
  const seed2 = players[1];
  const seed3 = players[2];
  const seed4 = players[3];

  const bomboA = [seed1, seed2];
  const bomboB = shuffle([seed3, seed4]);

  // Crear las 2 semis
  const ok1 = await crearSemiConEquipos(copaId, copaNombre, bomboA[0].pareja_id, bomboB[0].pareja_id);
  const ok2 = await crearSemiConEquipos(copaId, copaNombre, bomboA[1].pareja_id, bomboB[1].pareja_id);

  return ok1 && ok2;
}

/* =========================
   MODALES UI
========================= */

async function mostrarModalConfirmar2Equipos(copa, parejas) {
  const modal = el('div', {
    style: 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 24px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 1000; min-width: 400px; max-width: 500px;'
  });

  const overlay = el('div', {
    style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999;'
  });

  modal.appendChild(el('h3', { style: 'margin-top: 0; margin-bottom: 16px;' }, `${copa.copa_nombre}: Confirmar Semifinal`));

  modal.appendChild(el('p', { style: 'margin-bottom: 12px;' }, 'Se encontraron 2 equipos disponibles:'));

  const listaEquipos = el('ul', { style: 'margin: 12px 0; padding-left: 20px;' });
  parejas.forEach(p => {
    const item = el('li', { style: 'margin: 6px 0;' });
    item.textContent = `${p.nombre} (${p.posicion} ${p.grupo_nombre})`;
    listaEquipos.appendChild(item);
  });
  modal.appendChild(listaEquipos);

  modal.appendChild(el('p', { style: 'margin: 16px 0; font-weight: 600;' }, 
    `¿Crear semifinal: ${parejas[0].nombre} vs ${parejas[1].nombre}?`
  ));

  const btnContainer = el('div', { style: 'margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;' });

  const btnCancelar = el('button', { class: 'btn-secondary' }, 'Cancelar');
  btnCancelar.onclick = () => {
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  };

  const btnConfirmar = el('button', { class: 'btn-primary' }, 'Crear Semifinal');
  btnConfirmar.onclick = async () => {
    const ok = await crearSemiConEquipos(
      copa.copa_id,
      copa.copa_nombre,
      parejas[0].pareja_id,
      parejas[1].pareja_id
    );

    if (ok) {
      document.body.removeChild(overlay);
      document.body.removeChild(modal);
      await cargarCopasAdmin();
    }
  };

  btnContainer.appendChild(btnCancelar);
  btnContainer.appendChild(btnConfirmar);
  modal.appendChild(btnContainer);

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

async function mostrarModalElegir3Equipos(copa, parejas) {
  const modal = el('div', {
    style: 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 24px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 1000; min-width: 400px; max-width: 500px;'
  });

  const overlay = el('div', {
    style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999;'
  });

  modal.appendChild(el('h3', { style: 'margin-top: 0; margin-bottom: 16px;' }, `${copa.copa_nombre}: Elegir 2 Equipos`));

  modal.appendChild(el('p', { style: 'margin-bottom: 12px;' }, 'Se encontraron 3 equipos disponibles. Seleccioná 2 para la semifinal:'));

  const checkboxes = [];
  const listaEquipos = el('div', { style: 'margin: 12px 0;' });

  parejas.forEach((p, idx) => {
    const item = el('div', { style: 'margin: 8px 0;' });
    const checkbox = el('input', { type: 'checkbox', id: `eq-${idx}`, style: 'margin-right: 8px;' });
    const label = el('label', { for: `eq-${idx}`, style: 'cursor: pointer;' });
    label.textContent = `${p.nombre} (${p.posicion} ${p.grupo_nombre})`;

    item.appendChild(checkbox);
    item.appendChild(label);
    listaEquipos.appendChild(item);
    checkboxes.push({ checkbox, pareja: p });
  });

  modal.appendChild(listaEquipos);

  const btnContainer = el('div', { style: 'margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;' });

  const btnCancelar = el('button', { class: 'btn-secondary' }, 'Cancelar');
  btnCancelar.onclick = () => {
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  };

  const btnConfirmar = el('button', { class: 'btn-primary' }, 'Crear Semifinal');
  btnConfirmar.disabled = true;

  // Actualizar estado del botón cuando cambian los checkboxes
  checkboxes.forEach(({ checkbox }) => {
    checkbox.onchange = () => {
      const seleccionados = checkboxes.filter(c => c.checkbox.checked).length;
      btnConfirmar.disabled = seleccionados !== 2;
    };
  });

  btnConfirmar.onclick = async () => {
    const seleccionados = checkboxes.filter(c => c.checkbox.checked);

    if (seleccionados.length !== 2) {
      logMsg('⚠️ Debés seleccionar exactamente 2 equipos');
      return;
    }

    const ok = await crearSemiConEquipos(
      copa.copa_id,
      copa.copa_nombre,
      seleccionados[0].pareja.pareja_id,
      seleccionados[1].pareja.pareja_id
    );

    if (ok) {
      document.body.removeChild(overlay);
      document.body.removeChild(modal);
      await cargarCopasAdmin();
    }
  };

  btnContainer.appendChild(btnCancelar);
  btnContainer.appendChild(btnConfirmar);
  modal.appendChild(btnContainer);

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

/* =========================
   FUNCIONES DEPRECATED (ya no se usan con el nuevo sistema)
========================= */

// NOTA: Estas funciones usaban copa_asignada_id que ya no se usa.
// Ahora el sistema detecta asignaciones mirando directamente los partidos creados.

// export async function asignarParejaACopa(parejaId, copaId) { ... }
// export async function quitarParejaDecopa(parejaId) { ... }
// export async function obtenerEquiposAsignados(copaId) { ... }
// export async function obtenerEquiposDisponibles() { ... }

export async function sugerirAsignacionesAutomaticas() {
  logMsg('🤖 Sugerir asignaciones: calculando…');

  // Detectar formato del torneo
  const formato = await detectarFormatoTorneo();
  
  if (!formato.esFormatoEstandar) {
    logMsg(`ℹ️ Formato detectado: ${formato.numGrupos} grupos × ${formato.parejasPorGrupo} parejas`);
    logMsg(`ℹ️ Las copas automáticas solo funcionan con formato 4 grupos × 3 parejas`);
    logMsg(`💡 Usá la fase de grupos normalmente. Las copas se pueden agregar manualmente desde Supabase si es necesario.`);
    return null;
  }

  const { data: grupos, error: errG } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errG || !grupos || grupos.length !== 4) {
    logMsg(`❌ Error o no hay 4 grupos (hay ${grupos?.length || 0})`);
    return null;
  }

  const { data: copas, error: errC } = await supabase
    .from('copas')
    .select('id, nombre, orden')
    .eq('torneo_id', TORNEO_ID)
    .order('orden');

  if (errC || !copas || copas.length !== 3) {
    logMsg(`❌ Error o no hay 3 copas (hay ${copas?.length || 0})`);
    return null;
  }

  const sugerencias = [];

  for (const g of grupos) {
    // Primero ver si hay orden manual
    const { data: man, error: errM } = await supabase
      .from('posiciones_manual')
      .select('pareja_id, orden_manual')
      .eq('torneo_id', TORNEO_ID)
      .eq('grupo_id', g.id)
      .not('orden_manual', 'is', null)
      .order('orden_manual', { ascending: true });

    if (errM) console.error(errM);

    let orden = [];

    if (man && man.length >= 3) {
      orden = man.map(x => x.pareja_id);
    } else {
      // Calcular automático
      const calc = await calcularTablaGrupoDB(g.id);
      if (!calc.ok || calc.ordenParejas.length < 3) {
        logMsg(`⚠️ Grupo ${g.nombre}: ${calc.msg || 'no se pudo calcular orden'}`);
        continue;
      }
      orden = calc.ordenParejas;
    }

    sugerencias.push({
      grupo: g.nombre,
      primero: { pareja_id: orden[0], copa_id: copas[0].id, copa_nombre: copas[0].nombre },
      segundo: { pareja_id: orden[1], copa_id: copas[1].id, copa_nombre: copas[1].nombre },
      tercero: { pareja_id: orden[2], copa_id: copas[2].id, copa_nombre: copas[2].nombre }
    });
  }

  return sugerencias;
}

export async function aplicarAsignacionesAutomaticas() {
  logMsg('🤖 Analizando estado del torneo...');

  // Detectar formato del torneo
  const formato = await detectarFormatoTorneo();
  
  if (!formato.esFormatoEstandar) {
    logMsg(`ℹ️ Formato detectado: ${formato.numGrupos} grupos × ${formato.parejasPorGrupo} parejas`);
    logMsg(`ℹ️ Las copas automáticas solo funcionan con formato 4 grupos × 3 parejas`);
    logMsg(`💡 Para este formato, usá solo la fase de grupos.`);
    logMsg(`💡 Los cruces directos se pueden agregar manualmente como partidos de copa desde Supabase.`);
    return false;
  }

  // 1. Validar que existan las 3 copas
  const { data: copas, error: errC } = await supabase
    .from('copas')
    .select('id, nombre, orden')
    .eq('torneo_id', TORNEO_ID)
    .order('orden');

  if (errC || !copas || copas.length !== 3) {
    logMsg(`❌ Necesitás 3 copas creadas primero (hay ${copas?.length || 0})`);
    return false;
  }

  let totalAcciones = 0;

  // 2. Por cada copa, analizar estado y decidir acción
  for (const copa of copas) {
    const estado = await analizarEstadoCopa(copa.id, copa.nombre, copa.orden);

    if (!estado) {
      logMsg(`❌ Error analizando ${copa.nombre}`);
      continue;
    }

    const numDisponibles = estado.parejas_disponibles.length;

    logMsg(`📊 ${copa.nombre}: ${numDisponibles} equipo(s) disponible(s), ${estado.semis_existentes} semi(s) existente(s)`);

    // 3. Decidir acción según cantidad de parejas disponibles
    if (numDisponibles === 0) {
      if (estado.semis_existentes === 0) {
        logMsg(`⚠️ ${copa.nombre}: No hay equipos disponibles`);
      } else {
        logMsg(`✅ ${copa.nombre}: Todos los equipos ya tienen partido asignado`);
      }
      continue;
    }

    if (numDisponibles === 1) {
      logMsg(`⚠️ ${copa.nombre}: Solo hay 1 equipo disponible, se necesitan al menos 2`);
      continue;
    }

    if (numDisponibles === 2) {
      logMsg(`💬 ${copa.nombre}: Mostrando confirmación para 2 equipos...`);
      await mostrarModalConfirmar2Equipos(estado, estado.parejas_disponibles);
      totalAcciones++;
    } else if (numDisponibles === 3) {
      logMsg(`💬 ${copa.nombre}: Mostrando selector para 3 equipos...`);
      await mostrarModalElegir3Equipos(estado, estado.parejas_disponibles);
      totalAcciones++;
    } else if (numDisponibles >= 4) {
      logMsg(`⚡ ${copa.nombre}: Generando 2 semis con 4 equipos (sistema de bombos)...`);
      const ok = await crearSemisConCuatroEquipos(copa.id, copa.nombre, estado.parejas_disponibles);
      if (ok) {
        totalAcciones++;
      }
    }
  }

  if (totalAcciones === 0) {
    logMsg('ℹ️ No hay acciones pendientes. Todas las copas están completas o no hay suficientes equipos.');
  }

  // Refrescar solo si no hubo modales (los modales refrescan automáticamente al confirmar)
  const huboModales = copas.some(async (c) => {
    const e = await analizarEstadoCopa(c.id, c.nombre, c.orden);
    return e && (e.parejas_disponibles.length === 2 || e.parejas_disponibles.length === 3);
  });

  if (!huboModales) {
    await cargarCopasAdmin();
  }

  return true;
}

function fmtRes(p) {
  if (p.games_a === null || p.games_b === null) return 'Pendiente';
  return `${p.games_a} - ${p.games_b}`;
}

function fmtRonda(p) {
  if (!p.ronda_copa) return '';
  if (p.ronda_copa === 'SF') return 'Semi';
  if (p.ronda_copa === 'F') return 'Final';
  if (p.ronda_copa === '3P') return '3/4';
  return p.ronda_copa;
}

export async function cargarCopasAdmin() {
  if (!dom.contCopas) return;

  dom.contCopas.innerHTML = '';
  dom.contCopas.appendChild(el('p', {}, 'Cargando copas…'));

  const { data: copas, error: errCopas } = await supabase
    .from('copas')
    .select('id, nombre, orden, created_at')
    .eq('torneo_id', TORNEO_ID)
    .order('orden');

  if (errCopas) {
    console.error(errCopas);
    dom.contCopas.innerHTML = '';
    dom.contCopas.appendChild(el('p', {}, '❌ Error cargando copas (ver consola)'));
    logMsg('❌ Error cargando copas');
    return;
  }

  dom.contCopas.innerHTML = '';

  if (!copas || copas.length === 0) {
    dom.contCopas.appendChild(el('p', {}, 'No hay copas todavía.'));
    logMsg('ℹ️ Copas: 0');
    return;
  }

  logMsg(`ℹ️ Copas encontradas: ${copas.length}`);

  for (const copa of copas) {
    const card = el('div', { class: 'admin-grupo' });
    card.appendChild(el('h3', {}, `🏆 ${copa.nombre ?? 'Copa'} (orden ${copa.orden})`));

    // === SECCIÓN: PARTIDOS ===
    const { data: partidos, error: errPartidos } = await supabase
      .from('partidos')
      .select(`
        id,
        games_a,
        games_b,
        ronda_copa,
        orden_copa,
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('torneo_id', TORNEO_ID)
      .eq('copa_id', copa.id)
      .order('orden_copa', { ascending: true });

    if (errPartidos) {
      console.error(errPartidos);
      card.appendChild(el('p', {}, '❌ Error cargando partidos de la copa (ver consola)'));
      dom.contCopas.appendChild(card);
      continue;
    }

    const total = (partidos || []).length;
    const jugados = (partidos || []).filter(p => p.games_a !== null && p.games_b !== null).length;
    const faltan = total - jugados;

    card.appendChild(
      el('p', {}, `Partidos: <strong>${jugados}/${total}</strong> ${faltan > 0 ? `(faltan ${faltan})` : total > 0 ? '✅' : ''}`)
    );

    if (partidos && partidos.length > 0) {
      const table = el('table', { class: 'tabla-posiciones', style: 'width:100%; margin-top:10px;' });
      table.innerHTML = `
        <thead>
          <tr>
            <th style="width:90px;">Ronda</th>
            <th>Partido</th>
            <th style="width:120px;">Resultado</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector('tbody');

      for (const p of partidos) {
        const tr = document.createElement('tr');
        const ronda = fmtRonda(p);
        const a = p.pareja_a?.nombre ?? '¿?';
        const b = p.pareja_b?.nombre ?? '¿?';

        tr.innerHTML = `
          <td style="text-align:center;">${ronda}</td>
          <td>${a} <strong>vs</strong> ${b}</td>
          <td style="text-align:center;"><strong>${fmtRes(p)}</strong></td>
        `;
        tbody.appendChild(tr);
      }

      card.appendChild(table);
    }

    dom.contCopas.appendChild(card);
  }
}

/* =========================
   FUNCIONES OBSOLETAS REMOVIDAS
========================= */

// function mostrarModalAsignar() - Ya no se usa con el nuevo sistema
// async function generarSemisConAsignados() - Reemplazada por lógica incremental

/* =========================
   GENERAR SEMIS CON EQUIPOS ASIGNADOS (LEGACY - MANTENER POR COMPATIBILIDAD)
========================= */

async function generarSemisConAsignados(copaId, copaNombre) {
  logMsg(`⚡ Generar Semis ${copaNombre}: validando…`);

  // Obtener equipos asignados
  const equipos = await obtenerEquiposAsignados(copaId);

  if (equipos.length < 2) {
    logMsg(`❌ Necesitás al menos 2 equipos asignados (hay ${equipos.length})`);
    return;
  }

  // Verificar si ya hay semis creadas
  const { data: existingSemis, error: errEx } = await supabase
    .from('partidos')
    .select('id, ronda_copa')
    .eq('torneo_id', TORNEO_ID)
    .eq('copa_id', copaId)
    .eq('ronda_copa', 'SF');

  if (errEx) {
    console.error(errEx);
    logMsg('❌ Error verificando semis existentes');
    return;
  }

  // Si ya hay semis, no crear más (evita duplicados)
  if (existingSemis && existingSemis.length > 0) {
    const numExistentes = existingSemis.length;
    logMsg(`⚠️ ${copaNombre} ya tiene ${numExistentes} semi(s) creada(s).`);
    logMsg(`💡 Para regenerar con ${equipos.length} equipos: borrá las semis existentes primero (Reset Copas) y volvé a generar.`);
    return;
  }

  // Obtener stats de grupos para seeding (si están disponibles)
  const { data: gruposData, error: errG } = await supabase
    .from('grupos')
    .select('id')
    .eq('torneo_id', TORNEO_ID);

  const statsMap = {};

  for (const eq of equipos) {
    // Intentar calcular stats del equipo si viene de un grupo
    for (const grupo of (gruposData || [])) {
      const calc = await calcularTablaGrupoDB(grupo.id);
      if (calc.ok && calc.rows) {
        calc.rows.forEach(r => {
          if (r.pareja_id === eq.id) {
            statsMap[eq.id] = r;
          }
        });
      }
    }
  }

  // Preparar equipos con stats para seeding
  const players = equipos.map(eq => ({
    pareja_id: eq.id,
    nombre: eq.nombre,
    P: statsMap[eq.id]?.P ?? 0,
    DG: statsMap[eq.id]?.DG ?? 0,
    GF: statsMap[eq.id]?.GF ?? 0
  }));

  players.sort(cmpStatsDesc);

  const inserts = [];

  if (equipos.length === 2) {
    // Con 2 equipos: enfrentamiento directo
    logMsg(`📋 ${copaNombre}: generando 1 semi con 2 equipos`);
    
    inserts.push({
      torneo_id: TORNEO_ID,
      grupo_id: null,
      copa_id: copaId,
      pareja_a_id: players[0].pareja_id,
      pareja_b_id: players[1].pareja_id,
      ronda_copa: 'SF',
      orden_copa: 1
    });

  } else if (equipos.length === 3) {
    // Con 3 equipos: una semi ahora, la otra se generará cuando llegue el 4to
    logMsg(`📋 ${copaNombre}: generando 1 semi con 3 equipos (seed 2 vs seed 3)`);
    
    inserts.push({
      torneo_id: TORNEO_ID,
      grupo_id: null,
      copa_id: copaId,
      pareja_a_id: players[1].pareja_id, // seed 2
      pareja_b_id: players[2].pareja_id, // seed 3
      ronda_copa: 'SF',
      orden_copa: 1
    });

  } else if (equipos.length >= 4) {
    // Con 4+ equipos: usar sistema de bombos tradicional
    logMsg(`📋 ${copaNombre}: generando 2 semis con 4 equipos (sistema de bombos)`);
    
    const seed1 = players[0];
    const seed2 = players[1];
    const seed3 = players[2];
    const seed4 = players[3];

    const bomboA = [seed1, seed2];
    const bomboB = shuffle([seed3, seed4]);

    inserts.push(
      {
        torneo_id: TORNEO_ID,
        grupo_id: null,
        copa_id: copaId,
        pareja_a_id: bomboA[0].pareja_id,
        pareja_b_id: bomboB[0].pareja_id,
        ronda_copa: 'SF',
        orden_copa: 1
      },
      {
        torneo_id: TORNEO_ID,
        grupo_id: null,
        copa_id: copaId,
        pareja_a_id: bomboA[1].pareja_id,
        pareja_b_id: bomboB[1].pareja_id,
        ronda_copa: 'SF',
        orden_copa: 2
      }
    );
  }

  const { error: errPI } = await supabase.from('partidos').insert(inserts);

  if (errPI) {
    console.error(errPI);
    logMsg('❌ Error creando semis (ver consola)');
    return;
  }

  logMsg(`✅ ${copaNombre}: ${inserts.length} semi(s) creada(s)`);
  await cargarCopasAdmin();
}

/* =========================
   GENERAR COPAS + SEMIS (AUTOMÁTICO COMPLETO)
========================= */

export async function generarCopasYSemis() {
  logMsg('🏆 Generar Copas + Semis: validando…');

  // Detectar formato del torneo
  const formato = await detectarFormatoTorneo();
  
  if (!formato.esFormatoEstandar) {
    logMsg(`ℹ️ Formato detectado: ${formato.numGrupos} grupos × ${formato.parejasPorGrupo} parejas`);
    logMsg(`ℹ️ La generación automática de copas solo funciona con formato 4 grupos × 3 parejas`);
    logMsg(`💡 Para este formato, usá solo la fase de grupos.`);
    return;
  }

  const { data: existing, error: errEx } = await supabase
    .from('copas')
    .select('id')
    .eq('torneo_id', TORNEO_ID);

  if (errEx) {
    console.error(errEx);
    logMsg('❌ Error leyendo copas existentes');
    return;
  }

  if (existing && existing.length > 0) {
    logMsg(`❌ Ya hay ${existing.length} copas. Primero hacé "Reset Copas".`);
    return;
  }

  const { data: grupos, error: errG } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errG || !grupos) {
    console.error(errG);
    logMsg('❌ Error cargando grupos');
    return;
  }

  if (grupos.length !== 4) {
    logMsg(`❌ Esperaba 4 grupos. Encontré ${grupos.length}.`);
    return;
  }

  const porGrupo = [];
  const statsMap = {};

  for (const g of grupos) {
    const { data: man, error: errM } = await supabase
      .from('posiciones_manual')
      .select('pareja_id, orden_manual')
      .eq('torneo_id', TORNEO_ID)
      .eq('grupo_id', g.id)
      .not('orden_manual', 'is', null)
      .order('orden_manual', { ascending: true });

    if (errM) console.error(errM);

    if (man && man.length === 3) {
      const calc = await calcularTablaGrupoDB(g.id);
      if (!calc.ok) {
        logMsg(`❌ Grupo ${g.nombre}: no pude calcular stats para seeds (${calc.msg})`);
        return;
      }
      calc.rows.forEach(r => (statsMap[r.pareja_id] = r));

      porGrupo.push({ grupo_id: g.id, grupo_nombre: g.nombre, orden: man.map(x => x.pareja_id) });
      continue;
    }

    const calc = await calcularTablaGrupoDB(g.id);
    if (!calc.ok) {
      logMsg(`❌ Grupo ${g.nombre}: ${calc.msg} y no hay orden manual completo`);
      return;
    }

    calc.rows.forEach(r => (statsMap[r.pareja_id] = r));
    porGrupo.push({ grupo_id: g.id, grupo_nombre: g.nombre, orden: calc.ordenParejas });
  }

  logMsg('✅ Validación OK: 4 grupos con orden final');

  const copasDef = [
    { nombre: 'Copa Oro', orden: 1 },
    { nombre: 'Copa Plata', orden: 2 },
    { nombre: 'Copa Bronce', orden: 3 }
  ];

  const { data: copasIns, error: errCI } = await supabase
    .from('copas')
    .insert(copasDef.map(c => ({ torneo_id: TORNEO_ID, nombre: c.nombre, orden: c.orden })))
    .select('id, nombre, orden');

  if (errCI) {
    console.error(errCI);
    logMsg('❌ Error creando copas (ver consola)');
    return;
  }

  logMsg(`✅ Copas creadas: ${copasIns.length}`);

  const copaByOrden = {};
  copasIns.forEach(c => (copaByOrden[c.orden] = c));

  const oroIds = porGrupo.map(x => x.orden[0]);
  const plataIds = porGrupo.map(x => x.orden[1]);
  const bronceIds = porGrupo.map(x => x.orden[2]);

  const plan = [
    { copa: copaByOrden[1], ids: oroIds },
    { copa: copaByOrden[2], ids: plataIds },
    { copa: copaByOrden[3], ids: bronceIds }
  ];

  const inserts = [];

  for (const item of plan) {
    const copa = item.copa;

    const players = item.ids.map(pid => {
      const s = statsMap[pid];
      return {
        pareja_id: pid,
        nombre: s?.nombre ?? pid,
        P: s?.P ?? 0,
        DG: s?.DG ?? 0,
        GF: s?.GF ?? 0
      };
    });

    players.sort(cmpStatsDesc);

    const seed1 = players[0];
    const seed2 = players[1];
    const seed3 = players[2];
    const seed4 = players[3];

    const bomboA = [seed1, seed2];
    const bomboB = shuffle([seed3, seed4]);

    inserts.push(
      {
        torneo_id: TORNEO_ID,
        grupo_id: null,
        copa_id: copa.id,
        pareja_a_id: bomboA[0].pareja_id,
        pareja_b_id: bomboB[0].pareja_id,
        ronda_copa: 'SF',
        orden_copa: 1
      },
      {
        torneo_id: TORNEO_ID,
        grupo_id: null,
        copa_id: copa.id,
        pareja_a_id: bomboA[1].pareja_id,
        pareja_b_id: bomboB[1].pareja_id,
        ronda_copa: 'SF',
        orden_copa: 2
      }
    );
  }

  const { error: errPI } = await supabase.from('partidos').insert(inserts);

  if (errPI) {
    console.error(errPI);
    logMsg('❌ Error creando partidos de semis (ver consola)');
    return;
  }

  logMsg(`✅ Semis creadas: ${inserts.length} partidos`);
  await cargarCopasAdmin();
}

/* =========================
   GENERAR FINAL + 3/4 (NUEVO)
========================= */

function winnerLoserFromMatch(p) {
  // requiere games cargados y sin empate
  const ga = p.games_a;
  const gb = p.games_b;
  if (ga === null || gb === null) return null;
  if (ga === gb) return null;

  if (ga > gb) {
    return { winnerId: p.pareja_a_id, loserId: p.pareja_b_id };
  }
  return { winnerId: p.pareja_b_id, loserId: p.pareja_a_id };
}

export async function generarFinalesYTercerPuesto() {
  logMsg('🏁 Generar Final + 3/4: buscando copas…');

  const { data: copas, error: errCopas } = await supabase
    .from('copas')
    .select('id, nombre, orden')
    .eq('torneo_id', TORNEO_ID)
    .order('orden');

  if (errCopas) {
    console.error(errCopas);
    logMsg('❌ Error cargando copas (ver consola)');
    return;
  }

  if (!copas || copas.length === 0) {
    logMsg('ℹ️ No hay copas para procesar.');
    return;
  }

  let totalCreados = 0;

  for (const copa of copas) {
    // Traer TODOS los partidos de la copa (para ver SF + F + 3P)
    const { data: partidos, error: errP } = await supabase
      .from('partidos')
      .select('id, copa_id, ronda_copa, orden_copa, pareja_a_id, pareja_b_id, games_a, games_b')
      .eq('torneo_id', TORNEO_ID)
      .eq('copa_id', copa.id);

    if (errP) {
      console.error(errP);
      logMsg(`❌ ${copa.nombre}: error leyendo partidos`);
      continue;
    }

    const sf = (partidos || []).filter(p => p.ronda_copa === 'SF').sort((a, b) => (a.orden_copa ?? 99) - (b.orden_copa ?? 99));
    const fExist = (partidos || []).some(p => p.ronda_copa === 'F');
    const p3Exist = (partidos || []).some(p => p.ronda_copa === '3P');

    if (sf.length < 2) {
      logMsg(`ℹ️ ${copa.nombre}: todavía no hay 2 semis (hay ${sf.length})`);
      continue;
    }

    const r1 = winnerLoserFromMatch(sf[0]);
    const r2 = winnerLoserFromMatch(sf[1]);

    if (!r1 || !r2) {
      logMsg(`ℹ️ ${copa.nombre}: faltan resultados en semis (o hay empate raro)`);
      continue;
    }

    const inserts = [];

    if (!fExist) {
      inserts.push({
        torneo_id: TORNEO_ID,
        grupo_id: null,
        copa_id: copa.id,
        pareja_a_id: r1.winnerId,
        pareja_b_id: r2.winnerId,
        ronda_copa: 'F',
        orden_copa: 3
      });
    }

    if (!p3Exist) {
      inserts.push({
        torneo_id: TORNEO_ID,
        grupo_id: null,
        copa_id: copa.id,
        pareja_a_id: r1.loserId,
        pareja_b_id: r2.loserId,
        ronda_copa: '3P',
        orden_copa: 4
      });
    }

    if (inserts.length === 0) {
      logMsg(`✅ ${copa.nombre}: Final y 3/4 ya existen`);
      continue;
    }

    const { error: errIns } = await supabase.from('partidos').insert(inserts);

    if (errIns) {
      console.error(errIns);
      logMsg(`❌ ${copa.nombre}: error creando Final/3P (ver consola)`);
      continue;
    }

    totalCreados += inserts.length;
    logMsg(`✅ ${copa.nombre}: creados ${inserts.length} partidos (Final/3P)`);
  }

  logMsg(`🏁 Listo. Generados: ${totalCreados} partidos.`);
  await cargarCopasAdmin();
}

/* =========================
   CRUCES DIRECTOS 2x5 (TORNEO ESPECÍFICO)
========================= */

async function obtenerPosicionesFinales(grupoId, grupoNombre) {
  // 1. Calcular tabla del grupo
  const calc = await calcularTablaGrupoDB(grupoId);
  
  if (!calc.ok || calc.rows.length < 5) {
    logMsg(`❌ ${grupoNombre}: ${calc.msg || 'no se pudo calcular tabla'}`);
    return null;
  }
  
  // 2. Obtener overrides manuales (si existen)
  const { data: manual, error: errManual } = await supabase
    .from('posiciones_manual')
    .select('pareja_id, orden_manual')
    .eq('torneo_id', TORNEO_ID)
    .eq('grupo_id', grupoId)
    .not('orden_manual', 'is', null);
    
  if (errManual) {
    console.error(errManual);
    logMsg(`⚠️ ${grupoNombre}: error leyendo overrides (usando automático)`);
  }
  
  // 3. Crear mapa de overrides
  const overridesMap = {};
  if (manual && manual.length > 0) {
    manual.forEach(ov => {
      overridesMap[ov.pareja_id] = ov.orden_manual;
    });
  }
  
  // 4. Usar la función ordenarConOverrides (misma lógica que el admin)
  // Usar los partidos que ya tenemos de calcularTablaGrupoDB
  const tablaOrdenada = ordenarConOverrides(calc.rows, overridesMap, calc.partidos || []);
  
  if (manual && manual.length > 0) {
    logMsg(`✅ ${grupoNombre}: usando orden con ${manual.length} override(s)`);
  } else {
    logMsg(`✅ ${grupoNombre}: usando orden automático`);
  }
  
  return tablaOrdenada.map(r => ({
    pareja_id: r.pareja_id,
    nombre: r.nombre
  }));
}

export async function generarCrucesDirectos2x5() {
  logMsg('🎯 Generar Cruces Directos (2x5): validando…');
  
  // 1. Validar 2 grupos (soporta 2x5 y también 5+6 si hay parejas.grupo_id)
  const { data: grupos } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');
    
  if (!grupos || grupos.length !== 2) {
    logMsg(`❌ Error: se esperaban 2 grupos, hay ${grupos?.length || 0}`);
    return;
  }
  
  // 2. Asegurarse de que existan exactamente 5 copas.
  //    Si no hay ninguna, las creamos automáticamente con los nombres pedidos.
  let { data: copas, error: errCopas } = await supabase
    .from('copas')
    .select('id, nombre, orden')
    .eq('torneo_id', TORNEO_ID)
    .order('orden');

  if (errCopas) {
    console.error(errCopas);
    logMsg('❌ Error leyendo copas (ver consola)');
    return;
  }

  if (!copas || copas.length === 0) {
    logMsg('ℹ️ No hay copas creadas. Generando copas por defecto (Oro, Plata, Bronce, Carton, Papel)…');

    const definiciones = [
      { nombre: 'Oro', orden: 1 },
      { nombre: 'Plata', orden: 2 },
      { nombre: 'Bronce', orden: 3 },
      { nombre: 'Carton', orden: 4 },
      { nombre: 'Papel', orden: 5 }
    ];

    const { data: nuevasCopas, error: errInsert } = await supabase
      .from('copas')
      .insert(definiciones.map(c => ({
        torneo_id: TORNEO_ID,
        nombre: c.nombre,
        orden: c.orden
      })))
      .select('id, nombre, orden')
      .order('orden');

    if (errInsert) {
      console.error(errInsert);
      logMsg('❌ Error creando copas por defecto (ver consola)');
      return;
    }

    copas = nuevasCopas || [];
    logMsg(`✅ Copas creadas: ${copas.length}`);
  }

  if (!copas || copas.length !== 5) {
    logMsg(`❌ Necesitás exactamente 5 copas creadas (hay ${copas?.length || 0})`);
    logMsg('💡 Formato esperado: Oro, Plata, Bronce, Carton, Papel');
    return;
  }
  
  // 3. Obtener los 2 grupos (A/B por orden alfabético)
  const grupoA = grupos[0];
  const grupoB = grupos[1];
  
  // 4. Obtener posiciones finales de cada grupo
  const posicionesA = await obtenerPosicionesFinales(grupoA.id, grupoA.nombre);
  const posicionesB = await obtenerPosicionesFinales(grupoB.id, grupoB.nombre);
  
  if (!posicionesA || !posicionesB) {
    logMsg(`❌ Error obteniendo posiciones finales`);
    return;
  }
  
  // Soporta 2x5 y 5+6: solo necesitamos top 5 de cada grupo para cruces 1..5
  if (posicionesA.length < 5 || posicionesB.length < 5) {
    logMsg(`❌ Cada grupo debe tener al menos 5 parejas con posiciones definidas`);
    logMsg(`   Grupo ${grupoA.nombre}: ${posicionesA.length} parejas`);
    logMsg(`   Grupo ${grupoB.nombre}: ${posicionesB.length} parejas`);
    return;
  }
  
  if (posicionesA.length > 5 || posicionesB.length > 5) {
    const gGrande = posicionesA.length > posicionesB.length ? grupoA.nombre : grupoB.nombre;
    const nGrande = Math.max(posicionesA.length, posicionesB.length);
    logMsg(`ℹ️ Detectado grupo desparejo: ${gGrande} tiene ${nGrande}. El/los puesto(s) extra quedan fuera de copas.`);
  }
  
  // 5. Generar los 5 partidos
  const inserts = [];
  
  for (let i = 0; i < 5; i++) {
    const copa = copas[i];
    const parejaA = posicionesA[i]; // 1°, 2°, 3°, 4°, 5°
    const parejaB = posicionesB[i];
    
    inserts.push({
      torneo_id: TORNEO_ID,
      grupo_id: null,
      copa_id: copa.id,
      pareja_a_id: parejaA.pareja_id,
      pareja_b_id: parejaB.pareja_id,
      ronda_copa: null,
      orden_copa: i + 1
    });
    
    logMsg(`📋 ${copa.nombre}: ${parejaA.nombre} vs ${parejaB.nombre}`);
  }
  
  // 6. Insertar partidos
  const { error } = await supabase.from('partidos').insert(inserts);
  
  if (error) {
    console.error(error);
    logMsg('❌ Error creando partidos (ver consola)');
    return;
  }
  
  logMsg(`✅ Cruces directos creados: ${inserts.length} partidos`);
  await cargarCopasAdmin();
}
