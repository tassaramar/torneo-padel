/**
 * Vista personalizada para parejas identificadas
 * Muestra partidos filtrados por pareja con estados de confirmación
 */

import { getMensajeResultado } from '../utils/mensajesResultado.js';
import { obtenerFrasesUnicas } from '../utils/frasesFechaLibre.js';

// Almacenar referencias a las funciones que se pasarán desde viewer.js
let handlerCargarResultado = null;
let handlerConfirmarResultado = null;
let handlerAceptarOtroResultado = null;

export function setHandlers(handlers) {
  handlerCargarResultado = handlers.cargarResultado;
  handlerConfirmarResultado = handlers.confirmarResultado;
  handlerAceptarOtroResultado = handlers.aceptarOtroResultado;
}

export async function cargarVistaPersonalizada(supabase, torneoId, identidad, onChangePareja, onVerTodos) {
  try {
    // Fetch grupos del torneo
    const { data: grupos } = await supabase
      .from('grupos')
      .select('id, nombre')
      .eq('torneo_id', torneoId)
      .order('nombre');

    // Fetch todas las parejas del torneo
    const { data: todasParejas } = await supabase
      .from('parejas')
      .select('id, nombre, orden')
      .eq('torneo_id', torneoId)
      .order('orden');

    // Agregar grupo a cada pareja (mismo método que en viewer.js)
    const parejasConGrupo = agregarGrupoAParejas(todasParejas || [], grupos || []);
    
    // Filtrar parejas del mismo grupo
    const miGrupo = identidad.grupo;
    const parejasDelGrupo = parejasConGrupo.filter(p => p.grupo === miGrupo);

    // Fetch partidos de la pareja identificada con datos completos
    const { data: misPartidos, error } = await supabase
      .from('partidos')
      .select(`
        id, games_a, games_b, estado, updated_at, ronda,
        cargado_por_pareja_id,
        resultado_temp_a, resultado_temp_b,
        notas_revision,
        grupo_id,
        grupos ( id, nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre ),
        copa_id,
        ronda_copa
      `)
      .eq('torneo_id', torneoId)
      .or(`pareja_a_id.eq.${identidad.parejaId},pareja_b_id.eq.${identidad.parejaId}`)
      .order('updated_at', { ascending: false });
    
    // Fetch TODOS los partidos del grupo para calcular fechas libres
    const { data: todosPartidosGrupo } = await supabase
      .from('partidos')
      .select(`
        id, games_a, games_b, ronda,
        grupo_id,
        grupos ( nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( nombre )
      `)
      .eq('torneo_id', torneoId)
      .is('copa_id', null)
      .eq('grupo_id', grupos?.find(g => g.nombre === miGrupo)?.id);

    if (error) throw error;

    // Categorizar partidos por estado y prioridad
    const partidos = categorizarPartidos(misPartidos || [], identidad);

    // Calcular estadísticas
    const estadisticas = calcularEstadisticas(misPartidos || [], identidad, supabase, torneoId);

    // Calcular tabla de posiciones del grupo
    const tablaGrupo = await calcularTablaGrupo(supabase, torneoId, identidad, parejasDelGrupo);

    // Renderizar vista
    renderVistaPersonal(identidad, partidos, await estadisticas, tablaGrupo, todosPartidosGrupo || [], onChangePareja, onVerTodos);

    return { ok: true, partidos };
  } catch (error) {
    console.error('Error cargando vista personalizada:', error);
    return { ok: false, error };
  }
}

/**
 * Agrega el grupo inferido a cada pareja (copiado de viewer.js)
 */
function agregarGrupoAParejas(parejas, grupos) {
  if (!grupos.length || !parejas.length) {
    return parejas.map(p => ({ ...p, grupo: '?' }));
  }
  
  const n = grupos.length;
  const per = parejas.length / n;
  
  if (!Number.isInteger(per)) {
    return parejas.map(p => ({ ...p, grupo: '?' }));
  }
  
  const orderedGroups = [...grupos].map(g => g.nombre).sort();
  
  return parejas.map((p, idx) => {
    const grupoIdx = Math.floor(idx / per);
    const grupo = orderedGroups[grupoIdx] || '?';
    return { ...p, grupo };
  });
}

/**
 * Calcula estadísticas del dashboard
 */
async function calcularEstadisticas(partidos, identidad, supabase, torneoId) {
  // Partidos jugados (confirmados o a_confirmar, NO en_revision)
  const partidosContabilizados = partidos.filter(p => 
    (p.estado === 'confirmado' || p.estado === 'a_confirmar') && 
    p.games_a !== null && p.games_b !== null
  );

  const partidosJugados = partidosContabilizados.length;

  // Partidos por jugar (pendientes)
  const partidosPorJugar = partidos.filter(p => 
    p.estado === 'pendiente' || p.games_a === null || p.games_b === null
  ).length;

  // Calcular posición en la tabla
  let posicion = null;
  if (partidosJugados > 0) {
    posicion = await calcularPosicionEnTabla(supabase, torneoId, identidad);
  }

  return {
    partidosJugados,
    partidosPorJugar,
    posicion
  };
}

