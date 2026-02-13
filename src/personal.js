import { createClient } from '@supabase/supabase-js';
import { getIdentidad, clearIdentidad } from './identificacion/identidad.js';
import { iniciarIdentificacion } from './identificacion/ui.js';
import { cargarVistaPersonalizada } from './viewer/vistaPersonal.js';
import {
  cargarResultado,
  aceptarOtroResultado,
  mostrarModalCargarResultado
} from './viewer/cargarResultado.js';
import { initModal, abrirModal, cerrarModal, invalidarCache } from './viewer/modalConsulta.js';
import { showToast } from './utils/toast.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const statusEl = document.getElementById('home-status');

// Polling automático
let pollingInterval = null;
const POLLING_INTERVAL_MS = 30000; // 30 segundos

// Tracking de partidos para detectar cambios
let partidosAnteriores = null;

function startPolling() {
  stopPolling();
  
  // Iniciar polling
  pollingInterval = setInterval(() => {
    console.log('[Polling] Auto-refresh...');
    init(false); // false = no mostrar skeleton en refresh automático
  }, POLLING_INTERVAL_MS);
  
  // Pausar polling cuando tab no está visible (ahorro de recursos)
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    console.log('[Polling] Tab oculto - pausando polling');
    stopPolling();
  } else {
    console.log('[Polling] Tab visible - reiniciando polling');
    startPolling();
  }
}

function setStatus(txt) {
  if (statusEl) statusEl.textContent = txt;
}

function nowStr() {
  const d = new Date();
  return d.toLocaleTimeString();
}

function cambiarDePareja() {
  clearIdentidad();
  location.reload();
}

// Event listeners para Home Único
window.addEventListener('homeRefresh', () => {
  init(false); // Recargar sin skeleton
});

window.addEventListener('abrirModalConsulta', () => {
  abrirModal('mi-grupo');
});

/**
 * Agrega el grupo inferido a parejas que no lo tienen (fallback por orden)
 * Si la pareja ya tiene grupo de la BD, lo mantiene
 */
function agregarGrupoAParejasFallback(parejas, grupos) {
  if (!grupos.length || !parejas.length) {
    return parejas.map(p => ({ ...p, grupo: p.grupo || '?' }));
  }
  
  const n = grupos.length;
  const per = parejas.length / n;
  const orderedGroups = [...grupos].map(g => g.nombre).sort();
  
  return parejas.map((p, idx) => {
    // Si ya tiene grupo de la BD, mantenerlo
    if (p.grupo) {
      return p;
    }
    
    // Fallback: inferir por orden si el número de parejas es divisible
    if (Number.isInteger(per)) {
      const grupoIdx = Math.floor(idx / per);
      const grupo = orderedGroups[grupoIdx] || '?';
      return { ...p, grupo };
    }
    
    // Si no es divisible, devolver '?'
    return { ...p, grupo: '?' };
  });
}

/**
 * Muestra skeleton loading mientras carga
 */
function mostrarSkeletonLoading() {
  const contentEl = document.getElementById('home-content');
  if (!contentEl) return;
  
  contentEl.innerHTML = `
    <div class="home-skeleton">
      <div class="skeleton skeleton-quien-soy"></div>
      <div class="skeleton skeleton-partidos"></div>
      <div class="skeleton-dashboard">
        <div class="skeleton skeleton-dash-card"></div>
        <div class="skeleton skeleton-dash-card"></div>
        <div class="skeleton skeleton-dash-card"></div>
      </div>
      <div class="skeleton skeleton-consulta"></div>
    </div>
  `;
}

