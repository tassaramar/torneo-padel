import { logMsg } from './admin/context.js';
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
