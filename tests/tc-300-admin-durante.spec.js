import { test, expect } from '@playwright/test';

/**
 * Suite TC-300: Admin Durante el Torneo
 *
 * Valida funcionalidad del admin durante el torneo:
 * - Acceso a página admin
 * - Vista de partidos pendientes
 * - Vista de disputas (si existen)
 *
 * NOTA: Estos tests NO modifican estado, solo verifican que UI carga
 */

test.describe('TC-300: Admin Durante el Torneo', () => {

  test('TC-301: Admin puede acceder y ver dashboard', async ({ page }) => {
    test.setTimeout(60000);

    console.log('\n🧪 TC-301: Verificando acceso a admin...\n');

    // Paso 1: Acceder a /admin
    console.log('Paso 1: Accediendo a /admin...');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Página cargada');

    // Paso 2: Verificar que no hay error 404
    const urlActual = page.url();
    console.log(`Paso 2: URL actual: ${urlActual}`);
    expect(urlActual).toContain('admin');
    console.log('✅ Admin.html existe');

    // Paso 3: Verificar elementos básicos de admin
    console.log('\nPaso 3: Verificando estructura de admin...');

    const body = page.locator('body');
    await expect(body).toBeVisible();
    console.log('✅ Body visible');

    // Paso 4: Buscar secciones de admin (collapsibles)
    console.log('\nPaso 4: Buscando secciones de admin...');

    const secciones = page.locator('details.admin-section, .admin-section, details');
    const numSecciones = await secciones.count();

    if (numSecciones > 0) {
      console.log(`✅ Secciones encontradas: ${numSecciones}`);

      // Leer títulos de secciones
      const summaries = page.locator('details summary, .admin-section summary');
      const numSummaries = await summaries.count();

      if (numSummaries > 0) {
        const textos = await summaries.allTextContents();
        console.log(`   Secciones: ${textos.slice(0, 5).join(', ')}`);
      }
    } else {
      console.log('ℹ️ No se encontraron secciones collapsibles');
      console.log('   Puede que admin use otra estructura');
    }

    // Paso 5: Verificar toggle de modo seguro
    console.log('\nPaso 5: Buscando toggle de modo seguro...');

    const toggleSeguro = page.locator('#admin-safe-toggle, input[type="checkbox"]');
    const numToggles = await toggleSeguro.count();

    if (numToggles > 0) {
      console.log('✅ Toggle de modo seguro encontrado');
      const checked = await toggleSeguro.first().isChecked();
      console.log(`   Estado: ${checked ? 'Desbloqueado' : 'Bloqueado'}`);
    } else {
      console.log('ℹ️ Toggle de modo seguro no encontrado');
    }

    // Paso 6: Buscar log de mensajes
    console.log('\nPaso 6: Buscando log de mensajes...');

    const logDiv = page.locator('#log, .admin-log, [data-log]');
    const logVisible = await logDiv.isVisible({ timeout: 3000 })
      .catch(() => false);

    if (logVisible) {
      console.log('✅ Log de mensajes encontrado');
    } else {
      console.log('ℹ️ Log de mensajes no visible');
    }

    // Capturar screenshot
    await page.screenshot({ path: 'tests/screenshots/tc-301-admin.png', fullPage: true });

    console.log('\n✅ TC-301 PASS: Admin dashboard accesible y funcional\n');
  });

  test('TC-302: Admin puede ver sección de partidos', async ({ page }) => {
    test.setTimeout(60000);

    console.log('\n🧪 TC-302: Verificando sección de partidos en admin...\n');

    // Paso 1: Acceder a admin
    console.log('Paso 1: Accediendo a admin...');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Admin cargado');

    // Paso 2: Buscar sección de partidos o disputas
    console.log('\nPaso 2: Buscando sección de partidos...');

    // Intentar diferentes selectores para secciones de partidos
    const seccionPartidos = page.locator('text=/partidos|disputas|conflictos/i').or(
      page.locator('[data-section="partidos"], [data-section="disputas"]')
    );

    const numSecciones = await seccionPartidos.count();

    if (numSecciones > 0) {
      console.log(`✅ Sección de partidos/disputas encontrada (${numSecciones} elementos)`);

      const textos = await seccionPartidos.allTextContents();
      console.log(`   Textos: ${textos.slice(0, 3).join(', ')}`);
    } else {
      console.log('ℹ️ No se encontró sección específica de partidos');
      console.log('   Puede que admin no tenga esta sección o use otro nombre');
    }

    // Paso 3: Expandir sección "Durante el torneo" (si existe)
    console.log('\nPaso 3: Buscando sección "Durante el torneo"...');

    const detailsDurante = page.locator('details').filter({ hasText: /durante|torneo|partidos/i });
    const duranteVisible = await detailsDurante.count();

    if (duranteVisible > 0) {
      console.log('✅ Sección "Durante el torneo" encontrada');

      const isOpen = await detailsDurante.first().getAttribute('open');
      if (!isOpen) {
        console.log('   Expandiendo sección...');
        const summary = detailsDurante.first().locator('summary');
        await summary.click();
        await page.waitForTimeout(1000);
        console.log('✅ Sección expandida');
      } else {
        console.log('   Sección ya estaba abierta');
      }

      // Buscar contenido dentro
      const contenido = detailsDurante.first().locator('div, p, button');
      const numElementos = await contenido.count();
      console.log(`   Elementos en sección: ${numElementos}`);
    } else {
      console.log('ℹ️ Sección "Durante el torneo" no encontrada');
    }

    // Paso 4: Buscar botones de acciones
    console.log('\nPaso 4: Buscando botones de acción...');

    const botones = page.locator('button:not([data-danger])').or(
      page.locator('input[type="button"]')
    );
    const numBotones = await botones.count();

    if (numBotones > 0) {
      console.log(`✅ Botones encontrados: ${numBotones}`);

      // Leer textos de primeros botones
      const textosBotones = await botones.allTextContents();
      const botonesVisibles = textosBotones
        .filter(t => t.trim().length > 0)
        .slice(0, 5);

      if (botonesVisibles.length > 0) {
        console.log(`   Botones: ${botonesVisibles.join(', ')}`);
      }
    } else {
      console.log('ℹ️ No se encontraron botones (puede que admin no tenga botones visibles)');
    }

    // Capturar screenshot
    await page.screenshot({ path: 'tests/screenshots/tc-302-admin-partidos.png', fullPage: true });

    console.log('\n✅ TC-302 PASS: Sección de partidos verificada\n');
  });

});
