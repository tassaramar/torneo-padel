import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { getIdentidad, clearIdentidad } from './identificacion/identidad.js';
import { iniciarIdentificacion } from './identificacion/ui.js';
import { cargarVistaPersonalizada } from './viewer/vistaPersonal.js';
import { 
  cargarResultado, 
  aceptarOtroResultado,
  mostrarModalCargarResultado 
} from './viewer/cargarResultado.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const statusEl = document.getElementById('viewer-status');

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

function verVistaGeneral() {
  window.location.href = '/general';
}

function cambiarDePareja() {
  clearIdentidad();
  location.reload();
}

/**
 * Agrega el grupo inferido a cada pareja (basado en bloques por orden)
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
 * Muestra skeleton loading mientras carga
 */
function mostrarSkeletonLoading() {
  const contentEl = document.getElementById('viewer-content');
  if (!contentEl) return;
  
  contentEl.innerHTML = `
    <div class="vista-personal">
      <div class="skeleton skeleton-header"></div>
      <div class="skeleton-dashboard">
        <div class="skeleton skeleton-stat-card"></div>
        <div class="skeleton skeleton-stat-card"></div>
        <div class="skeleton skeleton-stat-card"></div>
      </div>
      <div class="skeleton skeleton-partido"></div>
      <div class="skeleton skeleton-partido"></div>
      <div class="skeleton skeleton-partido"></div>
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
      // No está identificado, cargar parejas y mostrar flujo de identificación
      const { data: parejas, error: errParejas } = await supabase
        .from('parejas')
        .select('id, nombre, orden')
        .eq('torneo_id', TORNEO_ID)
        .order('orden');
      
      if (errParejas) {
        console.error('Error cargando parejas:', errParejas);
        setStatus('❌ Error cargando datos');
        return;
      }
      
      // Cargar grupos para inferir a qué grupo pertenece cada pareja
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
      
      const parejasConGrupo = agregarGrupoAParejas(parejas, grupos);
      
      // Mostrar flujo de identificación
      iniciarIdentificacion(
        parejasConGrupo,
        async (identidadCompleta) => {
          console.log('Identificación completa:', identidadCompleta);
          // Recargar vista con la identidad guardada
          await init();
          startPolling();
        },
        'viewer-content',
        supabase // Pasar supabase para tracking automático
      );
      
      setStatus('');
      return;
    }
    
    // Usuario identificado, cargar vista personalizada
    const resultado = await cargarVistaPersonalizada(
      supabase,
      TORNEO_ID,
      identidad,
      cambiarDePareja,
      verVistaGeneral
    );
    
    // Detectar y destacar cambios después del polling
    if (partidosAnteriores && resultado.ok) {
      detectarYDestacarCambios(partidosAnteriores, resultado.partidos);
    }
    
    // Guardar estado actual para próxima comparación
    if (resultado.ok) {
      partidosAnteriores = resultado.partidos;
    }
    
    setStatus(`Actualizado ${nowStr()}`);
  } catch (e) {
    console.error('Error en init:', e);
    setStatus('❌ Error (ver consola)');
    const contentEl = document.getElementById('viewer-content');
    if (contentEl) contentEl.innerHTML = '<p>❌ Error cargando viewer.</p>';
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
        id, games_a, games_b, estado,
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('id', partidoId)
      .single();

    if (!partido) return;

    mostrarModalCargarResultado(partido, identidad, async (gamesA, gamesB) => {
      // Animar salida de la tarjeta
      await animarPartidoSalida(partidoId);
      
      const resultado = await cargarResultado(supabase, partidoId, gamesA, gamesB, identidad);
      
      if (resultado.ok) {
        // Animación ya mostró el éxito, solo recargar
        await init();
      } else {
        mostrarToastError(resultado.mensaje);
      }
    });
  },

  async confirmarResultado(partidoId, gamesA, gamesB) {
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

  async cargarResultadoDiferente(partidoId) {
    await this.cargarResultado(partidoId);
  },

  async aceptarOtroResultado(partidoId) {
    const identidad = getIdentidad();
    if (!identidad) return;

    if (!confirm('¿Estás seguro de aceptar el resultado de la otra pareja?')) return;

    // Animar salida de la tarjeta
    await animarPartidoSalida(partidoId);

    const resultado = await aceptarOtroResultado(supabase, partidoId, identidad);
    
    if (resultado.ok) {
      // Animación ya mostró el éxito, solo recargar
      await init();
    } else {
      mostrarToastError(resultado.mensaje);
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