async function init(mostrarSkeleton = true) {
  try {
    const identidad = getIdentidad();
    
    // Mostrar skeleton solo en carga inicial, no en auto-refresh
    if (identidad && mostrarSkeleton) {
      mostrarSkeletonLoading();
    } else if (!identidad) {
      setStatus('Cargando…');
    }
    
    if (!identidad) {
      // No está identificado, cargar parejas con su grupo (usando JOIN)
      const { data: parejas, error: errParejas } = await supabase
        .from('parejas')
        .select('id, nombre, orden, grupo_id, grupos ( id, nombre )')
        .eq('torneo_id', TORNEO_ID)
        .order('orden');
      
      if (errParejas) {
        console.error('Error cargando parejas:', errParejas);
        setStatus('❌ Error cargando datos');
        return;
      }
      
      // Cargar grupos como fallback si las parejas no tienen grupo_id
      const { data: grupos, error: errGrupos } = await supabase
        .from('grupos')
        .select('id, nombre')
        .eq('torneo_id', TORNEO_ID)
        .order('nombre');
      
      if (errGrupos) {
        console.error('Error cargando grupos:', errGrupos);
        setStatus('❌ Error cargando datos');
        return;
      }
      
      // Usar grupo de la BD si existe, sino inferir por orden
      const parejasConGrupo = parejas.map(p => ({
        ...p,
        grupo: p.grupos?.nombre || null
      }));
      
      // Fallback: inferir grupo por orden si no tiene grupo_id
      const parejasFinales = agregarGrupoAParejasFallback(parejasConGrupo, grupos);
      
      // Mostrar flujo de identificación en el contenedor del home
      iniciarIdentificacion(
        parejasFinales,
        async (identidadCompleta) => {
          console.log('Identificación completa:', identidadCompleta);
          // Inicializar modal con la identidad
          initModal(supabase, TORNEO_ID, identidadCompleta);
          // Recargar vista con la identidad guardada
          await init();
          startPolling();
        },
        'home-content',
        supabase // Pasar supabase para tracking automático
      );
      
      setStatus('');
      return;
    }
    
    // Usuario identificado, inicializar modal de consulta
    initModal(supabase, TORNEO_ID, identidad);
    
    // Cargar vista personalizada (Home Único)
    const resultado = await cargarVistaPersonalizada(
      supabase,
      TORNEO_ID,
      identidad,
      cambiarDePareja,
      () => {} // onVerTodos ya no navega, ahora abre modal
    );
    
    // Si la pareja no existe, limpiar identidad y pedir reidentificación
    if (!resultado.ok && resultado.error?.code === 'PAREJA_NO_ENCONTRADA') {
      console.warn('Pareja guardada ya no existe, limpiando identidad y pidiendo reidentificación');
      clearIdentidad();
      // Recargar para mostrar flujo de identificación
      await init();
      return;
    }
    
    // Si hay error de red u otro error, mostrar mensaje
    if (!resultado.ok) {
      const errorMsg = resultado.error?.message || 'Error desconocido';
      console.error('Error cargando vista personalizada:', resultado.error);
      setStatus(`⚠️ Error: ${errorMsg.includes('Failed to fetch') || errorMsg.includes('timeout') ? 'Problema de conexión. Reintentando...' : errorMsg}`);
      // No retornar, dejar que continúe para que el polling pueda reintentar
    }
    
    // Detectar y destacar cambios después del polling
    if (partidosAnteriores && resultado.ok) {
      detectarYDestacarCambios(partidosAnteriores, resultado.partidos);
    }
    
    // Guardar estado actual para próxima comparación
    if (resultado.ok) {
      partidosAnteriores = resultado.partidos;
      setStatus(`Actualizado ${nowStr()}`);
      // Invalidar cache del modal para que se recargue
      invalidarCache();
    }
  } catch (e) {
    console.error('Error en init:', e);
    setStatus('❌ Error (ver consola)');
    const contentEl = document.getElementById('home-content');
    if (contentEl) contentEl.innerHTML = '<p>❌ Error cargando.</p>';
  }
}

/**
 * Anima la salida de una tarjeta de partido con efecto de éxito
 * @param {string} partidoId - ID del partido a animar
 * @returns {Promise} Promise que se resuelve cuando termina la animación
 */
function animarPartidoSalida(partidoId) {
  return new Promise((resolve) => {
    const tarjeta = document.querySelector(`[data-partido-id="${partidoId}"]`);

    if (!tarjeta) {
      // Si no encuentra la tarjeta, continuar sin animación
      resolve();
      return;
    }

    // Agregar clase de animación
    tarjeta.classList.add('partido-moving');

    // Crear y agregar mensaje flotante
    const mensaje = document.createElement('div');
    mensaje.className = 'moving-message';
    mensaje.textContent = '¡Movido a partidos jugados! 🎾';
    tarjeta.appendChild(mensaje);

    // Resolver después de que termine la animación (600ms)
    setTimeout(() => {
      resolve();
    }, 600);
  });
}

/**
 * Revierte la animación de salida de un partido (para rollback)
 */
function revertirAnimacionPartido(partidoId) {
  const tarjeta = document.querySelector(`[data-partido-id="${partidoId}"]`);

  if (!tarjeta) return;

  // Remover clase de animación
  tarjeta.classList.remove('partido-moving');

  // Remover mensaje flotante si existe
  const mensaje = tarjeta.querySelector('.moving-message');
  if (mensaje) {
    mensaje.remove();
  }
}

