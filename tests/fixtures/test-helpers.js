import { test, expect } from '@playwright/test';
import datosE2E from './datos-torneo.json' assert { type: 'json' };

/**
 * Helpers para tests E2E
 * Proveen funciones reutilizables para configuración y validación de tests
 */

/**
 * Genera el texto para importar parejas en formato TSV
 * @returns {string} Texto formato "Pareja\tGrupo" para pegar en admin
 */
export function generarTextoImportParejas() {
  return datosE2E.parejas
    .map(p => `${p.nombre}\t${p.grupo}`)
    .join('\n');
}

/**
 * Helper: Identificarse como jugador específico
 * @param {Page} page - Playwright page object
 * @param {string} nombreJugador - Nombre del jugador a buscar (ej: "Tincho")
 * @param {string} nombrePareja - Nombre completo de la pareja esperada (ej: "Tincho - Max")
 */
export async function identificarseComoJugador(page, nombreJugador, nombrePareja) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.waitForLoadState('networkidle');

  // Buscar jugador
  const searchInput = page.locator('input[type="search"]').first();
  await searchInput.fill(nombreJugador);
  await page.waitForTimeout(1000);

  // Seleccionar resultado
  await page.locator('.result-item').first().click();
  await page.waitForTimeout(1000);

  // Confirmar identidad
  await page.locator('.option-btn[data-correcto="true"]').first().click();
  await page.waitForTimeout(2000);

  // Verificar identidad guardada
  const identidad = await page.evaluate(() => {
    const data = localStorage.getItem('torneo_identidad');
    return data ? JSON.parse(data) : null;
  });

  expect(identidad).not.toBeNull();
  expect(identidad.parejaNombre).toContain(nombrePareja);

  // Navegar al Home (hacer clic en "Continuar" si está visible)
  const botonContinuar = page.getByText(/continuar/i);
  const continuarVisible = await botonContinuar.isVisible({ timeout: 5000 })
    .catch(() => false);

  if (continuarVisible) {
    await botonContinuar.click();
    await page.waitForTimeout(1500);
  }

  // Esperar a que el Home se renderice
  await page.waitForSelector('.home-shell', { timeout: 10000 });
  await page.waitForTimeout(1000);

  return identidad;
}

/**
 * Helper: Cargar resultado de partido
 * @param {Page} page - Playwright page object
 * @param {Object} sets - Objeto con set1_a, set1_b, set2_a, set2_b, etc.
 */
export async function cargarResultado(page, sets) {
  // Asumimos que ya estamos en la pantalla de carga
  for (const [key, value] of Object.entries(sets)) {
    const input = page.locator(`[name="${key}"]`);
    await input.fill(String(value));
  }

  await page.click('button:has-text("Guardar")');
  await page.waitForTimeout(1000);
}

/**
 * Helper: Abrir modal "Tablas / Grupos"
 * @param {Page} page - Playwright page object
 */
export async function abrirModalTablas(page) {
  const botonModal = page.locator('#btn-abrir-modal');
  await expect(botonModal).toBeVisible({ timeout: 10000 });
  await botonModal.click();
  await page.waitForTimeout(1500);

  const modal = page.locator('#modal-consulta, [class*="modal"]').first();
  await expect(modal).toBeVisible({ timeout: 5000 });
}

/**
 * Helper: Navegar a tab del modal
 * @param {Page} page - Playwright page object
 * @param {string} tabName - Nombre del tab ("Mi grupo", "Otros grupos", "Fixture")
 */
export async function navegarATab(page, tabName) {
  const tab = page.getByText(new RegExp(tabName, 'i')).first();
  await tab.click();
  await page.waitForTimeout(800);
}

/**
 * Helper: Leer tabla de posiciones
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>} Array de objetos con datos de cada fila
 */
export async function leerTablaPosiciones(page) {
  const tabla = [];
  const filas = page.locator('table tbody tr');
  const count = await filas.count();

  for (let i = 0; i < count; i++) {
    const fila = filas.nth(i);
    const celdas = fila.locator('td');
    const countCeldas = await celdas.count();

    if (countCeldas === 0) continue;

    const filaData = {};
    for (let j = 0; j < countCeldas; j++) {
      const texto = await celdas.nth(j).textContent();
      filaData[`col${j}`] = texto.trim();
    }

    tabla.push(filaData);
  }

  return tabla;
}

/**
 * Obtener datos de test por pareja ID
 * @param {string} parejaId - ID de pareja (ej: "A1", "B2")
 * @returns {Object} Datos de la pareja
 */
export function getParejaData(parejaId) {
  return datosE2E.parejas.find(p => p.id === parejaId);
}

/**
 * Obtener datos de test por partido número
 * @param {number} numeroPartido - Número del partido (1-12)
 * @returns {Object} Datos del partido
 */
export function getPartidoData(numeroPartido) {
  return datosE2E.partidos.find(p => p.numero === numeroPartido);
}

/**
 * Obtener tabla esperada de un grupo
 * @param {string} grupo - Letra del grupo ("A" o "B")
 * @returns {Array} Array con tabla esperada
 */
export function getTablaEsperada(grupo) {
  const key = `grupo${grupo}`;
  return datosE2E.tablaEsperada[key] || [];
}

/**
 * Validar que tabla de posiciones coincide con esperada
 * @param {Page} page - Playwright page object
 * @param {string} grupo - Letra del grupo ("A" o "B")
 */
export async function validarTablaPosiciones(page, grupo) {
  const tablaEsperada = getTablaEsperada(grupo);

  for (let i = 0; i < tablaEsperada.length; i++) {
    const esperado = tablaEsperada[i];
    const fila = page.locator('table tbody tr').nth(i);

    // Verificar nombre de pareja
    await expect(fila).toContainText(esperado.nombre);

    // Verificar puntos
    await expect(fila).toContainText(String(esperado.P));

    // Verificar DS (puede ser +2, -3, 0)
    const dsTexto = esperado.DS >= 0 ? `+${esperado.DS}` : String(esperado.DS);
    await expect(fila).toContainText(dsTexto);

    // Verificar DG
    const dgTexto = esperado.DG >= 0 ? `+${esperado.DG}` : String(esperado.DG);
    await expect(fila).toContainText(dgTexto);

    // Verificar GF
    await expect(fila).toContainText(String(esperado.GF));
  }
}

/**
 * Helper: Esperar a que el estado del partido cambie
 * @param {Page} page - Playwright page object
 * @param {number} numeroPartido - Número del partido
 * @param {string} estadoEsperado - Estado esperado ("confirmado", "a_confirmar", "en_revision")
 * @param {number} timeout - Timeout en ms (default: 5000)
 */
export async function esperarEstadoPartido(page, numeroPartido, estadoEsperado, timeout = 5000) {
  const partidoLocator = page.locator(`[data-partido-num="${numeroPartido}"], #partido-${numeroPartido}`).first();
  const estadoLocator = partidoLocator.locator('.estado, .estado-badge').first();

  const estadoTexto = {
    'confirmado': /confirmado|✅/i,
    'a_confirmar': /por confirmar|⏳|a confirmar/i,
    'en_revision': /disputa|en revisión|⚠️/i,
    'pendiente': /pendiente/i
  };

  await expect(estadoLocator).toContainText(estadoTexto[estadoEsperado] || estadoEsperado, { timeout });
}

export default {
  generarTextoImportParejas,
  identificarseComoJugador,
  cargarResultado,
  abrirModalTablas,
  navegarATab,
  leerTablaPosiciones,
  getParejaData,
  getPartidoData,
  getTablaEsperada,
  validarTablaPosiciones,
  esperarEstadoPartido
};
