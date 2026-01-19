import { supabase, TORNEO_ID, dom, logMsg, el } from '../context.js';
import { shuffle, cmpStatsDesc } from '../utils.js';
import { calcularTablaGrupo, ordenarAutomatico } from '../groups/compute.js';

export function initCopas() {
  console.log('INIT COPAS');

  const btnRefresh = document.getElementById('refresh-copas');
  const btnReset = document.getElementById('reset-copas');
  const btnAutoAsignar = document.getElementById('auto-asignar-copas');
  const btnGen = document.getElementById('gen-copas');
  const btnFinales = document.getElementById('gen-finales');

  if (btnRefresh) btnRefresh.onclick = () => cargarCopasAdmin();
  if (btnReset) btnReset.onclick = () => resetCopasDelTorneo();
  if (btnAutoAsignar) btnAutoAsignar.onclick = () => aplicarAsignacionesAutomaticas();
  if (btnGen) btnGen.onclick = () => generarCopasYSemis();
  if (btnFinales) btnFinales.onclick = () => generarFinalesYTercerPuesto();

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
  
  // También limpiamos las asignaciones
  const { error: errClean } = await supabase
    .from('parejas')
    .update({ copa_asignada_id: null })
    .eq('torneo_id', TORNEO_ID)
    .not('copa_asignada_id', 'is', null);
  
  if (errClean) {
    console.error(errClean);
    logMsg('⚠️ Error limpiando asignaciones (ver consola)');
  }
  
  await cargarCopasAdmin();
}

/* =========================
   ASIGNACIÓN DE EQUIPOS A COPAS
========================= */

export async function asignarParejaACopa(parejaId, copaId) {
  const { error } = await supabase
    .from('parejas')
    .update({ copa_asignada_id: copaId })
    .eq('id', parejaId)
    .eq('torneo_id', TORNEO_ID);

  if (error) {
    console.error(error);
    logMsg('❌ Error asignando pareja a copa');
    return false;
  }

  logMsg('✅ Pareja asignada');
  return true;
}

export async function quitarParejaDecopa(parejaId) {
  const { error } = await supabase
    .from('parejas')
    .update({ copa_asignada_id: null })
    .eq('id', parejaId)
    .eq('torneo_id', TORNEO_ID);

  if (error) {
    console.error(error);
    logMsg('❌ Error quitando pareja de copa');
    return false;
  }

  logMsg('✅ Pareja quitada de copa');
  return true;
}

