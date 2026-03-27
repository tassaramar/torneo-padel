/**
 * Vista personalizada para parejas identificadas
 * HOME ÚNICO: Todo se opera desde un solo lugar
 * 
 * Layout:
 * 1. Quién soy (header + presentismo)
 * 2. Mis partidos pendientes
 * 3. Dashboard
 * 4. Acciones con contador (disputas/confirmaciones)
 * 5. Botón consulta (abre modal)
 */

import { getMensajeResultado } from '../utils/mensajesResultado.js';
import { obtenerFrasesUnicas } from '../utils/frasesFechaLibre.js';
import {
  formatearResultado,
  tieneResultado,
  calcularSetsGanados,
  determinarGanador,
  determinarGanadorParaPareja,
  invertirScoresPartido
} from '../utils/formatoResultado.js';
import {
  calcularTablaGrupo as calcularTablaGrupoCentral,
  ordenarConOverrides,
  detectarEmpatesReales as detectarEmpatesRealesCentral,
  cargarOverrides,
  agregarMetadataOverrides,
  ordenarTabla
} from '../utils/tablaPosiciones.js';
import {
  calcularColaSugerida,
  crearMapaPosiciones
} from '../utils/colaFixture.js';
import { showToast } from '../utils/toast.js';
import { labelRonda } from '../utils/copaRondas.js';
import {
  initPresentismo,
  obtenerPresentes,
  marcarPresente,
  desmarcarPresente,
  marcarAmbosPresentes,
  desmarcarTodos,
  estadoPresentismo,
  parejaCompleta,
  toastYaVisto,
  marcarToastVisto
} from './presentismo.js';