/**
 * Calcula la posición actual en la tabla de posiciones
 */
async function calcularPosicionEnTabla(supabase, torneoId, identidad) {
  try {
    // Obtener grupo ID
    const { data: grupos } = await supabase
      .from('grupos')
      .select('id, nombre')
      .eq('torneo_id', torneoId)
      .eq('nombre', identidad.grupo)
      .single();

    if (!grupos) return null;

    const grupoId = grupos.id;

    // Obtener todos los partidos del grupo
    const { data: todosPartidos } = await supabase
      .from('partidos')
      .select(`
        id, games_a, games_b, estado,
        pareja_a_id, pareja_b_id
      `)
      .eq('torneo_id', torneoId)
      .eq('grupo_id', grupoId);

    if (!todosPartidos) return null;

    // Filtrar solo partidos contabilizados (confirmados o a_confirmar, NO en_revision)
    const partidosValidos = todosPartidos.filter(p => 
      (p.estado === 'confirmado' || p.estado === 'a_confirmar') &&
      p.games_a !== null && p.games_b !== null
    );

    // Calcular puntos por pareja
    const puntosPorPareja = {};

    partidosValidos.forEach(p => {
      const idA = p.pareja_a_id;
      const idB = p.pareja_b_id;

      if (!puntosPorPareja[idA]) puntosPorPareja[idA] = { puntos: 0, ganados: 0, jugados: 0, gamesAFavor: 0, gamesEnContra: 0 };
      if (!puntosPorPareja[idB]) puntosPorPareja[idB] = { puntos: 0, ganados: 0, jugados: 0, gamesAFavor: 0, gamesEnContra: 0 };

      puntosPorPareja[idA].jugados++;
      puntosPorPareja[idB].jugados++;
      puntosPorPareja[idA].gamesAFavor += p.games_a;
      puntosPorPareja[idA].gamesEnContra += p.games_b;
      puntosPorPareja[idB].gamesAFavor += p.games_b;
      puntosPorPareja[idB].gamesEnContra += p.games_a;

      if (p.games_a > p.games_b) {
        puntosPorPareja[idA].puntos += 2; // Victoria: 2 puntos
        puntosPorPareja[idA].ganados++;
        puntosPorPareja[idB].puntos += 1; // Derrota: 1 punto
      } else if (p.games_b > p.games_a) {
        puntosPorPareja[idB].puntos += 2; // Victoria: 2 puntos
        puntosPorPareja[idB].ganados++;
        puntosPorPareja[idA].puntos += 1; // Derrota: 1 punto
      } else {
        // Empate (aunque no debería pasar)
        puntosPorPareja[idA].puntos += 1;
        puntosPorPareja[idB].puntos += 1;
      }
    });

    // Obtener overrides manuales (orden final guardado por admin)
    const { data: overrides } = await supabase
      .from('posiciones_manual')
      .select('pareja_id, orden_manual')
      .eq('torneo_id', torneoId)
      .eq('grupo_id', grupoId);

    const overridesMap = {};
    if (overrides && overrides.length > 0) {
      overrides.forEach(ov => {
        overridesMap[ov.pareja_id] = ov.orden_manual;
      });
    }

    // Crear ranking: primero por overrides, luego automático
    const conOverride = [];
    const sinOverride = [];

    Object.entries(puntosPorPareja).forEach(([id, stats]) => {
      if (overridesMap[id] !== undefined) {
        conOverride.push({ id, stats, override: overridesMap[id] });
      } else {
        sinOverride.push({ id, stats });
      }
    });

    // Ordenar con override por orden_manual
    conOverride.sort((a, b) => a.override - b.override);

    // Ordenar sin override por criterio automático
    sinOverride.sort((a, b) => {
      if (b.stats.puntos !== a.stats.puntos) return b.stats.puntos - a.stats.puntos;
      const difA = a.stats.gamesAFavor - a.stats.gamesEnContra;
      const difB = b.stats.gamesAFavor - b.stats.gamesEnContra;
      if (difB !== difA) return difB - difA;
      return b.stats.gamesAFavor - a.stats.gamesAFavor;
    });

    // Ranking final
    const ranking = [...conOverride, ...sinOverride];

    // Encontrar posición de mi pareja
    const miPosicion = ranking.findIndex(entry => entry.id === identidad.parejaId);

    return miPosicion >= 0 ? miPosicion + 1 : null;

  } catch (error) {
    console.error('Error calculando posición:', error);
    return null;
  }
}

/**
 * Categoriza partidos según su estado y necesidad de acción
 */
