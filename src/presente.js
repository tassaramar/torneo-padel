/**
 * Entry point para presente.html
 * Página de administración de presentismo
 */

import { logMsg, supabase, TORNEO_ID } from './admin/context.js';
import { initSafetyLock } from './admin/safetyLock.js';
import { initPresentismo } from './viewer/presentismo.js';

import {
  initToggleGlobal,
  initEstadisticas,
  initOperacionesMasivas,
  initControlGranular,
  initAusentes
} from './admin/presentismo/index.js';

console.log('PRESENTE ENTRY CARGADO');

// Init módulo de presentismo con supabase
initPresentismo(supabase);

// Init safety lock (solo para operaciones masivas)
initSafetyLock();

// Init secciones
async function init() {
  try {
    logMsg('Inicializando sistema de presentismo...');

    // Inicializar cada sección
    await initToggleGlobal();
    await initEstadisticas();
    await initOperacionesMasivas();
    await initControlGranular();
    await initAusentes();

    logMsg('✅ Sistema de presentismo cargado');
  } catch (error) {
    console.error('Error al inicializar presentismo:', error);
    logMsg(`❌ Error al cargar sistema: ${error.message}`);
  }
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
