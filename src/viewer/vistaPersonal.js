/**
 * Vista personalizada para parejas identificadas
 * Muestra partidos filtrados por pareja con estados de confirmación
 */

import { getMensajeResultado } from '../utils/mensajesResultado.js';
import { obtenerFrasesUnicas } from '../utils/frasesFechaLibre.js';
import { formatearResultado, tieneResultado } from '../utils/formatoResultado.js';
import {
  calcularTablaGrupo as calcularTablaGrupoCentral,
  ordenarConOverrides,
  detectarEmpatesReales as detectarEmpatesRealesCentral,
  cargarOverrides,
  agregarMetadataOverrides,
  ordenarTabla
} from '../utils/tablaPosiciones.js';

export async function cargarVistaPersonalizada(supabase, torneoId, identidad, onChangePareja, onVerTodos) {
  try {
    // Validar que la identidad tenga grupo
    if (!identidad.grupo) {
      console.warn('Identidad sin grupo, usando grupo por defecto');
      identidad.grupo = '?';
    }

    // Fetch grupos del torneo
    const { data: grupos, error: gruposError } = await supabase
      .from('grupos')
      .select('id, nombre')
      .eq('torneo_id', torneoId)
      .order('nombre');

    if (gruposError) {
      console.error('Error cargando grupos:', gruposError);
      throw gruposError;
    }

    // Fetch todas las parejas del torneo
    const { data: todasParejas, error: parejasError } = await supabase
      .from('parejas')
      .select('id, nombre, orden')
      .eq('torneo_id', torneoId)
      .order('orden');

    if (parejasError) {
      console.error('Error cargando parejas:', parejasError);
      throw parejasError;
    }

    // Agregar grupo a cada pareja (mismo método que en viewer.js)
    const parejasConGrupo = agregarGrupoAParejas(todasParejas || [], grupos || []);
    
    // VALIDAR: Verificar que la pareja de la identidad todavía existe
    const parejaExiste = todasParejas?.find(p => p.id === identidad.parejaId);
    if (!parejaExiste) {
      console.warn('[vistaPersonal] Pareja no encontrada:', identidad.parejaId, 'Nombre guardado:', identidad.parejaNombre);
      // Retornar error especial para que el llamador limpie la identidad
      return { 
        ok: false, 
        error: { 
          code: 'PAREJA_NO_ENCONTRADA',
          message: 'La pareja guardada ya no existe. Por favor, identifícate nuevamente.',
          parejaId: identidad.parejaId
        } 
      };
    }
    
    // Filtrar parejas del mismo grupo
    const miGrupo = identidad.grupo;
    const parejasDelGrupo = parejasConGrupo.filter(p => p.grupo === miGrupo);

    // Fetch partidos de la pareja identificada con datos completos
    console.log('[vistaPersonal] Buscando partidos para parejaId:', identidad.parejaId, 'torneoId:', torneoId);
    const { data: misPartidos, error } = await supabase
      .from('partidos')
      .select(`
        id, games_a, games_b, estado, updated_at, ronda,
        cargado_por_pareja_id,
        resultado_temp_a, resultado_temp_b,
        notas_revision,
        grupo_id,
        pareja_a_id,
        pareja_b_id,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        set1_temp_a, set1_temp_b, set2_temp_a, set2_temp_b, set3_temp_a, set3_temp_b,
        grupos ( id, nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre ),
        copa_id,
        ronda_copa
      `)
      .eq('torneo_id', torneoId)
      .or(`pareja_a_id.eq.${identidad.parejaId},pareja_b_id.eq.${identidad.parejaId}`)
      .order('updated_at', { ascending: false });
    
    console.log('[vistaPersonal] Partidos encontrados:', misPartidos?.length || 0);
    if (misPartidos && misPartidos.length > 0) {
      console.log('[vistaPersonal] Primer partido:', {
        id: misPartidos[0].id,
        pareja_a_id: misPartidos[0].pareja_a_id,
        pareja_b_id: misPartidos[0].pareja_b_id,
        estado: misPartidos[0].estado,
        games_a: misPartidos[0].games_a,
        games_b: misPartidos[0].games_b
      });
    }
    
    if (error) {
      console.error('[vistaPersonal] Error cargando partidos:', error);
      throw error;
    }
    
    // Fetch TODOS los partidos del grupo para calcular fechas libres
    const grupoId = grupos?.find(g => g.nombre === miGrupo)?.id;
    console.log('[vistaPersonal] Grupo encontrado:', miGrupo, 'grupoId:', grupoId);
    const { data: todosPartidosGrupo } = grupoId
      ? await supabase
          .from('partidos')
          .select(`
            id, games_a, games_b, ronda, estado,
            grupo_id,
            pareja_a_id,
            pareja_b_id,
            grupos ( nombre ),
            pareja_a:parejas!partidos_pareja_a_id_fkey ( nombre ),
            pareja_b:parejas!partidos_pareja_b_id_fkey ( nombre )
          `)
          .eq('torneo_id', torneoId)
          .is('copa_id', null)
          .eq('grupo_id', grupoId)
      : { data: [] };
    
    console.log('[vistaPersonal] Partidos del grupo:', todosPartidosGrupo?.length || 0);

    // Categorizar partidos por estado y prioridad
    const partidos = categorizarPartidos(misPartidos || [], identidad);

    // Calcular estadísticas
    const estadisticas = calcularEstadisticas(misPartidos || [], identidad, supabase, torneoId);

    // Calcular tabla de posiciones del grupo
    const tablaGrupo = await calcularTablaGrupo(supabase, torneoId, identidad, parejasDelGrupo);
    console.log('[vistaPersonal] Tabla grupo calculada:', tablaGrupo?.length || 0, 'parejas');
    console.log('[vistaPersonal] Partidos categorizados:', {
      enRevision: partidos.enRevision.length,
      porConfirmar: partidos.porConfirmar.length,
      porCargar: partidos.porCargar.length,
      confirmados: partidos.confirmados.length
    });

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
    if (!identidad.grupo) return null;
    
    const { data: grupos, error: grupoError } = await supabase
      .from('grupos')
      .select('id, nombre')
      .eq('torneo_id', torneoId)
      .eq('nombre', String(identidad.grupo).trim())
      .maybeSingle();

    if (grupoError || !grupos?.id) return null;

    const grupoId = grupos.id;

    // Obtener todos los partidos del grupo
    const { data: todosPartidos } = await supabase
      .from('partidos')
      .select(`
        id, games_a, games_b, estado,
        pareja_a_id, pareja_b_id,
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('torneo_id', torneoId)
      .eq('grupo_id', grupoId);

    if (!todosPartidos) return null;

    // Calcular tabla usando función centralizada
    const tablaBase = calcularTablaGrupoCentral(todosPartidos);

    // Cargar overrides
    const overridesMap = await cargarOverrides(supabase, torneoId, grupoId);

    // Aplicar overrides (solo en empates reales)
    const tablaOrdenada = ordenarConOverrides(tablaBase, overridesMap, todosPartidos);

    // Encontrar posición de mi pareja
    const miPosicion = tablaOrdenada.findIndex(entry => entry.pareja_id === identidad.parejaId);

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

// Función detectarEmpatesReales ahora usa la función centralizada

/**
 * Calcula la tabla de posiciones del grupo usando funciones centralizadas
 */
async function calcularTablaGrupo(supabase, torneoId, identidad, parejasDelGrupo) {
  try {
    // Obtener grupo ID
    if (!identidad.grupo) return [];
    
    const { data: grupos, error: grupoError } = await supabase
      .from('grupos')
      .select('id, nombre')
      .eq('torneo_id', torneoId)
      .eq('nombre', String(identidad.grupo).trim())
      .maybeSingle();

    if (grupoError || !grupos?.id) return [];

    const grupoId = grupos.id;

    // Obtener todos los partidos del grupo
    const { data: partidosGrupo } = await supabase
      .from('partidos')
      .select(`
        id, games_a, games_b, estado,
        pareja_a_id, pareja_b_id,
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre ),
        grupos ( nombre )
      `)
      .eq('torneo_id', torneoId)
      .eq('grupo_id', grupoId);

    if (!partidosGrupo) return [];

    // Calcular tabla usando función centralizada
    const tablaBase = calcularTablaGrupoCentral(partidosGrupo, parejasDelGrupo);

    // Calcular posición automática (sin overrides) usando ordenarTabla para considerar enfrentamiento directo
    const tablaAuto = ordenarTabla([...tablaBase], partidosGrupo);

    const autoPosMap = {};
    tablaAuto.forEach((s, idx) => {
      autoPosMap[s.pareja_id] = idx + 1;
    });

    // Cargar overrides
    const overridesMap = await cargarOverrides(supabase, torneoId, grupoId);

    // Aplicar overrides (solo en empates reales)
    const tablaOrdenada = ordenarConOverrides(tablaBase, overridesMap, partidosGrupo);

    // Detectar empates reales
    const { tieGroups } = detectarEmpatesRealesCentral(tablaOrdenada, partidosGrupo, overridesMap);

    // Crear mapa de color por pareja
    const tieColorMap = {};
    if (tieGroups) {
      tieGroups.forEach(group => {
        group.parejaIds.forEach(parejaId => {
          tieColorMap[parejaId] = group.color;
        });
      });
    }

    // Agregar metadata de overrides
    const tablaConMetadata = agregarMetadataOverrides(tablaOrdenada, overridesMap);

    // Transformar a formato esperado por el render
    const tabla = tablaConMetadata.map((s, idx) => {
      // Mapear campos: pareja_id -> parejaId, P -> puntos, etc.
      return {
        parejaId: s.pareja_id,
        nombre: s.nombre,
        puntos: s.P,
        jugados: s.PJ,
        ganados: s.PG,
        perdidos: s.PP,
        gamesAFavor: s.GF,
        gamesEnContra: s.GC,
        posicionActual: idx + 1,
        posicionAuto: autoPosMap[s.pareja_id] || idx + 1,
        delta: (autoPosMap[s.pareja_id] || idx + 1) - (idx + 1),
        tieneOverride: s.tieneOverrideAplicado,
        colorEmpate: tieColorMap[s.pareja_id] || null,
        esMiPareja: s.pareja_id === identidad.parejaId
      };
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
  const contentEl = document.getElementById('viewer-content');
  if (!contentEl) {
    console.error('[vistaPersonal] No se encontró #viewer-content en el DOM');
    return;
  }
  console.log('[vistaPersonal] Renderizando vista para:', identidad.parejaNombre);

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
          <button class="personal-change-link" id="btn-change-pareja" type="button">
            ¿No sos vos?
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
    
    // Calcular resultados desde sets o games
    let gamesA1, gamesB1, gamesA2, gamesB2;
    
    if (p.set1_a !== null && p.set1_b !== null) {
      // Calcular desde sets originales
      let setsA = 0, setsB = 0;
      if (p.set1_a > p.set1_b) setsA++; else if (p.set1_b > p.set1_a) setsB++;
      if (p.set2_a !== null && p.set2_b !== null) {
        if (p.set2_a > p.set2_b) setsA++; else if (p.set2_b > p.set2_a) setsB++;
      }
      if (p.set3_a !== null && p.set3_b !== null) {
        if (p.set3_a > p.set3_b) setsA++; else if (p.set3_b > p.set3_a) setsB++;
      }
      gamesA1 = setsA;
      gamesB1 = setsB;
      
      // Calcular desde sets temporales
      setsA = 0; setsB = 0;
      if (p.set1_temp_a > p.set1_temp_b) setsA++; else if (p.set1_temp_b > p.set1_temp_a) setsB++;
      if (p.set2_temp_a !== null && p.set2_temp_b !== null) {
        if (p.set2_temp_a > p.set2_temp_b) setsA++; else if (p.set2_temp_b > p.set2_temp_a) setsB++;
      }
      if (p.set3_temp_a !== null && p.set3_temp_b !== null) {
        if (p.set3_temp_a > p.set3_temp_b) setsA++; else if (p.set3_temp_b > p.set3_temp_a) setsB++;
      }
      gamesA2 = setsA;
      gamesB2 = setsB;
    } else {
      gamesA1 = p.games_a;
      gamesB1 = p.games_b;
      gamesA2 = p.resultado_temp_a;
      gamesB2 = p.resultado_temp_b;
    }
    
    // Resultado 1 (original)
    const resultado1 = getMensajeResultado(gamesA1, gamesB1, soyA);
    const mensaje1 = resultado1.ganador === 'yo' ? 'Vos ganaste' : 'Vos perdiste';
    
    // Resultado 2 (temporal)
    const resultado2 = getMensajeResultado(gamesA2, gamesB2, soyA);
    const mensaje2 = resultado2.ganador === 'yo' ? 'Vos ganaste' : 'Vos perdiste';
    
    // Formatear resultados para mostrar
    const res1 = p.set1_a !== null ? formatearResultado(p) : `${gamesA1} - ${gamesB1}`;
    const res2 = p.set1_temp_a !== null ? (() => {
      const tempPartido = { ...p, set1_a: p.set1_temp_a, set1_b: p.set1_temp_b, set2_a: p.set2_temp_a, set2_b: p.set2_temp_b, set3_a: p.set3_temp_a, set3_b: p.set3_temp_b };
      return formatearResultado(tempPartido);
    })() : `${gamesA2} - ${gamesB2}`;
    
    return `
      <div class="partido partido-revision" data-partido-id="${p.id}">
        <div class="partido-header">
          <div class="partido-vs">vs ${escapeHtml(oponente)}</div>
          <div class="partido-badge badge-revision">En revisión</div>
        </div>
        
        <div class="conflicto-box">
          <div class="conflicto-item ${esParejaCargadora ? 'es-mio' : ''}">
            <div class="conflicto-label">${esParejaCargadora ? 'Tu resultado' : 'Resultado de ' + oponente}</div>
            <div class="conflicto-score">${res1}</div>
            <div class="conflicto-mensaje ${resultado1.ganador === 'yo' ? 'ganaste' : 'perdiste'}">${mensaje1}</div>
          </div>
          
          <div class="conflicto-vs">vs</div>
          
          <div class="conflicto-item ${!esParejaCargadora ? 'es-mio' : ''}">
            <div class="conflicto-label">${!esParejaCargadora ? 'Tu resultado' : 'Resultado de ' + oponente}</div>
            <div class="conflicto-score">${res2}</div>
            <div class="conflicto-mensaje ${resultado2.ganador === 'yo' ? 'ganaste' : 'perdiste'}">${mensaje2}</div>
          </div>
        </div>
        
        <div class="partido-actions">
          <button class="btn-primary" onclick="app.aceptarOtroResultado('${p.id}')">
            ✅ Aceptar resultado de ${escapeHtml(oponente)}
          </button>
          <button class="btn-secondary" onclick="app.recargarResultado('${p.id}')">
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
    
    // Calcular resultado desde sets o games
    let gamesA, gamesB;
    if (p.set1_a !== null && p.set1_b !== null) {
      // Calcular desde sets
      let setsA = 0, setsB = 0;
      if (p.set1_a > p.set1_b) setsA++; else if (p.set1_b > p.set1_a) setsB++;
      if (p.set2_a !== null && p.set2_b !== null) {
        if (p.set2_a > p.set2_b) setsA++; else if (p.set2_b > p.set2_a) setsB++;
      }
      if (p.set3_a !== null && p.set3_b !== null) {
        if (p.set3_a > p.set3_b) setsA++; else if (p.set3_b > p.set3_a) setsB++;
      }
      gamesA = setsA;
      gamesB = setsB;
    } else {
      gamesA = p.games_a;
      gamesB = p.games_b;
    }
    
    const resultado = getMensajeResultado(gamesA, gamesB, soyA);
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
          <div class="resultado-score">${formatearResultado(p)}</div>
          <div class="resultado-mensaje">${mensajeResultado}</div>
        </div>
        
        <div class="partido-actions">
          <button class="btn-primary" onclick="app.confirmarResultadoConSets('${p.id}')">
            ✅ Confirmar este resultado
          </button>
          <button class="btn-secondary" onclick="app.cargarResultadoDiferente('${p.id}')">
            ✏️ Cargar resultado diferente
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Calcula la ronda más baja que aún debe mostrarse
 * Una ronda "pasó" si:
 * - Ya jugué partidos en rondas posteriores, O
 * - Al menos 1 partido del grupo en esa ronda ya tiene resultado
 */
function calcularRondaMinimaAMostrar(misPartidosUsuario, todosPartidosGrupo) {
  let rondaMinimaPersonal = 1;
  let rondaMinimaGrupo = 1;
  
  // Criterio personal: encontrar la ronda más baja con partido pendiente
  // Si tengo partidos jugados en rondas posteriores, las anteriores "pasaron"
  if (misPartidosUsuario && misPartidosUsuario.length > 0) {
    const partidosJugados = misPartidosUsuario.filter(p => 
      (p.estado === 'confirmado' || p.estado === 'a_confirmar') &&
      p.games_a !== null && p.games_b !== null &&
      p.ronda
    );
    
    const partidosPendientes = misPartidosUsuario.filter(p =>
      p.estado === 'pendiente' &&
      p.ronda
    );
    
    if (partidosJugados.length > 0 && partidosPendientes.length > 0) {
      // Encontrar la ronda mínima pendiente
      const rondasPendientes = partidosPendientes.map(p => p.ronda);
      rondaMinimaPersonal = Math.min(...rondasPendientes);
    }
  }
  
  // Criterio del grupo: por cada ronda, ver si al menos 1 partido ya se jugó
  if (todosPartidosGrupo && todosPartidosGrupo.length > 0) {
    // Agrupar partidos del grupo por ronda
    const partidosPorRonda = {};
    todosPartidosGrupo.forEach(p => {
      if (!p.ronda) return;
      if (!partidosPorRonda[p.ronda]) {
        partidosPorRonda[p.ronda] = [];
      }
      partidosPorRonda[p.ronda].push(p);
    });
    
    // Encontrar la primera ronda donde NINGÚN partido se jugó
    const rondas = Object.keys(partidosPorRonda).map(Number).sort((a, b) => a - b);
    
    for (const ronda of rondas) {
      const partidos = partidosPorRonda[ronda];
      const algunoJugado = partidos.some(p => 
        (p.estado === 'confirmado' || p.estado === 'a_confirmar') &&
        p.games_a !== null && p.games_b !== null
      );
      
      // Si ningún partido se jugó en esta ronda, esta es la mínima del grupo
      if (!algunoJugado) {
        rondaMinimaGrupo = ronda;
        break;
      }
    }
    
    // Si todas las rondas tienen al menos 1 partido jugado, 
    // la mínima es la última ronda + 1 (no mostrar fechas libres pasadas)
    if (rondaMinimaGrupo === 1 && rondas.length > 0) {
      const todasTienenJugados = rondas.every(ronda => {
        const partidos = partidosPorRonda[ronda];
        return partidos.some(p => 
          (p.estado === 'confirmado' || p.estado === 'a_confirmar') &&
          p.games_a !== null && p.games_b !== null
        );
      });
      
      if (todasTienenJugados) {
        rondaMinimaGrupo = Math.max(...rondas) + 1;
      }
    }
  }
  
  // La ronda mínima a mostrar es la menor entre ambos criterios
  const rondaMinima = Math.min(rondaMinimaPersonal, rondaMinimaGrupo);
  
  console.log('Ronda mínima a mostrar:', {
    personal: rondaMinimaPersonal,
    grupo: rondaMinimaGrupo,
    final: rondaMinima
  });
  
  return rondaMinima;
}

/**
 * Agrupa partidos por ronda usando la ronda de la BD
 * Detecta fechas libres comparando rondas con partidos vs total de rondas
 */
function agruparPartidosEnRondas(misPartidosPendientes, todosPartidosGrupo, todosPartidosUsuario, identidad) {
  // Calcular la ronda mínima a mostrar (fechas libres anteriores no se muestran)
  const rondaMinima = calcularRondaMinimaAMostrar(todosPartidosUsuario, todosPartidosGrupo);
  
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
  
  // Agregar solo las fechas libres >= rondaMinima (las anteriores ya pasaron)
  if (ultimaRondaPendiente > 0) {
    for (let ronda = rondaMinima; ronda <= ultimaRondaPendiente; ronda++) {
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
            <button class="btn-primary" onclick="app.cargarResultado('${p.id}')">
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
            <button class="btn-secondary btn-sm" onclick="app.cargarResultado('${p.id}')">
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
 * Agrega el botón "Ver todos los grupos" y el link "Ver fixture" al header
 */
function agregarBotonVerTodos(onVerTodos) {
  const navContainer = document.getElementById('viewer-nav-buttons');
  if (!navContainer) return;

  navContainer.innerHTML = '';

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

  const linkFixture = document.createElement('a');
  linkFixture.href = '/fixture';
  linkFixture.className = 'btn-action-secondary viewer-link-fixture';
  linkFixture.innerHTML = `
    <span class="btn-icon">📋</span>
    <span class="btn-text">Ver Fixture</span>
  `;
  navContainer.appendChild(linkFixture);
}