function categorizarPartidos(partidos, identidad) {
  const categorias = {
    enRevision: [],
    porConfirmar: [],
    porCargar: [],
    confirmados: []
  };

  partidos.forEach(p => {
    const estado = p.estado || 'pendiente';
    
    if (estado === 'en_revision') {
      // Conflicto: requiere atención inmediata
      categorias.enRevision.push(p);
    } else if (estado === 'a_confirmar' && p.cargado_por_pareja_id !== identidad.parejaId) {
      // La otra pareja cargó, yo debo confirmar
      categorias.porConfirmar.push(p);
    } else if (estado === 'a_confirmar' && p.cargado_por_pareja_id === identidad.parejaId) {
      // Yo ya cargué resultado, va a partidos jugados (esperando que la otra pareja confirme)
      categorias.confirmados.push(p);
    } else if (estado === 'confirmado') {
      // Ambas parejas confirmaron
      categorias.confirmados.push(p);
    } else {
      // Pendiente: sin resultado cargado
      categorias.porCargar.push(p);
    }
  });

  return categorias;
}

/**
 * Detecta empates reales y asigna colores diferentes a cada grupo
 */
function detectarEmpatesReales(rows) {
  const buckets = new Map();
  for (const r of rows) {
    const key = `${r.puntos}|${(r.gamesAFavor - r.gamesEnContra)}|${r.gamesAFavor}`;
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
  let colorIndex = 0;

  for (const arr of buckets.values()) {
    // Solo marcar empate si tienen partidos jugados
    const tienenPartidos = arr.some(r => r.jugados > 0);
    if (arr.length >= 2 && tienenPartidos) {
      const color = colors[colorIndex % colors.length];
      
      const group = {
        parejaIds: arr.map(x => x.parejaId),
        color: color,
        size: arr.length
      };
      
      tieGroups.push(group);
      colorIndex++;
    }
  }

  return { tieGroups };
}

/**
 * Calcula la tabla de posiciones del grupo
 */
async function calcularTablaGrupo(supabase, torneoId, identidad, parejasDelGrupo) {
  try {
    // Obtener grupo ID
    const { data: grupos } = await supabase
      .from('grupos')
      .select('id, nombre')
      .eq('torneo_id', torneoId)
      .eq('nombre', identidad.grupo)
      .single();

    if (!grupos) return [];

    const grupoId = grupos.id;

    // Obtener todos los partidos del grupo
    const { data: partidosGrupo } = await supabase
      .from('partidos')
      .select(`
        id, games_a, games_b, estado,
        pareja_a_id, pareja_b_id,
        grupos ( nombre )
      `)
      .eq('torneo_id', torneoId)
      .eq('grupo_id', grupoId);

    if (!partidosGrupo) return [];

    // Filtrar solo partidos contabilizados
    const partidosValidos = partidosGrupo.filter(p => 
      (p.estado === 'confirmado' || p.estado === 'a_confirmar') &&
      p.games_a !== null && p.games_b !== null
    );

    // Calcular estadísticas por pareja
    const stats = {};
    
    parejasDelGrupo.forEach(p => {
      stats[p.id] = {
        parejaId: p.id,
        nombre: p.nombre,
        puntos: 0,
        jugados: 0,
        ganados: 0,
        perdidos: 0,
        gamesAFavor: 0,
        gamesEnContra: 0,
        esMiPareja: p.id === identidad.parejaId
      };
    });

    partidosValidos.forEach(p => {
      const idA = p.pareja_a_id;
      const idB = p.pareja_b_id;

      if (!stats[idA] || !stats[idB]) return;

      stats[idA].jugados++;
      stats[idB].jugados++;
      stats[idA].gamesAFavor += p.games_a;
      stats[idA].gamesEnContra += p.games_b;
      stats[idB].gamesAFavor += p.games_b;
      stats[idB].gamesEnContra += p.games_a;

      if (p.games_a > p.games_b) {
        stats[idA].puntos += 2; // Victoria: 2 puntos
        stats[idA].ganados++;
        stats[idB].puntos += 1; // Derrota: 1 punto
        stats[idB].perdidos++;
      } else if (p.games_b > p.games_a) {
        stats[idB].puntos += 2; // Victoria: 2 puntos
        stats[idB].ganados++;
        stats[idA].puntos += 1; // Derrota: 1 punto
        stats[idA].perdidos++;
      } else {
        // Empate (aunque no debería pasar)
        stats[idA].puntos += 1;
        stats[idB].puntos += 1;
      }
    });

    // Obtener overrides manuales (orden final guardado por admin)
    const { data: overrides } = await supabase
      .from('posiciones_manual')
      .select('pareja_id, orden_manual')
      .eq('torneo_id', torneoId)
      .eq('grupo_id', grupoId);

    const overridesMap = {};
    if (overrides && overrides.length > 0) {
      overrides.forEach(ov => {
        overridesMap[ov.pareja_id] = ov.orden_manual;
      });
    }

    // Calcular posición automática (sin overrides) para cada pareja
    const tablaAuto = Object.values(stats).sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      const difA = a.gamesAFavor - a.gamesEnContra;
      const difB = b.gamesAFavor - b.gamesEnContra;
      if (difB !== difA) return difB - difA;
      return b.gamesAFavor - a.gamesAFavor;
    });

    // Mapear posición automática (índice + 1)
    const autoPosMap = {};
    tablaAuto.forEach((s, idx) => {
      autoPosMap[s.parejaId] = idx + 1;
    });

    // Detectar empates reales con colores
    const { tieGroups } = detectarEmpatesReales(Object.values(stats));

    // Crear mapa de color por pareja
    const tieColorMap = {};
    if (tieGroups) {
      tieGroups.forEach(group => {
        group.parejaIds.forEach(parejaId => {
          tieColorMap[parejaId] = group.color;
        });
      });
    }

    // Ordenar: primero por overrides, luego por criterio automático
    let tabla = Object.values(stats);

    // Separar: con override vs sin override
    const conOverride = tabla.filter(s => overridesMap[s.parejaId] !== undefined);
    const sinOverride = tabla.filter(s => overridesMap[s.parejaId] === undefined);

    // Ordenar los que tienen override por su orden_manual
    conOverride.sort((a, b) => overridesMap[a.parejaId] - overridesMap[b.parejaId]);

    // Ordenar los que NO tienen override por criterio automático
    sinOverride.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      const difA = a.gamesAFavor - a.gamesEnContra;
      const difB = b.gamesAFavor - b.gamesEnContra;
      if (difB !== difA) return difB - difA;
      return b.gamesAFavor - a.gamesAFavor;
    });

    // Tabla final: overrides primero, luego automáticos
    tabla = [...conOverride, ...sinOverride];

    // Agregar posición automática y delta a cada elemento
    tabla.forEach((s, idx) => {
      s.posicionActual = idx + 1;
      s.posicionAuto = autoPosMap[s.parejaId];
      s.delta = s.posicionAuto - s.posicionActual;
      s.tieneOverride = overridesMap[s.parejaId] !== undefined;
      s.colorEmpate = tieColorMap[s.parejaId] || null;
    });

    return tabla;

  } catch (error) {
    console.error('Error calculando tabla del grupo:', error);
    return [];
  }
}