/**
 * Detecta cambios entre dos estados de partidos y destaca visualmente
 */
function detectarYDestacarCambios(partidosAnteriores, partidosNuevos) {
  // Crear mapas de partidos por ID para comparación fácil
  const mapaAnterior = new Map();
  
  // Aplanar categorías anteriores
  ['enRevision', 'porConfirmar', 'porCargar', 'confirmados'].forEach(cat => {
    (partidosAnteriores[cat] || []).forEach(p => {
      mapaAnterior.set(p.id, { estado: p.estado, updated_at: p.updated_at });
    });
  });
  
  const partidosCambiados = [];
  
  // Detectar cambios en nuevos partidos
  ['enRevision', 'porConfirmar', 'porCargar', 'confirmados'].forEach(cat => {
    (partidosNuevos[cat] || []).forEach(p => {
      const anterior = mapaAnterior.get(p.id);
      
      // Es nuevo o cambió de estado/updated_at
      if (!anterior || anterior.estado !== p.estado || anterior.updated_at !== p.updated_at) {
        partidosCambiados.push(p.id);
      }
    });
  });
  
  // Aplicar animación de destaque a partidos cambiados
  setTimeout(() => {
    partidosCambiados.forEach(partidoId => {
      const tarjeta = document.querySelector(`[data-partido-id="${partidoId}"]`);
      if (tarjeta) {
        tarjeta.classList.add('partido-actualizado');
        
        // Remover clase después de la animación
        setTimeout(() => {
          tarjeta.classList.remove('partido-actualizado');
        }, 2000);
      }
    });
  }, 100);
}

/**
 * Muestra un toast de error temporal
 * @param {string} mensaje - Mensaje de error a mostrar
 */