export async function cargarVistaPersonalizada(supabase, torneoId, identidad, onChangePareja, onVerTodos, { preserveScroll = false } = {}) {
  try {
    // Validar que la identidad tenga grupo
    if (!identidad.grupo) {
      console.warn('Identidad sin grupo, usando grupo por defecto');
      identidad.grupo = '?';
    }

    // Cargar configuración del torneo (presentismo_activo)
    const { data: torneo, error: torneoError } = await supabase
      .from('torneos')
      .select('presentismo_activo')
      .eq('id', torneoId)
      .single();
    
    const presentismoActivo = torneo?.presentismo_activo ?? true; // Default true si no existe

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
    
    // === PRESENTISMO ===
    // Solo procesar si el presentismo está activo para este torneo
    let mostrarToast = false;
    let toastMensaje = '';
    let estadoPresentes = { estado: 'completo', yoPresente: true, companeroPresente: true };
    
    if (presentismoActivo) {
      // Inicializar módulo y cargar estado
      initPresentismo(supabase);
      
      // Obtener presentes actuales de la BD
      const presentes = await obtenerPresentes(identidad.parejaId);
      estadoPresentes = estadoPresentismo(presentes, identidad.miNombre, identidad.companero);
      
      // Auto-marcar SOLO si:
      // 1. No está presente
      // 2. Nunca fue auto-marcado antes (toast no visto)
      // Si ya vio el toast pero no está presente = se desmarcó voluntariamente, respetar
      const yaFueAutoMarcado = toastYaVisto(torneoId, identidad.parejaId);
      
      if (!estadoPresentes.yoPresente && !yaFueAutoMarcado) {
        // Primera vez: marcar automáticamente
        await marcarPresente(identidad.parejaId, identidad.miNombre);
        mostrarToast = true;
        
        if (estadoPresentes.companeroPresente) {
          toastMensaje = `✅ ¡Ya diste el presente! ${identidad.companero} también llegó.`;
        } else {
          toastMensaje = `✅ ¡Ya diste el presente! ¿${identidad.companero} ya llegó?`;
        }
        
        // Actualizar estado después de marcarse
        estadoPresentes.yoPresente = true;
        estadoPresentes.estado = estadoPresentes.companeroPresente ? 'completo' : 'solo_yo';
      }
    }
    
    // Filtrar parejas del mismo grupo
    const miGrupo = identidad.grupo;
    const parejasDelGrupo = parejasConGrupo.filter(p => p.grupo === miGrupo);

    // Fetch partidos de la pareja identificada con datos completos
    console.log('[vistaPersonal] Buscando partidos para parejaId:', identidad.parejaId, 'torneoId:', torneoId);
    const { data: misPartidos, error } = await supabase
      .from('partidos')
      .select(`
        id, estado, updated_at, ronda,
        cargado_por_pareja_id,
        notas_revision,
        grupo_id,
        pareja_a_id,
        pareja_b_id,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        set1_temp_a, set1_temp_b, set2_temp_a, set2_temp_b, set3_temp_a, set3_temp_b,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
        stb_puntos_a, stb_puntos_b,
        grupos ( id, nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre ),
        copa_id,
        ronda_copa,
        copa:copas ( id, nombre )
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
        sets_a: misPartidos[0].sets_a,
        sets_b: misPartidos[0].sets_b
      });
    }
    
    if (error) {
      console.error('[vistaPersonal] Error cargando partidos:', error);
      throw error;
    }
    
    // Fetch TODOS los partidos del torneo para calcular la cola global
    const { data: todosPartidosTorneo } = await supabase
      .from('partidos')
      .select(`
        id, ronda, estado,
        grupo_id,
        pareja_a_id,
        pareja_b_id,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
        grupos ( id, nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('torneo_id', torneoId)
      .is('copa_id', null);
    
    // Calcular cola global y mapa de posiciones
    const colaGlobal = calcularColaSugerida(todosPartidosTorneo || [], grupos || []);
    const mapaPosiciones = crearMapaPosiciones(colaGlobal);
    console.log('[vistaPersonal] Cola global calculada:', colaGlobal.length, 'partidos pendientes');
    
    // Fetch TODOS los partidos del grupo para calcular fechas libres
    const grupoId = grupos?.find(g => g.nombre === miGrupo)?.id;
    console.log('[vistaPersonal] Grupo encontrado:', miGrupo, 'grupoId:', grupoId);
    const todosPartidosGrupo = (todosPartidosTorneo || []).filter(p => p.grupo_id === grupoId);
    
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

    // Datos de presentismo para la vista
    const presentismoData = {
      activo: presentismoActivo,
      presentes: estadoPresentes.yoPresente ? 
        (estadoPresentes.companeroPresente ? [identidad.miNombre, identidad.companero] : [identidad.miNombre]) :
        (estadoPresentes.companeroPresente ? [identidad.companero] : []),
      estado: estadoPresentes.estado,
      yoPresente: estadoPresentes.yoPresente,
      companeroPresente: estadoPresentes.companeroPresente,
      mostrarToast,
      toastMensaje
    };

    // Renderizar vista
    renderVistaPersonal(identidad, partidos, await estadisticas, tablaGrupo, todosPartidosGrupo || [], onChangePareja, onVerTodos, torneoId, presentismoData, mapaPosiciones, preserveScroll);

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
    tieneResultado(p)
  );

  const partidosJugados = partidosContabilizados.length;

  // Partidos por jugar (pendientes)
  const partidosPorJugar = partidos.filter(p => 
    p.estado === 'pendiente' || !tieneResultado(p)
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
        id, estado,
        pareja_a_id, pareja_b_id,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
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
        id, estado,
        pareja_a_id, pareja_b_id,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
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
 * Renderiza el Home Único completo
 * Layout: Quién soy → Partidos pendientes → Dashboard → Acciones con contador → Botón consulta
 */
function renderVistaPersonal(identidad, partidos, estadisticas, tablaGrupo, todosPartidosGrupo, onChangePareja, onVerTodos, torneoId, presentismoData, mapaPosiciones, preserveScroll = false) {
  const contentEl = document.getElementById('home-content');
  if (!contentEl) {
    console.error('[vistaPersonal] No se encontró #home-content en el DOM');
    return;
  }
  console.log('[vistaPersonal] Renderizando Home Único para:', identidad.parejaNombre);

  // Guardar datos para uso interno
  renderVistaPersonal._todosPartidosGrupo = todosPartidosGrupo;
  renderVistaPersonal._torneoId = torneoId;
  renderVistaPersonal._identidad = identidad;
  renderVistaPersonal._mapaPosiciones = mapaPosiciones;
  
  // Calcular contadores
  const countDisputas = partidos.enRevision.length;
  const countConfirmaciones = partidos.porConfirmar.length;
  
  // Estado de presentismo (desde BD)
  const { activo: presentismoActivo, mostrarToast, toastMensaje } = presentismoData;
  // Variables de estado de presentismo (mutable, se actualizan en los toggles)
  let yoPresente = presentismoData.yoPresente;
  let companeroPresente = presentismoData.companeroPresente;
  // Si presentismo está desactivado, consideramos pareja completa (no bloquea partidos)
  const parejaEstaCompleta = !presentismoActivo || (yoPresente && companeroPresente);
  
  // Preservar estado del panel si el usuario lo abrió manualmente
  const panelKey = `presentismo_panel_${torneoId}_${identidad.parejaId}`;
  const usuarioAbrioPanel = sessionStorage.getItem(panelKey) === 'open';
  // Por defecto: cerrado si pareja completa, abierto si falta alguien
  // Pero si el usuario lo abrió manualmente, respetar eso
  const panelAbierto = usuarioAbrioPanel || (!parejaEstaCompleta && presentismoActivo);
  
  // Ordenar partidos pendientes por orden global del fixture (ronda)
  const partidosPendientesOrdenados = [
    ...partidos.porCargar
  ].sort((a, b) => (a.ronda || 999) - (b.ronda || 999));
  
  const savedScrollY = preserveScroll ? window.scrollY : 0;

  contentEl.innerHTML = `
    <!-- Toast de presentismo (aparece y se anima hacia el header) -->
    ${mostrarToast && presentismoActivo ? `
      <div class="presentismo-toast" id="presentismo-toast">
        <span class="toast-mensaje">${toastMensaje}</span>
        ${!companeroPresente ? `
          <button type="button" class="toast-btn" id="toast-marcar-companero">
            Marcalo →
          </button>
        ` : ''}
      </div>
    ` : ''}
    
    <!-- 1) QUIÉN SOY (header colapsable) -->
    <div class="home-quien-soy ${!panelAbierto ? 'collapsed' : ''}" data-panel-key="${panelKey}">
      <div class="quien-soy-header" id="quien-soy-toggle">
        <div class="quien-soy-info">
          <h1 class="quien-soy-title">${escapeHtml(identidad.parejaNombre)}</h1>
          <div class="quien-soy-meta">
            <span class="quien-soy-grupo">Grupo ${escapeHtml(identidad.grupo)}</span>
            ${presentismoActivo ? `
              <span class="quien-soy-estado-texto">
                ${parejaEstaCompleta ? '✅ Presentes' : `⏳ Falta ${escapeHtml(identidad.companero)}`}
              </span>
            ` : ''}
          </div>
        </div>
        <button class="quien-soy-expand-btn" type="button" aria-label="Expandir">
          ${panelAbierto ? '▲' : '▼'}
        </button>
      </div>
      
      <!-- Panel expandible -->
      <div class="quien-soy-panel" id="quien-soy-panel" ${!panelAbierto ? 'style="display:none"' : ''}>
        ${presentismoActivo ? `
          <div class="presentismo-container">
            <p class="presentismo-hint">Tocá para marcar o desmarcar</p>
            
            <div class="presentismo-checks">
              <button type="button" class="presentismo-toggle ${yoPresente ? 'presente' : ''}" id="toggle-yo" data-nombre="${escapeHtml(identidad.miNombre)}">
                <span class="toggle-check">${yoPresente ? '✅' : '⬜'}</span>
                <span class="toggle-info">
                  <span class="toggle-nombre">${escapeHtml(identidad.miNombre)} <span class="toggle-rol">(vos)</span></span>
                  <span class="toggle-hint">${yoPresente ? 'tocá para desmarcar' : '¡tocá para dar presente!'}</span>
                </span>
              </button>
              
              <button type="button" class="presentismo-toggle ${companeroPresente ? 'presente' : ''}" id="toggle-companero" data-nombre="${escapeHtml(identidad.companero)}">
                <span class="toggle-check">${companeroPresente ? '✅' : '⬜'}</span>
                <span class="toggle-info">
                  <span class="toggle-nombre">${escapeHtml(identidad.companero)}</span>
                  <span class="toggle-hint">${companeroPresente ? 'tocá para desmarcar' : '¿ya llegó? ¡Marcalo!'}</span>
                </span>
              </button>
            </div>
            
            ${parejaEstaCompleta ? `
              <p class="presentismo-mensaje-listo">🎾 ¡Están los dos! A romperla</p>
            ` : ''}
          </div>
        ` : ''}
        
        <button class="quien-soy-change" type="button" id="btn-change-pareja">
          ¿No sos vos?
        </button>
      </div>
    </div>

    <!-- 2) DASHBOARD (resumen) -->
    <div class="home-dashboard">
      ${estadisticas.posicion ? `
        <div class="dash-card dash-posicion">
          <div class="dash-value">${estadisticas.posicion}°</div>
          <div class="dash-label">Posición</div>
        </div>
      ` : ''}
      <div class="dash-card">
        <div class="dash-value">${estadisticas.partidosPorJugar}</div>
        <div class="dash-label">${estadisticas.partidosPorJugar === 0 ? '¡Jugaste todos!' : estadisticas.partidosPorJugar === 1 ? 'Te falta jugar' : 'Te faltan jugar'}</div>
      </div>
      <div class="dash-card">
        <div class="dash-value">${estadisticas.partidosJugados}</div>
        <div class="dash-label">Jugados</div>
      </div>
    </div>

    <!-- 3) DISPUTAS Y CONFIRMACIONES (inline, siempre visibles si hay) -->
    ${countDisputas > 0 ? `
      <div class="home-seccion-inline seccion-disputa">
        <h2 class="seccion-inline-titulo">🔴 Disputas (${countDisputas})</h2>
        <div id="partidos-revision"></div>
      </div>
    ` : ''}
    ${countConfirmaciones > 0 ? `
      <div class="home-seccion-inline seccion-confirmacion">
        <h2 class="seccion-inline-titulo">🔔 Por confirmar (${countConfirmaciones})</h2>
        <div id="partidos-confirmar"></div>
      </div>
    ` : ''}

    <!-- 4) MIS PARTIDOS PENDIENTES -->
    <div class="home-partidos-pendientes">
      ${!parejaEstaCompleta ? `
        <div class="partidos-bloqueados-msg partidos-warning-msg">
          <span class="msg-icon">⚠️</span>
          <span class="msg-text">Falta ${escapeHtml(!yoPresente && !companeroPresente ? 'que den el presente' : !yoPresente ? 'tu presente' : `que llegue ${identidad.companero}`)}. Igual podés cargar resultados.</span>
        </div>
      ` : ''}
      
      ${partidosPendientesOrdenados.length === 0 && partidos.porConfirmar.length === 0 && partidos.enRevision.length === 0 ? `
        <div class="partidos-vacio">
          <span class="vacio-icon">🎉</span>
          <span class="vacio-text">¡No tenés partidos pendientes!</span>
        </div>
      ` : `
        <div id="partidos-pendientes-lista">
          <!-- Se renderiza dinámicamente -->
        </div>
      `}
    </div>

    <!-- 5) BOTÓN CONSULTA -->
    <div class="home-consulta">
      <a href="/general.html" class="btn-consulta">
        <span class="btn-consulta-icon">📊</span>
        <span class="btn-consulta-text">Ver posiciones y cruces</span>
      </a>
    </div>

    <!-- Partidos jugados (colapsados) -->
    <div class="home-partidos-jugados">
      <details class="home-details">
        <summary>Ver partidos jugados (${partidos.confirmados.length})</summary>
        <div id="partidos-confirmados"></div>
      </details>
    </div>
  `;

  // === Wire eventos ===
  
  // Quién soy: toggle panel (con persistencia)
  const quienSoyToggle = document.getElementById('quien-soy-toggle');
  const quienSoyPanel = document.getElementById('quien-soy-panel');
  const quienSoyContainer = document.querySelector('.home-quien-soy');
  const panelKeyAttr = quienSoyContainer?.dataset.panelKey;
  
  quienSoyToggle?.addEventListener('click', () => {
    const isHidden = quienSoyPanel.style.display === 'none';
    quienSoyPanel.style.display = isHidden ? '' : 'none';
    quienSoyContainer?.classList.toggle('collapsed', !isHidden);
    const expandBtn = quienSoyToggle.querySelector('.quien-soy-expand-btn');
    if (expandBtn) expandBtn.textContent = isHidden ? '▲' : '▼';
    
    // Guardar estado del panel para que persista entre refreshes
    if (panelKeyAttr) {
      if (isHidden) {
        sessionStorage.setItem(panelKeyAttr, 'open');
      } else {
        sessionStorage.removeItem(panelKeyAttr);
      }
    }
  });
  
  // Cambiar de pareja
  document.getElementById('btn-change-pareja')?.addEventListener('click', onChangePareja);
  
  // === Presentismo (Optimistic UI + Rollback) ===

  // Helper: actualizar toggle visualmente (optimistic)
  function actualizarToggleUI(toggleEl, nuevoEstado, esYo = false) {
    if (!toggleEl) return;

    const checkEl = toggleEl.querySelector('.toggle-check');
    const hintEl = toggleEl.querySelector('.toggle-hint');

    if (nuevoEstado) {
      toggleEl.classList.add('presente');
      if (checkEl) checkEl.textContent = '✅';
      if (hintEl) hintEl.textContent = 'tocá para desmarcar';
    } else {
      toggleEl.classList.remove('presente');
      if (checkEl) checkEl.textContent = '⬜';
      if (hintEl) hintEl.textContent = esYo ? '¡tocá para dar presente!' : '¿ya llegó? ¡Marcalo!';
    }
  }

  // Helper: cerrar panel suavemente cuando ambos están presentes
  function cerrarPanelPresentismo() {
    const panel = document.getElementById('quien-soy-panel');
    const container = document.querySelector('.home-quien-soy');

    if (!panel || !container) return;

    // Animar cierre suave
    panel.classList.add('closing');

    setTimeout(() => {
      panel.style.display = 'none';
      container.classList.add('collapsed');
      panel.classList.remove('closing');

      // Actualizar botón
      const expandBtn = container.querySelector('.quien-soy-expand-btn');
      if (expandBtn) expandBtn.textContent = '▼';

      // Actualizar estado en header
      const estadoTexto = container.querySelector('.quien-soy-estado-texto');
      if (estadoTexto) estadoTexto.textContent = '✅ Presentes';

      // Limpiar sessionStorage
      if (panelKeyAttr) {
        sessionStorage.removeItem(panelKeyAttr);
      }
    }, 300);
  }

  // Toggle mi presencia
  const toggleYoEl = document.getElementById('toggle-yo');
  toggleYoEl?.addEventListener('click', async () => {
    const estadoAnterior = yoPresente;
    const nuevoEstado = !yoPresente;

    // OPTIMISTIC UI: Actualizar check inmediatamente
    actualizarToggleUI(toggleYoEl, nuevoEstado, true);

    // Actualizar BD en background
    let success;
    if (nuevoEstado) {
      success = await marcarPresente(identidad.parejaId, identidad.miNombre);
    } else {
      success = await desmarcarPresente(identidad.parejaId, identidad.miNombre);
    }

    if (success) {
      // SUCCESS: Verificar si ahora están ambos presentes
      yoPresente = nuevoEstado;
      const ambosPresentes = yoPresente && companeroPresente;

      if (ambosPresentes) {
        // Toast de éxito + cierre suave del panel
        showToast('🎾 ¡Listos para jugar! A romperla', 'success');
        cerrarPanelPresentismo();

        // Refresh después de cerrar panel
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('homeRefresh'));
        }, 400);
      } else {
        // Refresh normal
        window.dispatchEvent(new CustomEvent('homeRefresh'));
      }
    } else {
      // ROLLBACK: Revert + Notify + Refresh
      actualizarToggleUI(toggleYoEl, estadoAnterior, true);
      showToast('Error al actualizar presentismo. Intentá de nuevo.', 'error');
      await window.dispatchEvent(new CustomEvent('homeRefresh'));
    }
  });

  // Toggle compañero
  const toggleCompEl = document.getElementById('toggle-companero');
  toggleCompEl?.addEventListener('click', async () => {
    const estadoAnterior = companeroPresente;
    const nuevoEstado = !companeroPresente;

    // OPTIMISTIC UI: Actualizar check inmediatamente
    actualizarToggleUI(toggleCompEl, nuevoEstado, false);

    // Actualizar BD en background
    let success;
    if (nuevoEstado) {
      success = await marcarPresente(identidad.parejaId, identidad.companero);
    } else {
      success = await desmarcarPresente(identidad.parejaId, identidad.companero);
    }

    if (success) {
      // SUCCESS: Verificar si ahora están ambos presentes
      companeroPresente = nuevoEstado;
      const ambosPresentes = yoPresente && companeroPresente;

      if (ambosPresentes) {
        // Toast de éxito + cierre suave del panel
        showToast('🎾 ¡Listos para jugar! A romperla', 'success');
        cerrarPanelPresentismo();

        // Refresh después de cerrar panel
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('homeRefresh'));
        }, 400);
      } else {
        // Refresh normal
        window.dispatchEvent(new CustomEvent('homeRefresh'));
      }
    } else {
      // ROLLBACK: Revert + Notify + Refresh
      actualizarToggleUI(toggleCompEl, estadoAnterior, false);
      showToast('Error al actualizar presentismo. Intentá de nuevo.', 'error');
      await window.dispatchEvent(new CustomEvent('homeRefresh'));
    }
  });

  // Marcar compañero desde el toast
  document.getElementById('toast-marcar-companero')?.addEventListener('click', async () => {
    const estadoAnterior = companeroPresente;
    const toggleComp = document.getElementById('toggle-companero');

    // OPTIMISTIC UI: Actualizar inmediatamente
    actualizarToggleUI(toggleComp, true, false);

    const toast = document.getElementById('presentismo-toast');
    if (toast) toast.remove();

    // Actualizar BD
    const success = await marcarPresente(identidad.parejaId, identidad.companero);

    if (success) {
      companeroPresente = true;
      const ambosPresentes = yoPresente && companeroPresente;

      if (ambosPresentes) {
        showToast('🎾 ¡Listos para jugar! A romperla', 'success');
        cerrarPanelPresentismo();
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('homeRefresh'));
        }, 400);
      } else {
        window.dispatchEvent(new CustomEvent('homeRefresh'));
      }
    } else {
      // ROLLBACK
      actualizarToggleUI(toggleComp, estadoAnterior, false);
      showToast('Error al actualizar presentismo. Intentá de nuevo.', 'error');
      await window.dispatchEvent(new CustomEvent('homeRefresh'));
    }
  });
  
  // === Toast animado ===
  if (mostrarToast) {
    const toast = document.getElementById('presentismo-toast');
    const header = document.getElementById('quien-soy-toggle');
    
    if (toast && header) {
      // Marcar como visto
      marcarToastVisto(torneoId, identidad.parejaId);
      
      // Animar toast después de 4 segundos
      setTimeout(() => {
        toast.classList.add('animating-out');
        
        // Remover después de la animación
        setTimeout(() => {
          toast.remove();
        }, 500);
      }, 4000);
    }
  }
  
  // === Renderizar partidos ===

  // Renderizar disputas y confirmaciones (inline, ya visibles en el DOM)
  renderPartidosRevision(partidos.enRevision, identidad);
  renderPartidosConfirmar(partidos.porConfirmar, identidad);
  
  // Renderizar partidos pendientes (en el bloque principal)
  const todosPartidos = [...partidos.enRevision, ...partidos.porConfirmar, ...partidos.porCargar, ...partidos.confirmados];
  renderPartidosPendientesHome(partidosPendientesOrdenados, todosPartidosGrupo, todosPartidos, identidad, parejaEstaCompleta, mapaPosiciones);
  
  // Renderizar partidos jugados
  renderPartidosConfirmados(partidos.confirmados, identidad);

  // Restaurar scroll después del render completo (solo en polling refresh)
  if (preserveScroll && savedScrollY > 0) {
    window.scrollTo(0, savedScrollY);
  }
}

