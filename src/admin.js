import { logMsg, supabase, TORNEO_ID, initTorneo } from './admin/context.js';
import { resetResultadosGrupos, resetParejas } from './utils/resetTorneo.js';
import { injectVersion } from './utils/version.js';

import { initGroups } from './admin/groups/index.js';
import { initCopas } from './admin/copas/index.js';

import * as parejasImport from './admin/parejas/parejasImport.js';
import { initParejasEdit } from './admin/parejas/parejasEdit.js';
import { requireAdmin } from './auth/adminGuard.js';

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

async function initPinAyudante() {
  const input = document.getElementById('pin-ayudante-input');
  const btnSave = document.getElementById('pin-ayudante-save');
  const statusEl = document.getElementById('pin-ayudante-status');
  if (!input || !btnSave) return;

  // Cargar PIN actual
  const { data } = await supabase
    .from('torneos')
    .select('pin_ayudante')
    .eq('id', TORNEO_ID)
    .single();

  input.value = data?.pin_ayudante || '';
  if (data?.pin_ayudante) {
    statusEl.textContent = 'PIN activo';
  }

  btnSave.addEventListener('click', async () => {
    const pin = input.value.trim();
    const { error } = await supabase
      .from('torneos')
      .update({ pin_ayudante: pin || null })
      .eq('id', TORNEO_ID);

    if (error) {
      console.error(error);
      logMsg('❌ Error guardando PIN de ayudante');
    } else {
      statusEl.textContent = pin ? 'PIN guardado' : 'PIN desactivado';
      logMsg(pin ? '✅ PIN de ayudante actualizado' : '✅ PIN de ayudante desactivado');
    }
  });
}

async function initFormatoSets() {
  const sel = document.getElementById('formato-sets-select');
  if (!sel) return;

  // Cargar valor actual
  const { data } = await supabase
    .from('torneos')
    .select('formato_sets')
    .eq('id', TORNEO_ID)
    .single();

  sel.value = String(data?.formato_sets ?? 1);

  sel.addEventListener('change', async () => {
    const valor = parseInt(sel.value);
    const { error } = await supabase
      .from('torneos')
      .update({ formato_sets: valor })
      .eq('id', TORNEO_ID);

    if (error) {
      console.error(error);
      logMsg('❌ Error guardando formato de sets');
    } else {
      logMsg(`✅ Formato actualizado: ${valor === 1 ? '1 Set' : 'Al mejor de 3 sets'}`);
    }
  });
}

function initAdmin() {
  safeInit('ParejasImport', () => (parejasImport.initParejasImport ?? parejasImport.initParejas)?.());
  safeInit('ParejasEdit', initParejasEdit);
  safeInit('Groups', initGroups);
  safeInit('Copas', initCopas);
  safeInit('FormatoSets', initFormatoSets);
  safeInit('PinAyudante', initPinAyudante);

  // Conectar botones de reset
  const btnResetResultados = document.getElementById('reset-resultados');
  if (btnResetResultados) {
    btnResetResultados.onclick = resetearResultados;
  }

  const btnResetTorneo = document.getElementById('reset-torneo');
  if (btnResetTorneo) {
    btnResetTorneo.onclick = resetearTorneoCompleto;
  }
}

injectVersion();
requireAdmin(supabase, { onReady: async () => {
  await initTorneo();
  initAdmin();
}});

/* =========================
   RESET RESULTADOS PRE-TORNEO
========================= */

export async function resetearResultados() {
  const confirmacion = confirm(
    '🧹 LIMPIAR RESULTADOS\n\n' +
    'Se va a borrar:\n' +
    '  • Resultados de todos los partidos de grupo\n' +
    '  • Copas: partidos, copas y propuestas\n' +
    '  • Sorteos (intra-grupo e inter-grupo)\n' +
    '  • Posiciones manuales\n\n' +
    'Se mantiene:\n' +
    '  • Parejas y grupos\n' +
    '  • Partidos de grupo (fixture)\n' +
    '  • Plan de copas (esquemas)\n\n' +
    'Todos los partidos vuelven a estado pendiente.\n' +
    '¿Continuar?'
  );

  if (!confirmacion) {
    logMsg('❌ Operación cancelada');
    return;
  }

  const result = await resetResultadosGrupos(supabase, TORNEO_ID, logMsg);

  if (result.ok) {
    logMsg('🎯 Resultados limpiados — todos los partidos en pendiente');
  }
}

export async function resetearTorneoCompleto() {
  const confirmacion = confirm(
    '🔥 RESET COMPLETO DEL TORNEO\n\n' +
    'Se va a borrar TODO:\n' +
    '  • Parejas y grupos\n' +
    '  • Partidos (grupo y copa)\n' +
    '  • Copas, propuestas y plan (esquemas)\n' +
    '  • Sorteos y posiciones manuales\n\n' +
    'El torneo queda vacio, listo para importar parejas.\n' +
    '¿Continuar?'
  );

  if (!confirmacion) {
    logMsg('❌ Operación cancelada');
    return;
  }

  const result = await resetParejas(supabase, TORNEO_ID, logMsg);

  if (result.ok) {
    logMsg('🎯 Torneo reseteado — importa parejas para volver a configurar');
  }
}