function mostrarToastError(mensaje) {
  // Crear toast
  const toast = document.createElement('div');
  toast.className = 'toast-error';
  toast.textContent = mensaje;
  
  // Agregar al body
  document.body.appendChild(toast);
  
  // Animar entrada
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remover después de 4 segundos
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Exponer funciones globales para onclick en HTML
window.app = {
  async cargarResultado(partidoId) {
    const identidad = getIdentidad();
    if (!identidad) return;

    // Buscar partido
    const { data: partido } = await supabase
      .from('partidos')
      .select(`
        id, estado,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        set1_temp_a, set1_temp_b, set2_temp_a, set2_temp_b, set3_temp_a, set3_temp_b,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
        copa_id,
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre, presentes ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre, presentes )
      `)
      .eq('id', partidoId)
      .single();

    if (!partido) return;

    // Verificar presentismo antes de abrir el modal
    const { data: torneo } = await supabase
      .from('torneos')
      .select('presentismo_activo')
      .eq('id', TORNEO_ID)
      .single();

    const presentismoActivo = torneo?.presentismo_activo ?? true;

    if (presentismoActivo) {
      const miPareja = partido.pareja_a?.id === identidad.parejaId ? partido.pareja_a : partido.pareja_b;
      const presentes = miPareja?.presentes || [];
      const ausentes = [identidad.miNombre, identidad.companero].filter(n => !presentes.includes(n));

      if (ausentes.length > 0) {
        const nombres = ausentes.join(' y ');
        const msg = ausentes.length === 2
          ? `🎾 ¡Ey! Ni vos ni ${identidad.companero} dieron el presente todavía.\n\nSi cargás el resultado, los marcamos como presentes automáticamente. ¿Dale?`
          : `🎾 ¡Ey! ${ausentes[0]} no dio el presente todavía.\n\nSi cargás el resultado, lo marcamos como presente automáticamente. ¿Dale?`;

        if (!confirm(msg)) return;

        // Auto-marcar ausentes como presentes
        const nuevosPresentes = [...new Set([...presentes, ...ausentes])];
        await supabase
          .from('parejas')
          .update({ presentes: nuevosPresentes })
          .eq('id', miPareja.id);
      }
    }

    mostrarModalCargarResultado(partido, identidad, async (setsOrGamesA, gamesBOrNumSets) => {
      // OPTIMISTIC UI: Animar salida de la tarjeta
      await animarPartidoSalida(partidoId);

      let resultado;
      // Detectar si es modo sets (objeto) o modo legacy (números)
      if (typeof setsOrGamesA === 'object' && setsOrGamesA.set1) {
        // Modo sets
        const { cargarResultadoConSets } = await import('./viewer/cargarResultado.js');
        resultado = await cargarResultadoConSets(supabase, partidoId, setsOrGamesA, gamesBOrNumSets, identidad);
      } else {
        // Modo legacy (games)
        resultado = await cargarResultado(supabase, partidoId, setsOrGamesA, gamesBOrNumSets, identidad);
      }

      if (resultado.ok) {
        // Success: Refresh para garantizar consistencia
        await init();
      } else {
        // ROLLBACK: Revert + Notify + Refresh
        revertirAnimacionPartido(partidoId);
        showToast(resultado.mensaje || 'Error al cargar resultado', 'error');
        await init(); // ← Garantizar consistencia
      }
    });
  },

  async confirmarResultado(partidoId, gamesA, gamesB) {
    // Versión legacy - mantiene compatibilidad
    const identidad = getIdentidad();
    if (!identidad) return;

    // Animar salida de la tarjeta
    await animarPartidoSalida(partidoId);

    const resultado = await cargarResultado(supabase, partidoId, gamesA, gamesB, identidad);
    
    if (resultado.ok) {
      // Animación ya mostró el éxito, solo recargar
      await init();
    } else {
      mostrarToastError(resultado.mensaje);
    }
  },

  async confirmarResultadoConSets(partidoId) {
    // Nueva versión que confirma usando los sets ya cargados
    const identidad = getIdentidad();
    if (!identidad) return;

    // Obtener el partido para usar sus sets
    const { data: partido, error } = await supabase
      .from('partidos')
      .select('*')
      .eq('id', partidoId)
      .single();

    if (error || !partido) {
      mostrarToastError('Error al obtener el partido');
      return;
    }

    // Animar salida de la tarjeta
    await animarPartidoSalida(partidoId);

    // Si tiene sets, confirmar con sets
    if (partido.set1_a !== null && partido.set1_b !== null) {
      // Los sets en DB están en perspectiva absoluta (A/B).
      // cargarResultadoConSets() espera sets en perspectiva del jugador
      // (setA = "mis puntos", setB = "puntos rival") y los rota internamente.
      // Hay que pasar los sets desde la perspectiva del que confirma.
      const soyA = partido.pareja_a_id === identidad.parejaId;
      const sets = {
        set1: { setA: soyA ? partido.set1_a : partido.set1_b, setB: soyA ? partido.set1_b : partido.set1_a },
        set2: { setA: soyA ? partido.set2_a : partido.set2_b, setB: soyA ? partido.set2_b : partido.set2_a }
      };
      if (partido.set3_a !== null && partido.set3_b !== null) {
        sets.set3 = { setA: soyA ? partido.set3_a : partido.set3_b, setB: soyA ? partido.set3_b : partido.set3_a };
      }

      const { cargarResultadoConSets } = await import('./viewer/cargarResultado.js');
      const resultado = await cargarResultadoConSets(supabase, partidoId, sets, partido.num_sets || 3, identidad);

      if (resultado.ok) {
        await init();
      } else {
        mostrarToastError(resultado.mensaje);
      }
    } else {
      mostrarToastError('No hay resultado cargado para confirmar.');
    }
  },

  async cargarResultadoDiferente(partidoId) {
    await this.cargarResultado(partidoId);
  },

  async aceptarOtroResultado(partidoId) {
    const identidad = getIdentidad();
    if (!identidad) return;

    if (!confirm('¿Estás seguro de aceptar el resultado de la otra pareja?')) return;

    // OPTIMISTIC UI: Animar salida de la tarjeta
    await animarPartidoSalida(partidoId);

    const resultado = await aceptarOtroResultado(supabase, partidoId, identidad);

    if (resultado.ok) {
      // Success: Refresh para garantizar consistencia
      await init();
    } else {
      // ROLLBACK: Revert + Notify + Refresh
      revertirAnimacionPartido(partidoId);
      showToast(resultado.mensaje || 'Error al aceptar resultado', 'error');
      await init(); // ← Garantizar consistencia
    }
  },

  async recargarResultado(partidoId) {
    await this.cargarResultado(partidoId);
  }
};

// Inicializar al cargar la página
checkIdentidadYCargar();

async function checkIdentidadYCargar() {
  const identidad = getIdentidad();
  
  if (identidad) {
    // Ya está identificado, cargar vista personalizada
    console.log('Usuario identificado:', identidad.parejaNombre);
    await init();
    startPolling(); // Iniciar auto-refresh
  } else {
    // No está identificado, init() mostrará el flujo
    console.log('Usuario no identificado, iniciando flujo de identificación...');
    await init();
    // NO iniciar polling hasta que se identifique
  }
}
