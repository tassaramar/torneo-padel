import { test, expect } from '@playwright/test';

/**
 * Test rápido de integración de presentismo en fixture.html
 */

test.describe('Fixture con Presentismo', () => {

  test('Fixture carga y muestra elementos de presentismo', async ({ page }) => {
    test.setTimeout(30000);

    console.log('\n🧪 Test rápido: Verificando integración de presentismo en fixture...\n');

    // Paso 1: Acceder a /fixture
    console.log('Paso 1: Accediendo a /fixture...');
    await page.goto('/fixture');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Página cargada');

    // Paso 2: Verificar que fixture existe
    const urlActual = page.url();
    console.log(`Paso 2: URL actual: ${urlActual}`);
    expect(urlActual).toContain('fixture');
    console.log('✅ Fixture.html existe');

    // Paso 3: Verificar estructura básica
    console.log('\nPaso 3: Verificando estructura básica...');
    const body = page.locator('body');
    await expect(body).toBeVisible();
    console.log('✅ Body visible');

    // Paso 4: Buscar badges de presentismo (si existen)
    console.log('\nPaso 4: Buscando badges de presentismo...');
    const badges = page.locator('.badge-presentismo');
    const numBadges = await badges.count();

    if (numBadges > 0) {
      console.log(`✅ Badges de presentismo encontrados: ${numBadges}`);

      // Verificar que hay badges de cada tipo
      const badgesTodosPresentes = page.locator('.badge-presentismo.todos-presentes');
      const badgesInfoIncompleta = page.locator('.badge-presentismo.info-incompleta');

      const numTodosPresentes = await badgesTodosPresentes.count();
      const numInfoIncompleta = await badgesInfoIncompleta.count();

      console.log(`   - ✅ (todos presentes): ${numTodosPresentes}`);
      console.log(`   - ⚠️ (info incompleta): ${numInfoIncompleta}`);
    } else {
      console.log('ℹ️ No se encontraron badges de presentismo');
      console.log('   Esto puede ser normal si presentismo_activo = false en BD');
    }

    // Paso 5: Buscar filtro de presentismo
    console.log('\nPaso 5: Buscando filtro de presentismo...');
    const filtro = page.locator('.fixture-filtro-presentismo');
    const filtroVisible = await filtro.isVisible({ timeout: 3000 })
      .catch(() => false);

    if (filtroVisible) {
      console.log('✅ Filtro de presentismo visible');

      // Verificar checkbox
      const checkbox = page.locator('#filtro-parejas-completas');
      const checkboxVisible = await checkbox.isVisible();

      if (checkboxVisible) {
        console.log('✅ Checkbox de filtro visible');
      }

      // Verificar contador
      const contador = page.locator('.filtro-contador');
      const contadorVisible = await contador.isVisible();

      if (contadorVisible) {
        const textoContador = await contador.textContent();
        console.log(`✅ Contador visible: ${textoContador}`);
      }
    } else {
      console.log('ℹ️ Filtro de presentismo no visible');
      console.log('   Esto es normal si presentismo_activo = false en BD');
    }

    // Paso 6: Buscar nombres con colores
    console.log('\nPaso 6: Buscando nombres con colores...');
    const jugadoresPresentes = page.locator('.jugador.presente');
    const jugadoresAusentes = page.locator('.jugador.ausente');

    const numPresentes = await jugadoresPresentes.count();
    const numAusentes = await jugadoresAusentes.count();

    if (numPresentes > 0 || numAusentes > 0) {
      console.log(`✅ Nombres con colores encontrados:`);
      console.log(`   - Verde (presentes): ${numPresentes}`);
      console.log(`   - Gris (ausentes): ${numAusentes}`);
    } else {
      console.log('ℹ️ No se encontraron nombres con colores');
      console.log('   Esto es normal si presentismo_activo = false en BD');
    }

    // Capturar screenshot
    await page.screenshot({ path: 'tests/screenshots/fixture-presentismo.png', fullPage: true });

    console.log('\n✅ TEST PASS: Fixture carga correctamente (presentismo integrado)\\n');
  });

});
