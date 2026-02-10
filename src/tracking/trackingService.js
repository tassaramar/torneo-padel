/**
 * Servicio de tracking de uso por jugador
 * Registra eventos de visitas y carga de resultados
 */

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

/**
 * Registra una visita cuando un jugador se identifica
 * @param {Object} supabase - Cliente de Supabase
 * @param {Object} identidad - Datos de identidad del jugador
 * @returns {Promise<{ok: boolean, error?: any}>}
 */
export async function trackVisita(supabase, identidad) {
  try {
    const { error } = await supabase
      .from('tracking_eventos')
      .insert({
        torneo_id: TORNEO_ID,
        pareja_id: identidad.parejaId,
        jugador_nombre: identidad.miNombre,
        tipo_evento: 'visita',
        metadata: {
          timestamp: new Date().toISOString(),
          pareja_nombre: identidad.parejaNombre,
          grupo: identidad.grupo,
          companero: identidad.companero
        }
      });

    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error('Error tracking visita:', error);
    return { ok: false, error };
  }
}

/**
 * Registra cuando un jugador carga un resultado
 * @param {Object} supabase - Cliente de Supabase
 * @param {Object} identidad - Datos de identidad del jugador
 * @param {String} partidoId - ID del partido
 * @param {Number} gamesA - Games de pareja A
 * @param {Number} gamesB - Games de pareja B
 * @returns {Promise<{ok: boolean, error?: any}>}
 */
export async function trackCargaResultado(supabase, identidad, partidoId, gamesA, gamesB) {
  try {
    const { error } = await supabase
      .from('tracking_eventos')
      .insert({
        torneo_id: TORNEO_ID,
        pareja_id: identidad.parejaId,
        jugador_nombre: identidad.miNombre,
        tipo_evento: 'carga_resultado',
        metadata: {
          timestamp: new Date().toISOString(),
          partido_id: partidoId,
          // Estos campos son legacy para compat con logs existentes
          games_a: gamesA,
          games_b: gamesB,
          resultado: gamesA !== null && gamesB !== null ? `${gamesA}-${gamesB}` : 'N/A',
          pareja_nombre: identidad.parejaNombre
        }
      });

    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error('Error tracking carga resultado:', error);
    return { ok: false, error };
  }
}

/**
 * Obtiene estadísticas agregadas de actividad
 * @param {Object} supabase - Cliente de Supabase
 * @param {Number} diasAtras - Días hacia atrás para calcular (default: 7)
 * @returns {Promise<Object>} Estadísticas de actividad
 */