/**
 * Renderiza los partidos pendientes para el Home Único
 * Usa la posición global de la cola del fixture
 */
function renderPartidosPendientesHome(partidosPendientes, todosPartidosGrupo, todosPartidosUsuario, identidad, habilitado, mapaPosiciones) {
  const container = document.getElementById('partidos-pendientes-lista');
  if (!container) return;
  
  if (partidosPendientes.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  // Ordenar partidos por posición global
  const partidosConPosicion = partidosPendientes.map(p => ({
    ...p,
    posicionGlobal: mapaPosiciones.get(p.id) || 999
  })).sort((a, b) => a.posicionGlobal - b.posicionGlobal);

  const proximo = partidosConPosicion[0];
  const resto = partidosConPosicion.slice(1);

  // Card del próximo partido
  const oponenteProximo = getOponenteName(proximo, identidad);
  const posicionProximo = proximo.posicionGlobal !== 999 ? `#${proximo.posicionGlobal}` : '—';
  const copaBadgeProximo = proximo.copa_id
    ? (proximo.copa?.nombre ? `🏆 ${proximo.copa.nombre} — ${labelRonda(proximo.ronda_copa, true) || 'Copa'}` : `🏆 ${labelRonda(proximo.ronda_copa, true) || 'Copa'}`)
    : null;

  let html = `
    <div class="partido-proximo">
      <h3 class="proximo-titulo">🎾 Tu próximo partido</h3>
      <div class="proximo-card">
        ${copaBadgeProximo ? `<span class="proximo-badge-copa">${escapeHtml(copaBadgeProximo)}</span>` : ''}
        <span class="proximo-vs">vs ${escapeHtml(oponenteProximo)}</span>
        <span class="proximo-cola">${posicionProximo} en la cola (según resultados cargados)</span>
        <button
          type="button"
          class="btn-cargar-proximo"
          onclick="app.cargarResultado('${proximo.id}')"
        >
          📝 Cargar resultado
        </button>
      </div>
    </div>
  `;

  if (resto.length > 0) {
    html += `<h3 class="pendientes-resto-titulo">Los que vienen después</h3>`;
    resto.forEach(p => {
      const oponente = getOponenteName(p, identidad);
      const posicion = p.posicionGlobal !== 999 ? `#${p.posicionGlobal}*` : '—';
      const copaBadge = p.copa_id ? '🏆 ' : '';
      html += `
        <div class="partido-resto" data-partido-id="${p.id}">
          <span class="resto-posicion">${posicion}</span>
          <span class="resto-vs">${copaBadge}vs ${escapeHtml(oponente)}</span>
          <button
            type="button"
            class="btn-cargar-resto"
            onclick="app.cargarResultado('${p.id}')"
          >📝 Cargar</button>
        </div>
      `;
    });
    html += `<p class="resto-leyenda">* Posición según resultados cargados</p>`;
  }

  container.innerHTML = html;
}

/**
 * Toggle de secciones expandibles (disputas/confirmaciones)
 */
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
    
    // Calcular sets ganados desde sets originales y temporales
    const { setsA: setsA1, setsB: setsB1 } = calcularSetsGanados(p);
    
    // Calcular sets ganados desde sets temporales
    const tempPartido = { 
      set1_a: p.set1_temp_a, set1_b: p.set1_temp_b, 
      set2_a: p.set2_temp_a, set2_b: p.set2_temp_b, 
      set3_a: p.set3_temp_a, set3_b: p.set3_temp_b 
    };
    const { setsA: setsA2, setsB: setsB2 } = calcularSetsGanados(tempPartido);
    
    const gamesA1 = setsA1;
    const gamesB1 = setsB1;
    const gamesA2 = setsA2;
    const gamesB2 = setsB2;
    
    // Resultado 1 (original)
    const resultado1 = getMensajeResultado(gamesA1, gamesB1, soyA);
    const mensaje1 = resultado1.ganador === 'yo' ? 'Vos ganaste' : 'Vos perdiste';
    
    // Resultado 2 (temporal)
    const resultado2 = getMensajeResultado(gamesA2, gamesB2, soyA);
    const mensaje2 = resultado2.ganador === 'yo' ? 'Vos ganaste' : 'Vos perdiste';
    
    // Formatear resultados para mostrar (orientados al jugador: mi score primero)
    const res1 = p.set1_a !== null ? formatearResultado(soyA ? p : invertirScoresPartido(p)) : `${gamesA1} - ${gamesB1}`;
    const res2 = p.set1_temp_a !== null ? (() => {
      const tempPartido = { ...p, set1_a: p.set1_temp_a, set1_b: p.set1_temp_b, set2_a: p.set2_temp_a, set2_b: p.set2_temp_b, set3_a: p.set3_temp_a, set3_b: p.set3_temp_b };
      return formatearResultado(soyA ? tempPartido : invertirScoresPartido(tempPartido));
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
    
    // Calcular sets ganados
    const { setsA, setsB } = calcularSetsGanados(p);
    const gamesA = setsA;
    const gamesB = setsB;
    
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
          <div class="resultado-score">${formatearResultado(soyA ? p : invertirScoresPartido(p))}</div>
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
      tieneResultado(p) &&
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
        tieneResultado(p)
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
          tieneResultado(p)
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

  // Separar copa del flujo normal de rondas
  const copaPartidos = partidosPendientes.filter(p => p.copa_id);
  const grupoPartidos = partidosPendientes.filter(p => !p.copa_id);

  // Agrupar en rondas usando todos los partidos del usuario para detectar correctamente
  const rondas = agruparPartidosEnRondas(grupoPartidos, todosPartidosGrupo, todosPartidosUsuario, identidad);
  
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
              <div class="resultado-score">${formatearResultado(p)}</div>
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

  // Partidos de copa pendientes (fuera del sistema de rondas)
  if (copaPartidos.length > 0) {
    html += `
      <div class="ronda-separator">
        <div class="ronda-titulo">🏆 Copa</div>
      </div>
    `;
    copaPartidos.forEach(p => {
      const oponente = getOponenteName(p, identidad);
      const rondalabel = labelRonda(p.ronda_copa, true) || 'Copa';
      const esperandoConfirmacion = p.estado === 'a_confirmar' && p.cargado_por_pareja_id === identidad.parejaId;
      html += `
        <div class="partido partido-cargar" data-partido-id="${p.id}">
          <div class="partido-header">
            <div class="partido-vs">vs ${escapeHtml(oponente)}</div>
            <div class="partido-badge badge-copa">${escapeHtml(p.copa?.nombre ? `${p.copa.nombre} — ${rondalabel}` : rondalabel)}</div>
          </div>
          ${esperandoConfirmacion ? `
            <div class="resultado-cargado">
              <div class="resultado-label">Tu resultado cargado:</div>
              <div class="resultado-score">${formatearResultado(p)}</div>
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
  }

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
    const soyA = p.pareja_a?.id === identidad.parejaId;
    const esperandoConfirmacion = p.estado === 'a_confirmar' && p.cargado_por_pareja_id === identidad.parejaId;
    const copaLabel = p.copa_id
      ? (p.copa?.nombre ? `${p.copa.nombre} — ${labelRonda(p.ronda_copa, true) || 'Copa'}` : labelRonda(p.ronda_copa, true) || 'Copa')
      : null;

    return `
      <div class="partido partido-confirmado ${ganador ? 'ganador-' + ganador : ''}">
        <div class="partido-simple">
          <div class="partido-vs">
            ${copaLabel ? `<span class="badge-mini badge-copa" style="margin-right:4px;">🏆 ${escapeHtml(copaLabel)}</span>` : ''}
            vs ${escapeHtml(oponente)}
          </div>
          <div class="resultado-info">
            <div class="resultado-score ${ganador === 'yo' ? 'ganador' : ganador === 'rival' ? 'perdedor' : ''}">
              ${formatearResultado(soyA ? p : invertirScoresPartido(p))}
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
 * Determina quién ganó el partido (usa función centralizada)
 */
function getGanador(partido, identidad) {
  return determinarGanadorParaPareja(partido, identidad.parejaId);
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

// La función agregarBotonVerTodos fue eliminada - ahora el modal de consulta
// reemplaza la navegación a páginas separadas (Home Único)
