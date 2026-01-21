import { logMsg, supabase, TORNEO_ID } from './admin/context.js';
import { initSafetyLock } from './admin/safetyLock.js';

import { initGroups } from './admin/groups/index.js';
import { initCopas } from './admin/copas/index.js';

import * as parejasImport from './admin/parejas/parejasImport.js';
import { initParejasEdit } from './admin/parejas/parejasEdit.js';

console.log('ADMIN ENTRY CARGADO');

window.addEventListener('error', (e) => {
  logMsg(`❌ JS error: ${e?.message || e}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e?.reason;
  logMsg(`❌ Promise: ${r?.message || r || 'error'}`);
});

function safeInit(nombre, fn) {
  try {
    fn();
    logMsg(`✅ Init OK: ${nombre}`);
  } catch (err) {
    console.error(err);
    logMsg(`❌ Init FAIL: ${nombre} -> ${err?.message || err}`);
  }
}

// Click debug: si esto no aparece, el click ni está llegando al JS (o el botón está disabled).
function debugClick(id, label) {
  const btn = document.getElementById(id);
  if (!btn) {
    logMsg(`⚠️ Falta botón #${id}`);
    return;
  }
  btn.addEventListener(
    'click',
    () => logMsg(`🖱️ Click: ${label} (disabled=${btn.disabled})`),
    true
  );
}

safeInit('SafetyLock', initSafetyLock);
safeInit('ParejasImport', () => (parejasImport.initParejasImport ?? parejasImport.initParejas)?.());
safeInit('ParejasEdit', initParejasEdit);
safeInit('Groups', initGroups);
safeInit('Copas', initCopas);

// Debug de clicks clave
debugClick('reset-grupos', 'Reset grupos');
debugClick('gen-grupos', 'Generar grupos');
debugClick('reset-copas', 'Reset copas');
debugClick('gen-copas', 'Generar copas');
debugClick('gen-finales', 'Generar finales');
debugClick('reset-resultados', 'Reset resultados');

/* =========================
   RESET RESULTADOS PRE-TORNEO
========================= */

export async function resetearResultados() {
  const confirmacion = confirm(
    'RESETEAR RESULTADOS\n\n' +
    'Esto va a:\n' +
    '• Borrar todos los resultados de partidos\n' +
    '• Volver todos los partidos a estado "pendiente"\n\n' +
    'MANTIENE:\n' +
    '✅ Parejas\n' +
    '✅ Grupos\n' +
    '✅ Copas\n' +
    '✅ Estructura de partidos\n\n' +
    '¿Continuar?'
  );

  if (!confirmacion) {
    logMsg('❌ Operación cancelada');
    return;
  }

  logMsg('🧹 Reseteando resultados de partidos...');
  
  // Reset de partidos de GRUPOS
  const { error: errorGrupos, count: countGrupos } = await supabase
    .from('partidos')
    .update({ 
      games_a: null, 
      games_b: null,
      estado: 'pendiente',
      updated_at: new Date().toISOString()
    })
    .eq('torneo_id', TORNEO_ID)
    .is('copa_id', null)
    .select('id', { count: 'exact', head: false });

  if (errorGrupos) {
    console.error(errorGrupos);
    logMsg('❌ Error reseteando partidos de grupos (ver consola)');
    return;
  }

  logMsg(`✅ Partidos de grupos reseteados: ${countGrupos || 0}`);

  // Reset de partidos de COPAS
  const { error: errorCopas, count: countCopas } = await supabase
    .from('partidos')
    .update({ 
      games_a: null, 
      games_b: null,
      estado: 'pendiente',
      updated_at: new Date().toISOString()
    })
    .eq('torneo_id', TORNEO_ID)
    .not('copa_id', 'is', null)
    .select('id', { count: 'exact', head: false });

  if (errorCopas) {
    console.error(errorCopas);
    logMsg('❌ Error reseteando partidos de copas (ver consola)');
    return;
  }

  logMsg(`✅ Partidos de copas reseteados: ${countCopas || 0}`);

  // Limpiar posiciones manuales (opcional pero recomendado)
  const { error: errorPos, count: countPos } = await supabase
    .from('posiciones_manual')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .select('id', { count: 'exact', head: false });

  if (errorPos) {
    console.error(errorPos);
    logMsg('⚠️ Error limpiando posiciones manuales (ver consola)');
  } else {
    logMsg(`✅ Posiciones manuales limpiadas: ${countPos || 0}`);
  }

  logMsg('');
  logMsg('🎯 Sistema listo para el torneo');
  logMsg('💡 Todos los partidos están en estado pendiente');
  
  // Refrescar vistas si existen
  if (window.refreshPartidos) {
    setTimeout(() => window.refreshPartidos(), 500);
  }
}

// Conectar botón de reset resultados
const btnResetResultados = document.getElementById('reset-resultados');
if (btnResetResultados) {
  btnResetResultados.onclick = resetearResultados;
}