/**
 * Renderiza la vista personalizada completa
 */
function renderVistaPersonal(identidad, partidos, estadisticas, tablaGrupo, todosPartidosGrupo, onChangePareja, onVerTodos) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/55950f91-7837-4b4e-a7ee-c1c8657c32bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'vistaPersonal.js:505',message:'renderVistaPersonal iniciado',data:{windowAppExiste:typeof window.app !== 'undefined',cargarExiste:typeof window.app?.cargarResultado === 'function'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'TIMING'})}).catch(()=>{});
  // #endregion
  
  const contentEl = document.getElementById('viewer-content');
  if (!contentEl) return;

  const totalPendientes = partidos.enRevision.length + partidos.porConfirmar.length;
  
  // Guardar todosPartidosGrupo en un lugar accesible para renderPartidosCargar
  renderVistaPersonal._todosPartidosGrupo = todosPartidosGrupo;
  
  contentEl.innerHTML = `
    <div class="vista-personal">
      <!-- Header personalizado - GRANDE para +40 -->
      <div class="personal-header">
        <div class="personal-info">
          <h1 class="personal-title">${escapeHtml(identidad.parejaNombre)}</h1>
          <div class="personal-meta">Grupo ${escapeHtml(identidad.grupo)}</div>
        </div>
        <div class="personal-actions">
          <button class="btn-secondary btn-sm" id="btn-change-pareja" type="button">
            <span style="font-size: 12px;">🔄</span> Cambiar
          </button>
        </div>
      </div>

      <!-- Dashboard de estadísticas -->
      <div class="dashboard">
        ${estadisticas.posicion ? `
          <div class="stat-card stat-position">
            <div class="stat-value">${estadisticas.posicion}°</div>
            <div class="stat-label">Posición en tabla</div>
          </div>
        ` : ''}
        <div class="stat-card">
          <div class="stat-value">${estadisticas.partidosPorJugar}</div>
          <div class="stat-label">Por jugar</div>
        </div>
        <div class="stat-card stat-highlight">
          <div class="stat-value">${estadisticas.partidosJugados}</div>
          <div class="stat-label">Partidos jugados</div>
        </div>
      </div>

      <!-- Alerta de pendientes (si hay) -->
      ${totalPendientes > 0 ? `
        <div class="alert alert-warning">
          <strong>⚠️ ${totalPendientes} resultado${totalPendientes > 1 ? 's' : ''} requiere${totalPendientes > 1 ? 'n' : ''} tu atención</strong>
        </div>
      ` : ''}

      <!-- Partidos en revisión (máxima prioridad) -->
      ${partidos.enRevision.length > 0 ? `
        <div class="personal-section priority-high">
          <h2 class="section-title">🔴 Partidos en revisión (${partidos.enRevision.length})</h2>
          <div class="section-description">Hay diferencias en los resultados. Revisá y resolvé.</div>
          <div id="partidos-revision"></div>
        </div>
      ` : ''}

      <!-- Partidos por confirmar -->
      ${partidos.porConfirmar.length > 0 ? `
        <div class="personal-section priority-medium">
          <h2 class="section-title">🟡 Por confirmar (${partidos.porConfirmar.length})</h2>
          <div class="section-description">La otra pareja ya cargó el resultado. Confirmalo o cargá el tuyo.</div>
          <div id="partidos-confirmar"></div>
        </div>
      ` : ''}

      <!-- Partidos por jugar -->
      ${partidos.porCargar.length > 0 ? `
        <div class="personal-section priority-normal">
          <h2 class="section-title">🟢 Por jugar (${partidos.porCargar.length})</h2>
          <div class="section-description">Cargá el resultado cuando termines de jugar.</div>
          <div id="partidos-cargar"></div>
        </div>
      ` : ''}

      <!-- Partidos jugados -->
      <div class="personal-section">
        <details class="personal-details">
          <summary>Ver partidos jugados (${partidos.confirmados.length})</summary>
          <div id="partidos-confirmados"></div>
        </details>
      </div>

      <!-- Tabla de posiciones del grupo -->
      ${tablaGrupo.length > 0 ? `
        <div class="personal-section">
          <details class="personal-details" open>
            <summary>Tabla de posiciones - Grupo ${escapeHtml(identidad.grupo)}</summary>
            <div class="tabla-posiciones">
              <table class="tabla-grupo">
                <thead>
                  <tr>
                    <th class="pos-col">#</th>
                    <th class="nombre-col">Pareja</th>
                    <th class="stat-col">PJ</th>
                    <th class="stat-col">G</th>
                    <th class="stat-col">P</th>
                    <th class="stat-col">GF</th>
                    <th class="stat-col">GC</th>
                    <th class="stat-col">Dif</th>
                    <th class="pts-col">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  ${tablaGrupo.map((pareja, idx) => {
                    const diferencia = pareja.gamesAFavor - pareja.gamesEnContra;
                    const diferenciaStr = diferencia > 0 ? `+${diferencia}` : diferencia;
                    const clases = [
                      pareja.esMiPareja ? 'mi-pareja' : '',
                      pareja.empatado ? 'empatado' : ''
                    ].filter(Boolean).join(' ');
                    
                    // Indicador de cambio de posición (si hay override)
                    let indicadorPosicion = '';
                    if (pareja.delta !== 0 && pareja.tieneOverride) {
                      const txt = pareja.delta > 0 ? `+${pareja.delta}` : `${pareja.delta}`;
                      const color = pareja.delta > 0 ? '#1a7f37' : '#d1242f'; // Verde si bajó, rojo si subió
                      indicadorPosicion = ` <sup style="font-size:11px; color:${color}; font-weight:700; margin-left:4px;">${txt}</sup>`;
                    }

                    // Estilo de empate (si aplica)
                    let styleEmpate = '';
                    if (pareja.colorEmpate) {
                      styleEmpate = `background: ${pareja.colorEmpate.bg}; border-left: 4px solid ${pareja.colorEmpate.border};`;
                    }
                    
                    return `
                      <tr class="${clases}" style="${styleEmpate}">
                        <td class="pos-col">${idx + 1}</td>
                        <td class="nombre-col">${escapeHtml(pareja.nombre)}${indicadorPosicion}</td>
                        <td class="stat-col">${pareja.jugados}</td>
                        <td class="stat-col">${pareja.ganados}</td>
                        <td class="stat-col">${pareja.perdidos}</td>
                        <td class="stat-col">${pareja.gamesAFavor}</td>
                        <td class="stat-col">${pareja.gamesEnContra}</td>
                        <td class="stat-col">${diferenciaStr}</td>
                        <td class="pts-col"><strong>${pareja.puntos}</strong></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ` : ''}
    </div>
  `;

  // Wire events
  document.getElementById('btn-change-pareja')?.addEventListener('click', onChangePareja);
  
  // Agregar botón "Ver todos los grupos" al header
  agregarBotonVerTodos(onVerTodos);

  // Renderizar cada categoría
  renderPartidosRevision(partidos.enRevision, identidad);
  renderPartidosConfirmar(partidos.porConfirmar, identidad);
  // Pasar todos los partidos para detectar rondas correctamente
  const todosPartidos = [...partidos.enRevision, ...partidos.porConfirmar, ...partidos.porCargar, ...partidos.confirmados];
  renderPartidosCargar(partidos.porCargar, renderVistaPersonal._todosPartidosGrupo, todosPartidos, identidad);
  renderPartidosConfirmados(partidos.confirmados, identidad);
  
  // Agregar event delegation para todos los botones de acción
  agregarEventListenersPartidos();
}

/**
 * Renderiza partidos en revisión (con conflicto)
 */
function renderPartidosRevision(partidos, identidad) {
  const container = document.getElementById('partidos-revision');
  if (!container || !partidos.length) return;

  container.innerHTML = partidos.map(p => {
    const esParejaCargadora = p.cargado_por_pareja_id === identidad.parejaId;
    const oponente = getOponenteName(p, identidad);
    const soyA = p.pareja_a?.id === identidad.parejaId;
    
    // Resultado 1 (original)
    const resultado1 = getMensajeResultado(p.games_a, p.games_b, soyA);
    const mensaje1 = resultado1.ganador === 'yo' ? 'Vos ganaste' : 'Vos perdiste';
    
    // Resultado 2 (temporal)
    const resultado2 = getMensajeResultado(p.resultado_temp_a, p.resultado_temp_b, soyA);
    const mensaje2 = resultado2.ganador === 'yo' ? 'Vos ganaste' : 'Vos perdiste';
    
    return `
      <div class="partido partido-revision" data-partido-id="${p.id}">
        <div class="partido-header">
          <div class="partido-vs">vs ${escapeHtml(oponente)}</div>
          <div class="partido-badge badge-revision">En revisión</div>
        </div>
        
        <div class="conflicto-box">
          <div class="conflicto-item ${esParejaCargadora ? 'es-mio' : ''}">
            <div class="conflicto-label">${esParejaCargadora ? 'Tu resultado' : 'Resultado de ' + oponente}</div>
            <div class="conflicto-score">${p.games_a} - ${p.games_b}</div>
            <div class="conflicto-mensaje ${resultado1.ganador === 'yo' ? 'ganaste' : 'perdiste'}">${mensaje1}</div>
          </div>
          
          <div class="conflicto-vs">vs</div>
          
          <div class="conflicto-item ${!esParejaCargadora ? 'es-mio' : ''}">
            <div class="conflicto-label">${!esParejaCargadora ? 'Tu resultado' : 'Resultado de ' + oponente}</div>
            <div class="conflicto-score">${p.resultado_temp_a} - ${p.resultado_temp_b}</div>
            <div class="conflicto-mensaje ${resultado2.ganador === 'yo' ? 'ganaste' : 'perdiste'}">${mensaje2}</div>
          </div>
        </div>
        
        <div class="partido-actions">
          <button class="btn-primary" data-action="aceptar-resultado" data-partido-id="${p.id}">
            ✅ Aceptar resultado de ${escapeHtml(oponente)}
          </button>
          <button class="btn-secondary" data-action="recargar-resultado" data-partido-id="${p.id}">
            🔄 Volver a cargar mi resultado
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renderiza partidos por confirmar (la otra pareja ya cargó)
 */
function renderPartidosConfirmar(partidos, identidad) {
  const container = document.getElementById('partidos-confirmar');
  if (!container || !partidos.length) return;

  container.innerHTML = partidos.map(p => {
    const oponente = getOponenteName(p, identidad);
    const soyA = p.pareja_a?.id === identidad.parejaId;
    const resultado = getMensajeResultado(p.games_a, p.games_b, soyA);
    const mensajeResultado = resultado.ganador === 'yo' ? '🎉 Ganaste' : '😔 Perdiste';
    const claseResultado = resultado.ganador === 'yo' ? 'ganaste' : 'perdiste';
    
    return `
      <div class="partido partido-confirmar" data-partido-id="${p.id}">
        <div class="partido-header">
          <div class="partido-vs">vs ${escapeHtml(oponente)}</div>
          <div class="partido-badge badge-confirmar">Por confirmar</div>
        </div>
        
        <div class="resultado-cargado ${claseResultado}">
          <div class="resultado-label">${escapeHtml(oponente)} cargó:</div>
          <div class="resultado-score">${p.games_a} - ${p.games_b}</div>
          <div class="resultado-mensaje">${mensajeResultado}</div>
        </div>
        
        <div class="partido-actions">
          <button class="btn-primary" data-action="confirmar-resultado" data-partido-id="${p.id}" data-games-a="${p.games_a}" data-games-b="${p.games_b}">
            ✅ Confirmar este resultado
          </button>
          <button class="btn-secondary" data-action="cargar-diferente" data-partido-id="${p.id}">
            ✏️ Cargar resultado diferente
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Agrupa partidos por ronda usando la ronda de la BD
 * Detecta fechas libres comparando rondas con partidos vs total de rondas
 */
function agruparPartidosEnRondas(misPartidosPendientes, todosPartidosGrupo, todosPartidosUsuario, identidad) {
  // Detectar fechas libres usando los partidos REALES (no recalcular con Circle Method)
  // porque el orden puede no coincidir
  let fechasLibresPorRonda = {};
  let totalRondas = 0;
  
  if (todosPartidosGrupo && todosPartidosGrupo.length > 0 && todosPartidosUsuario && todosPartidosUsuario.length > 0) {
    // Determinar el total de rondas basado en los partidos reales
    totalRondas = Math.max(...todosPartidosGrupo.map(p => p.ronda || 0));
    
    // Detectar fechas libres mirando qué rondas NO tienen partidos para esta pareja
    const rondasConPartidos = new Set();
    todosPartidosUsuario.forEach(p => {
      if (p.ronda) {
        rondasConPartidos.add(p.ronda);
      }
    });
    
    // Las rondas sin partidos son fechas libres
    for (let ronda = 1; ronda <= totalRondas; ronda++) {
      if (!rondasConPartidos.has(ronda)) {
        fechasLibresPorRonda[ronda] = true;
      }
    }
    
    console.log('Rondas con partidos para', identidad.parejaNombre, ':', Array.from(rondasConPartidos).sort());
    console.log('Fechas libres detectadas:', fechasLibresPorRonda);

  }
  
  // Determinar la última ronda con partidos pendientes
  const ultimaRondaPendiente = misPartidosPendientes && misPartidosPendientes.length > 0
    ? Math.max(...misPartidosPendientes.map(p => p.ronda || 0))
    : 0;
  
  // Agrupar MIS partidos pendientes por ronda (de la BD)
  const rondasMap = {};
  
  if (misPartidosPendientes) {
    misPartidosPendientes.forEach(p => {
      const ronda = p.ronda || 999; // Si no tiene ronda, ponerlo al final
      
      if (!rondasMap[ronda]) {
        rondasMap[ronda] = {
          numeroRonda: ronda,
          partidos: [],
          tengoFechaLibre: fechasLibresPorRonda[ronda] || false
        };
      }
      
      rondasMap[ronda].partidos.push(p);
    });
  }
  
  // Agregar TODAS las rondas con fecha libre que estén entre la primera y última ronda pendiente
  if (ultimaRondaPendiente > 0) {
    for (let ronda = 1; ronda <= ultimaRondaPendiente; ronda++) {
      if (fechasLibresPorRonda[ronda] && !rondasMap[ronda]) {
        rondasMap[ronda] = {
          numeroRonda: ronda,
          partidos: [],
          tengoFechaLibre: true
        };
      }
    }
  }
  
  // Convertir a array y ordenar por número de ronda
  const rondas = Object.values(rondasMap).sort((a, b) => a.numeroRonda - b.numeroRonda);
  
  // Debug: mostrar rondas detectadas
  console.log('Rondas agrupadas:', rondas.map(r => ({
    ronda: r.numeroRonda,
    partidos: r.partidos.length,
    fechaLibre: r.tengoFechaLibre
  })));
  
  return rondas;
}

/**
 * Renderiza partidos por jugar agrupados en rondas
 */
function renderPartidosCargar(partidosPendientes, todosPartidosGrupo, todosPartidosUsuario, identidad) {
  const container = document.getElementById('partidos-cargar');
  if (!container) return;

  // Agrupar en rondas usando todos los partidos del usuario para detectar correctamente
  const rondas = agruparPartidosEnRondas(partidosPendientes, todosPartidosGrupo, todosPartidosUsuario, identidad);
  
  // Generar frases únicas para fechas libres
  const totalFechasLibres = rondas.filter(r => r.tengoFechaLibre).length;
  const frases = obtenerFrasesUnicas(totalFechasLibres);
  let fraseIndex = 0;
  
  let html = '';
  
  rondas.forEach((ronda) => {
    // Separador de ronda (siempre mostrar)
    html += `
      <div class="ronda-separator">
        <div class="ronda-titulo">Ronda ${ronda.numeroRonda}</div>
      </div>
    `;
    
    // Partidos de la ronda
    ronda.partidos.forEach(p => {
      const oponente = getOponenteName(p, identidad);
      const esperandoConfirmacion = p.estado === 'a_confirmar' && p.cargado_por_pareja_id === identidad.parejaId;
      
      html += `
        <div class="partido partido-cargar" data-partido-id="${p.id}">
          <div class="partido-header">
            <div class="partido-vs">vs ${escapeHtml(oponente)}</div>
            ${esperandoConfirmacion ? 
              '<div class="partido-badge badge-esperando">Esperando confirmación</div>' : 
              '<div class="partido-badge badge-pendiente">Pendiente</div>'
            }
          </div>
          
          ${esperandoConfirmacion ? `
            <div class="resultado-cargado">
              <div class="resultado-label">Tu resultado cargado:</div>
              <div class="resultado-score">${p.games_a} - ${p.games_b}</div>
            </div>
          ` : ''}
          
          <div class="partido-actions">
            <button class="btn-primary" data-action="cargar-resultado" data-partido-id="${p.id}">
              ${esperandoConfirmacion ? '✏️ Editar resultado' : '📝 Cargar resultado'}
            </button>
          </div>
        </div>
      `;
    });
    
    // Fecha libre (si corresponde)
    if (ronda.tengoFechaLibre) {
      html += `
        <div class="fecha-libre">
          <div class="fecha-libre-icon">☕</div>
          <div class="fecha-libre-text">
            <strong>Tenés fecha libre en esta ronda</strong>
            <div class="fecha-libre-frase">${frases[fraseIndex++]}</div>
          </div>
        </div>
      `;
    }
  });
  
  container.innerHTML = html;
}

/**
 * Renderiza partidos jugados (histórico)
 */
function renderPartidosConfirmados(partidos, identidad) {
  const container = document.getElementById('partidos-confirmados');
  if (!container) return;

  if (!partidos.length) {
    container.innerHTML = '<div class="empty-state">Todavía no hay partidos jugados</div>';
    return;
  }

  container.innerHTML = partidos.map(p => {
    const oponente = getOponenteName(p, identidad);
    const ganador = getGanador(p, identidad);
    const esperandoConfirmacion = p.estado === 'a_confirmar' && p.cargado_por_pareja_id === identidad.parejaId;
    
    return `
      <div class="partido partido-confirmado ${ganador ? 'ganador-' + ganador : ''}">
        <div class="partido-simple">
          <div class="partido-vs">vs ${escapeHtml(oponente)}</div>
          <div class="resultado-info">
            <div class="resultado-score ${ganador === 'yo' ? 'ganador' : ganador === 'rival' ? 'perdedor' : ''}">
              ${p.games_a} - ${p.games_b}
            </div>
            ${esperandoConfirmacion ? '<span class="badge-mini badge-waiting">⏳</span>' : ''}
          </div>
        </div>
        ${esperandoConfirmacion ? `
          <div class="partido-actions" style="margin-top: 8px;">
            <button class="btn-secondary btn-sm" data-action="cargar-resultado" data-partido-id="${p.id}">
              ✏️ Editar resultado
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Obtiene el nombre del oponente
 */
function getOponenteName(partido, identidad) {
  if (partido.pareja_a?.id === identidad.parejaId) {
    return partido.pareja_b?.nombre || '—';
  }
  return partido.pareja_a?.nombre || '—';
}

/**
 * Determina quién ganó el partido
 */
function getGanador(partido, identidad) {
  if (partido.games_a === null || partido.games_b === null) return null;
  if (partido.games_a === partido.games_b) return null;
  
  const ganaA = partido.games_a > partido.games_b;
  const soyA = partido.pareja_a?.id === identidad.parejaId;
  
  if ((ganaA && soyA) || (!ganaA && !soyA)) return 'yo';
  return 'rival';
}

/**
 * Escapa HTML
 */
function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Agrega el botón "Ver todos los grupos" al header
 */
function agregarBotonVerTodos(onVerTodos) {
  // Buscar el contenedor de navegación
  const navContainer = document.getElementById('viewer-nav-buttons');
  if (!navContainer) return;
  
  // Limpiar contenedor
  navContainer.innerHTML = '';
  
  // Crear el botón GRANDE para +40
  const btnVerTodos = document.createElement('button');
  btnVerTodos.id = 'btn-ver-todos-header';
  btnVerTodos.className = 'btn-action-secondary';
  btnVerTodos.type = 'button';
  btnVerTodos.innerHTML = `
    <span class="btn-icon">👀</span>
    <span class="btn-text">Ver Todos los Grupos</span>
  `;
  btnVerTodos.addEventListener('click', onVerTodos);
  
  navContainer.appendChild(btnVerTodos);
}

/**
 * Agrega event listeners usando event delegation para todos los botones de acción
 */
function agregarEventListenersPartidos() {
  const contentEl = document.getElementById('viewer-content');
  if (!contentEl) return;
  
  // Usar event delegation: un solo listener en el contenedor padre
  contentEl.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    const partidoId = button.dataset.partidoId;
    
    // Prevenir múltiples clicks
    if (button.disabled) return;
    
    try {
      // Verificar que los handlers estén disponibles
      if (!handlerCargarResultado || !handlerConfirmarResultado || !handlerAceptarOtroResultado) {
        console.error('Los handlers no están inicializados');
        alert('Error: El sistema no está completamente cargado. Por favor, recargá la página.');
        return;
      }
      
      switch (action) {
        case 'cargar-resultado':
          await handlerCargarResultado(partidoId);
          break;
        case 'confirmar-resultado':
          const gamesA = parseInt(button.dataset.gamesA);
          const gamesB = parseInt(button.dataset.gamesB);
          await handlerConfirmarResultado(partidoId, gamesA, gamesB);
          break;
        case 'cargar-diferente':
          await handlerCargarResultado(partidoId);
          break;
        case 'aceptar-resultado':
          await handlerAceptarOtroResultado(partidoId);
          break;
        case 'recargar-resultado':
          await handlerCargarResultado(partidoId);
          break;
        default:
          console.warn('Acción desconocida:', action);
      }
    } catch (error) {
      console.error('Error ejecutando acción:', error);
      alert('Error: ' + error.message);
    }
  });
}
