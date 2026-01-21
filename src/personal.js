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

function startPolling() {
  stopPolling();
  
  // Iniciar polling
  pollingInterval = setInterval(() => {
    console.log('[Polling] Auto-refresh...');
    init();
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

async function init() {
  try {
    setStatus('Cargando…');
    
    const identidad = getIdentidad();
    
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
    await cargarVistaPersonalizada(
      supabase,
      TORNEO_ID,
      identidad,
      cambiarDePareja,
      verVistaGeneral
    );
    
    setStatus(`Actualizado ${nowStr()}`);
  } catch (e) {
    console.error('Error en init:', e);
    setStatus('❌ Error (ver consola)');
    const contentEl = document.getElementById('viewer-content');
    if (contentEl) contentEl.innerHTML = '<p>❌ Error cargando viewer.</p>';
  }
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
      const resultado = await cargarResultado(supabase, partidoId, gamesA, gamesB, identidad);
      
      if (resultado.ok) {
        alert(resultado.mensaje);
        await init();
      } else {
        alert('Error: ' + resultado.mensaje);
      }
    });
  },

  async confirmarResultado(partidoId, gamesA, gamesB) {
    const identidad = getIdentidad();
    if (!identidad) return;

    const resultado = await cargarResultado(supabase, partidoId, gamesA, gamesB, identidad);
    
    if (resultado.ok) {
      alert(resultado.mensaje);
      await init();
    } else {
      alert('Error: ' + resultado.mensaje);
    }
  },

  async cargarResultadoDiferente(partidoId) {
    await this.cargarResultado(partidoId);
  },

  async aceptarOtroResultado(partidoId) {
    const identidad = getIdentidad();
    if (!identidad) return;

    if (!confirm('¿Estás seguro de aceptar el resultado de la otra pareja?')) return;

    const resultado = await aceptarOtroResultado(supabase, partidoId, identidad);
    
    if (resultado.ok) {
      alert(resultado.mensaje);
      await init();
    } else {
      alert('Error: ' + resultado.mensaje);
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