export async function obtenerEquiposAsignados(copaId) {
  const { data, error } = await supabase
    .from('parejas')
    .select('id, nombre, copa_asignada_id')
    .eq('torneo_id', TORNEO_ID)
    .eq('copa_asignada_id', copaId)
    .order('nombre');

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

export async function obtenerEquiposDisponibles() {
  const { data, error } = await supabase
    .from('parejas')
    .select('id, nombre, copa_asignada_id')
    .eq('torneo_id', TORNEO_ID)
    .is('copa_asignada_id', null)
    .order('nombre');

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

export async function sugerirAsignacionesAutomaticas() {
  logMsg('🤖 Sugerir asignaciones: calculando…');

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

    if (man && man.length === 3) {
      orden = man.map(x => x.pareja_id);
    } else {
      // Calcular automático
      const calc = await calcularTablaGrupoDB(g.id);
      if (!calc.ok || calc.ordenParejas.length !== 3) {
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
  const sugerencias = await sugerirAsignacionesAutomaticas();
  
  if (!sugerencias) {
    logMsg('❌ No se pudieron generar sugerencias');
    return false;
  }

  let count = 0;

  for (const sug of sugerencias) {
    for (const pos of [sug.primero, sug.segundo, sug.tercero]) {
      const ok = await asignarParejaACopa(pos.pareja_id, pos.copa_id);
      if (ok) count++;
    }
  }

  logMsg(`✅ Asignaciones aplicadas: ${count}`);
  await cargarCopasAdmin();
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

  // Obtener todas las parejas con sus asignaciones
  const { data: todasParejas, error: errParejas } = await supabase
    .from('parejas')
    .select('id, nombre, copa_asignada_id')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errParejas) {
    console.error(errParejas);
    logMsg('❌ Error cargando parejas');
  }

  const parejasPorCopa = {};
  const parejasDisponibles = [];

  for (const p of (todasParejas || [])) {
    if (p.copa_asignada_id) {
      if (!parejasPorCopa[p.copa_asignada_id]) parejasPorCopa[p.copa_asignada_id] = [];
      parejasPorCopa[p.copa_asignada_id].push(p);
    } else {
      parejasDisponibles.push(p);
    }
  }

  for (const copa of copas) {
    const card = el('div', { class: 'admin-grupo' });
    card.appendChild(el('h3', {}, `🏆 ${copa.nombre ?? 'Copa'} (orden ${copa.orden})`));

    // === SECCIÓN: EQUIPOS ASIGNADOS ===
    const equipos = parejasPorCopa[copa.id] || [];
    
    const seccionEquipos = el('div', { style: 'margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;' });
    seccionEquipos.appendChild(el('h4', { style: 'margin: 0 0 10px 0;' }, `Equipos asignados: ${equipos.length}/4`));

    if (equipos.length > 0) {
      const listaEquipos = el('ul', { style: 'margin: 5px 0; padding-left: 20px;' });
      
      for (const eq of equipos) {
        const item = el('li', { style: 'margin: 5px 0;' });
        item.textContent = eq.nombre + ' ';
        
        const btnQuitar = el('button', { 
          style: 'margin-left: 10px; padding: 2px 8px; font-size: 0.85em;',
          class: 'btn-secondary'
        }, '✕ Quitar');
        
        btnQuitar.onclick = async () => {
          const ok = await quitarParejaDecopa(eq.id);
          if (ok) await cargarCopasAdmin();
        };
        
        item.appendChild(btnQuitar);
        listaEquipos.appendChild(item);
      }
      
      seccionEquipos.appendChild(listaEquipos);
    } else {
      seccionEquipos.appendChild(el('p', { style: 'margin: 5px 0; color: #666;' }, 'Ningún equipo asignado todavía.'));
    }

    // Botón para asignar equipo manualmente
    const btnAsignar = el('button', { class: 'btn-primary', style: 'margin-top: 10px;' }, '+ Asignar Equipo');
    btnAsignar.onclick = () => mostrarModalAsignar(copa, parejasDisponibles);
    seccionEquipos.appendChild(btnAsignar);

    // Botón para generar semis (habilitado si hay 2+ equipos)
    if (equipos.length >= 2) {
      const btnGenSemis = el('button', { class: 'btn-primary', style: 'margin-left: 10px;' }, '⚡ Generar Semis');
      btnGenSemis.onclick = () => generarSemisConAsignados(copa.id, copa.nombre);
      seccionEquipos.appendChild(btnGenSemis);
    }

    card.appendChild(seccionEquipos);

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

function mostrarModalAsignar(copa, parejasDisponibles) {
  if (parejasDisponibles.length === 0) {
    logMsg('⚠️ No hay equipos disponibles para asignar');
    return;
  }

  const modal = el('div', {
    style: 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 1000; min-width: 300px;'
  });

  const overlay = el('div', {
    style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999;'
  });

  modal.appendChild(el('h3', { style: 'margin-top: 0;' }, `Asignar equipo a ${copa.nombre}`));

  const select = el('select', { 
    style: 'width: 100%; padding: 8px; margin: 10px 0; font-size: 1em;'
  });

  const optDefault = el('option', { value: '' });
  optDefault.textContent = '-- Seleccionar equipo --';
  select.appendChild(optDefault);

  for (const p of parejasDisponibles) {
    const opt = el('option', { value: p.id });
    opt.textContent = p.nombre;
    select.appendChild(opt);
  }

  modal.appendChild(select);

  const btnContainer = el('div', { style: 'margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;' });

  const btnCancelar = el('button', { class: 'btn-secondary' }, 'Cancelar');
  btnCancelar.onclick = () => {
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  };

  const btnConfirmar = el('button', { class: 'btn-primary' }, 'Asignar');
  btnConfirmar.onclick = async () => {
    const parejaId = select.value;
    if (!parejaId) {
      logMsg('⚠️ Seleccioná un equipo');
      return;
    }

    const ok = await asignarParejaACopa(parejaId, copa.id);
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
   GENERAR SEMIS CON EQUIPOS ASIGNADOS
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
    const numEsperadas = equipos.length === 2 ? 1 : (equipos.length === 3 ? 1 : 2);
    
    if (numExistentes >= numEsperadas) {
      logMsg(`❌ ${copaNombre} ya tiene ${numExistentes} semi(s). Borrá los partidos primero si querés regenerar.`);
      return;
    }
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

async function calcularTablaGrupoDB(grupoId) {
  const { data: partidos, error } = await supabase
    .from('partidos')
    .select(`
      id,
      games_a,
      games_b,
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

  const rows = calcularTablaGrupo(partidos || []);
  const ordenadas = ordenarAutomatico(rows);

  if (ordenadas.length !== 3) {
    return { ok: false, msg: `no pude determinar 3 parejas (rows=${ordenadas.length}, totalPartidos=${total})` };
  }

  return { ok: true, rows, ordenParejas: ordenadas.map(r => r.pareja_id) };
}

export async function generarCopasYSemis() {
  logMsg('🏆 Generar Copas + Semis: validando…');

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
