/**
 * Entry point para presente.html
 * Página de administración de presentismo
 */

import { logMsg, supabase, initTorneo } from './admin/context.js';
import { initPresentismo } from './viewer/presentismo.js';

import {
  initToggleGlobal,
  initEstadisticas,
  initOperacionesMasivas,
  initControlGranular,
  initAusentes
} from './admin/presentismo/index.js';


console.log('PRESENTE ENTRY CARGADO');

async function initPresente() {
  await initTorneo();
  // Init módulo de presentismo con supabase
  initPresentismo(supabase);

  try {
    logMsg('Inicializando sistema de presentismo...');

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

initPresente();
