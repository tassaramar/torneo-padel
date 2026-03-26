import { logMsg, supabase, TORNEO_ID } from './admin/context.js';
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

  // Conectar botón de reset resultados
  const btnResetResultados = document.getElementById('reset-resultados');
  if (btnResetResultados) {
    btnResetResultados.onclick = resetearResultados;
  }
}

injectVersion();
requireAdmin(supabase, { onReady: initAdmin });

/* =========================
   RESET RESULTADOS PRE-TORNEO
========================= */

export async function resetearResultados() {
  const confirmacion = confirm(
    '🧹 LIMPIAR RESULTADOS DE GRUPOS\n\n' +
    'Pone en cero los resultados de todos los partidos de grupo.\n' +
    'Los partidos siguen existiendo, solo se borran los scores.\n\n' +
    '✅ Mantiene: parejas, grupos, partidos, copas\n' +
    '🗑️ Borra: resultados (sets) de partidos de grupo\n\n' +
    '¿Continuar?'
  );

  if (!confirmacion) {
    logMsg('❌ Operación cancelada');
    return;
  }

  logMsg('🧹 Reseteando resultados de partidos...');
  
  // Reset de partidos de GRUPOS
  // NOTA: games_totales_* y sets_* son derivados calculados por trigger,
  // se resetean automáticamente cuando se limpian los sets
  const { error: errorGrupos, count: countGrupos } = await supabase
    .from('partidos')
    .update({ 
      set1_a: null,
      set1_b: null,
      set2_a: null,
      set2_b: null,
      set3_a: null,
      set3_b: null,
      set1_temp_a: null,
      set1_temp_b: null,
      set2_temp_a: null,
      set2_temp_b: null,
      set3_temp_a: null,
      set3_temp_b: null,
      estado: 'pendiente',
      cargado_por_pareja_id: null,
      notas_revision: null,
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

  // Limpiar sorteos
  const { error: errorSorteos } = await supabase
    .from('sorteos')
    .delete()
    .eq('torneo_id', TORNEO_ID);

  if (errorSorteos) {
    console.error(errorSorteos);
    logMsg('⚠️ Error limpiando sorteos (ver consola)');
  } else {
    logMsg('✅ Sorteos limpiados');
  }

  logMsg('');
  logMsg('🎯 Resultados de grupos limpiados');
  logMsg('💡 Todos los partidos de grupo están en estado pendiente');
  
  // Refrescar vistas si existen
  if (window.refreshPartidos) {
    setTimeout(() => window.refreshPartidos(), 500);
  }
}