export async function getActivityStats(supabase, diasAtras = 7) {
  try {
    const fechaDesde = new Date();
    fechaDesde.setDate(fechaDesde.getDate() - diasAtras);

    // Obtener todos los eventos del periodo
    const { data: eventos, error } = await supabase
      .from('tracking_eventos')
      .select('*')
      .eq('torneo_id', TORNEO_ID)
      .gte('created_at', fechaDesde.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calcular estadísticas
    const totalEventos = eventos?.length || 0;
    const visitas = eventos?.filter(e => e.tipo_evento === 'visita') || [];
    const cargas = eventos?.filter(e => e.tipo_evento === 'carga_resultado') || [];
    
    const jugadoresUnicos = new Set(eventos?.map(e => e.jugador_nombre) || []);
    const parejasUnicas = new Set(eventos?.map(e => e.pareja_id) || []);

    // Promedio de visitas por jugador
    const promedioVisitasPorJugador = jugadoresUnicos.size > 0 
      ? (visitas.length / jugadoresUnicos.size).toFixed(1)
      : 0;

    return {
      ok: true,
      periodo: { diasAtras, fechaDesde },
      totales: {
        eventos: totalEventos,
        visitas: visitas.length,
        cargas: cargas.length,
        jugadores_activos: jugadoresUnicos.size,
        parejas_activas: parejasUnicas.size
      },
      promedios: {
        visitas_por_jugador: parseFloat(promedioVisitasPorJugador)
      }
    };
  } catch (error) {
    console.error('Error obteniendo stats:', error);
    return { ok: false, error };
  }
}

/**
 * Obtiene datos para timeline (gráfico temporal)
 * @param {Object} supabase - Cliente de Supabase
 * @param {Number} diasAtras - Días hacia atrás
 * @returns {Promise<Object>} Datos para gráfico
 */
export async function getTimelineData(supabase, diasAtras = 7) {
  try {
    const fechaDesde = new Date();
    fechaDesde.setDate(fechaDesde.getDate() - diasAtras);

    const { data: eventos, error } = await supabase
      .from('tracking_eventos')
      .select('tipo_evento, created_at')
      .eq('torneo_id', TORNEO_ID)
      .gte('created_at', fechaDesde.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Agrupar por día
    const porDia = {};
    
    eventos?.forEach(evento => {
      const fecha = new Date(evento.created_at);
      const dia = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!porDia[dia]) {
        porDia[dia] = { fecha: dia, visitas: 0, cargas: 0, total: 0 };
      }
      
      if (evento.tipo_evento === 'visita') {
        porDia[dia].visitas++;
      } else if (evento.tipo_evento === 'carga_resultado') {
        porDia[dia].cargas++;
      }
      porDia[dia].total++;
    });

    // Convertir a array ordenado
    const timeline = Object.values(porDia).sort((a, b) => 
      a.fecha.localeCompare(b.fecha)
    );

    return {
      ok: true,
      timeline,
      periodo: { diasAtras, fechaDesde }
    };
  } catch (error) {
    console.error('Error obteniendo timeline:', error);
    return { ok: false, error };
  }
}

/**
 * Obtiene ranking de jugadores por actividad
 * @param {Object} supabase - Cliente de Supabase
 * @param {Number} diasAtras - Días hacia atrás (default: 30)
 * @returns {Promise<Object>} Ranking ordenado por actividad
 */
export async function getRankingActividad(supabase, diasAtras = 30) {
  try {
    const fechaDesde = new Date();
    fechaDesde.setDate(fechaDesde.getDate() - diasAtras);

    const { data: eventos, error } = await supabase
      .from('tracking_eventos')
      .select('*')
      .eq('torneo_id', TORNEO_ID)
      .gte('created_at', fechaDesde.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Agrupar por jugador
    const porJugador = {};
    
    eventos?.forEach(evento => {
      const key = evento.jugador_nombre;
      
      if (!porJugador[key]) {
        porJugador[key] = {
          jugador_nombre: evento.jugador_nombre,
          pareja_id: evento.pareja_id,
          pareja_nombre: evento.metadata?.pareja_nombre || '',
          grupo: evento.metadata?.grupo || '',
          visitas: 0,
          cargas: 0,
          total: 0,
          ultima_actividad: evento.created_at
        };
      }
      
      if (evento.tipo_evento === 'visita') {
        porJugador[key].visitas++;
      } else if (evento.tipo_evento === 'carga_resultado') {
        porJugador[key].cargas++;
      }
      porJugador[key].total++;
      
      // Actualizar última actividad si es más reciente
      if (new Date(evento.created_at) > new Date(porJugador[key].ultima_actividad)) {
        porJugador[key].ultima_actividad = evento.created_at;
      }
    });

    // Convertir a array y ordenar por total descendente
    const ranking = Object.values(porJugador).sort((a, b) => b.total - a.total);

    return {
      ok: true,
      ranking,
      periodo: { diasAtras, fechaDesde }
    };
  } catch (error) {
    console.error('Error obteniendo ranking:', error);
    return { ok: false, error };
  }
}

/**
 * Obtiene actividad reciente (feed de eventos)
 * @param {Object} supabase - Cliente de Supabase
 * @param {Number} limite - Cantidad máxima de eventos
 * @returns {Promise<Object>} Lista de eventos recientes
 */
export async function getActividadReciente(supabase, limite = 50) {
  try {
    const { data: eventos, error } = await supabase
      .from('tracking_eventos')
      .select('*')
      .eq('torneo_id', TORNEO_ID)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (error) throw error;

    return {
      ok: true,
      eventos: eventos || []
    };
  } catch (error) {
    console.error('Error obteniendo actividad reciente:', error);
    return { ok: false, error };
  }
}

/**
 * Obtiene estadísticas por pareja
 * @param {Object} supabase - Cliente de Supabase
 * @param {String} parejaId - ID de la pareja
 * @param {Number} diasAtras - Días hacia atrás
 * @returns {Promise<Object>} Estadísticas de la pareja
 */
export async function getStatsPorPareja(supabase, parejaId, diasAtras = 30) {
  try {
    const fechaDesde = new Date();
    fechaDesde.setDate(fechaDesde.getDate() - diasAtras);

    const { data: eventos, error } = await supabase
      .from('tracking_eventos')
      .select('*')
      .eq('torneo_id', TORNEO_ID)
      .eq('pareja_id', parejaId)
      .gte('created_at', fechaDesde.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const visitas = eventos?.filter(e => e.tipo_evento === 'visita') || [];
    const cargas = eventos?.filter(e => e.tipo_evento === 'carga_resultado') || [];
    const jugadores = new Set(eventos?.map(e => e.jugador_nombre) || []);

    return {
      ok: true,
      pareja_id: parejaId,
      periodo: { diasAtras, fechaDesde },
      totales: {
        visitas: visitas.length,
        cargas: cargas.length,
        eventos: eventos?.length || 0
      },
      jugadores: Array.from(jugadores),
      eventos: eventos || []
    };
  } catch (error) {
    console.error('Error obteniendo stats por pareja:', error);
    return { ok: false, error };
  }
}
