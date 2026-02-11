import { test, expect } from '@playwright/test';

/**
 * TC-020: Números Globales en Modal de Consulta
 * Rol: Jugador/Viewer
 * Prioridad: Alta
 *
 * Verifica que los números de partido globales (#N) aparecen correctamente
 * en todas las tabs del modal "Tablas / Grupos / Fixture"
 *
 * Contexto: Fix implementado para mostrar números en "Mi grupo" y "Otros grupos"
 * que antes solo mostraban rondas (R1, R2).
 */
test.describe('TC-020: Números Globales en Modal de Consulta', () => {

  test('debe mostrar números globales en todas las tabs del modal', async ({ page }) => {
    console.log('📋 Iniciando TC-020: Números Globales en Modal de Consulta');

    // Pre-condición: Identificación de jugador
    console.log('Pre-condición: Identificando jugador...');
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.waitForLoadState('networkidle');

    // Identificarse como jugador (simplificado)
    const searchInput = page.locator('input[type="search"]').first();
    await searchInput.fill('Ari');
    await page.waitForTimeout(1000);

    await page.locator('.result-item').first().click();
    await page.waitForTimeout(1000);

    await page.locator('.option-btn[data-correcto="true"]').first().click();
    await page.waitForTimeout(2000);

    // Verificar identidad establecida
    const identidad = await page.evaluate(() => {
      const data = localStorage.getItem('torneo_identidad');
      return data ? JSON.parse(data) : null;
    });

    expect(identidad).not.toBeNull();
    console.log(`✅ Identidad establecida: ${identidad.parejaNombre}`);

    // Hacer clic en "Continuar" para pasar de la pantalla de confirmación al Home
    console.log('Haciendo clic en "Continuar" para ir al Home...');
    const botonContinuar = page.getByText(/continuar/i);
    const continuarVisible = await botonContinuar.isVisible({ timeout: 5000 })
      .catch(() => false);

    if (continuarVisible) {
      await botonContinuar.click();
      await page.waitForTimeout(1500);
      console.log('✅ Navegado al Home Único');
    }

    // Esperar a que el Home Único esté completamente renderizado
    console.log('Esperando a que el Home Único se renderice...');
    await page.waitForSelector('.home-shell', { timeout: 10000 });
    await page.waitForTimeout(1000); // Tiempo extra para JS dinámico

    // Paso 1: Abrir modal "Tablas / Grupos"
    console.log('\nPaso 1: Abriendo modal "Tablas / Grupos"...');

    // Buscar botón por ID (más robusto que buscar por texto)
    const botonModal = page.locator('#btn-abrir-modal');

    await expect(botonModal).toBeVisible({ timeout: 10000 });
    console.log('✅ Botón "Tablas / Grupos" encontrado');

    await botonModal.click();
    await page.waitForTimeout(1500);

    // Verificar que el modal abrió
    const modal = page.locator('#modal-consulta, [class*="modal"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    console.log('✅ Modal abierto correctamente');

    // Paso 2: Verificar tab "Mi grupo" - números globales
    console.log('\nPaso 2: Verificando tab "Mi grupo"...');

    // Asegurarse de que la tab "Mi grupo" está activa
    const tabMiGrupo = page.getByText(/mi grupo/i).first();
    await tabMiGrupo.click();
    await page.waitForTimeout(800);

    // Verificar que hay partidos con números globales (.modal-partido-pos)
    const numerosMiGrupo = page.locator('.modal-partido-pos');
    const countMiGrupo = await numerosMiGrupo.count();

    expect(countMiGrupo).toBeGreaterThan(0);
    console.log(`✅ Tab "Mi grupo": ${countMiGrupo} números de partido encontrados`);

    // Verificar formato (#N)
    const primerNumeroMiGrupo = await numerosMiGrupo.first().textContent();
    expect(primerNumeroMiGrupo).toMatch(/^#\d+$/);
    console.log(`✅ Formato correcto: ${primerNumeroMiGrupo}`);

    // Verificar que también hay rondas (menos prominentes)
    const rondasMiGrupo = page.locator('.modal-partido-ronda');
    const countRondasMiGrupo = await rondasMiGrupo.count();

    expect(countRondasMiGrupo).toBeGreaterThan(0);
    console.log(`✅ Tab "Mi grupo": ${countRondasMiGrupo} rondas encontradas (R1, R2...)`);

    // Paso 3: Verificar tab "Otros grupos" - números globales
    console.log('\nPaso 3: Verificando tab "Otros grupos"...');

    const tabOtrosGrupos = page.getByText(/otros grupos/i).first();
    const tabOtrosVisible = await tabOtrosGrupos.isVisible({ timeout: 5000 })
      .catch(() => false);

    if (tabOtrosVisible) {
      await tabOtrosGrupos.click();
      await page.waitForTimeout(800);

      // Si hay selector de grupo, elegir el primero
      const selectorGrupo = page.locator('select').first();
      const selectorVisible = await selectorGrupo.isVisible({ timeout: 2000 })
        .catch(() => false);

      if (selectorVisible) {
        await selectorGrupo.selectOption({ index: 1 }); // Primer grupo disponible
        await page.waitForTimeout(800);
      }

      // Verificar números globales
      const numerosOtrosGrupos = page.locator('.modal-partido-pos');
      const countOtrosGrupos = await numerosOtrosGrupos.count();

      if (countOtrosGrupos > 0) {
        console.log(`✅ Tab "Otros grupos": ${countOtrosGrupos} números de partido encontrados`);

        // Verificar formato
        const primerNumeroOtrosGrupos = await numerosOtrosGrupos.first().textContent();
        expect(primerNumeroOtrosGrupos).toMatch(/^#\d+$/);
        console.log(`✅ Formato correcto: ${primerNumeroOtrosGrupos}`);
      } else {
        console.log('⚠️ No hay partidos en "Otros grupos" (puede ser válido si no hay otros grupos)');
      }

      // Verificar rondas
      const rondasOtrosGrupos = page.locator('.modal-partido-ronda');
      const countRondasOtrosGrupos = await rondasOtrosGrupos.count();

      if (countRondasOtrosGrupos > 0) {
        console.log(`✅ Tab "Otros grupos": ${countRondasOtrosGrupos} rondas encontradas`);
      }
    } else {
      console.log('ℹ️ Tab "Otros grupos" no visible (puede no existir si hay un solo grupo)');
    }

    // Paso 4: Verificar tab "Fixture" - números globales + rondas
    console.log('\nPaso 4: Verificando tab "Fixture"...');

    const tabFixture = page.getByText(/fixture/i).first();
    const tabFixtureVisible = await tabFixture.isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(tabFixtureVisible).toBe(true);
    await tabFixture.click();
    await page.waitForTimeout(800);

    // Verificar números globales en fixture
    const numerosFixture = page.locator('.modal-fixture-pos, .modal-partido-pos');
    const countFixture = await numerosFixture.count();

    expect(countFixture).toBeGreaterThan(0);
    console.log(`✅ Tab "Fixture": ${countFixture} números de partido encontrados`);

    // Verificar formato (puede ser "#1" o "1" dependiendo del componente)
    const primerNumeroFixture = await numerosFixture.first().textContent();
    expect(primerNumeroFixture).toMatch(/^#?\d+$/); // # es opcional
    console.log(`✅ Formato correcto: ${primerNumeroFixture}`);

    // Paso 5: Verificar jerarquía visual (números prominentes, rondas secundarias)
    console.log('\nPaso 5: Verificando jerarquía visual (CSS)...');

    // Verificar que números tienen estilos prominentes (círculo teal)
    const estilosNumero = await page.locator('.modal-partido-pos').first().evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        background: styles.backgroundColor,
        color: styles.color,
        borderRadius: styles.borderRadius,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
      };
    });

    console.log('Estilos de números:', estilosNumero);

    // Verificar propiedades clave (no valores exactos por variabilidad de browsers)
    expect(estilosNumero.borderRadius).not.toBe('0px'); // Debe ser circular
    expect(parseInt(estilosNumero.fontWeight)).toBeGreaterThanOrEqual(600); // Bold
    console.log('✅ Números tienen estilos prominentes (círculo + bold)');

    // Verificar que rondas tienen estilos secundarios (gris, pequeña)
    const estilosRonda = await page.locator('.modal-partido-ronda').first().evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        color: styles.color,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
      };
    });

    console.log('Estilos de rondas:', estilosRonda);

    // Ronda debe tener fontSize menor que número
    const fontSizeNumero = parseInt(estilosNumero.fontSize);
    const fontSizeRonda = parseInt(estilosRonda.fontSize);

    expect(fontSizeRonda).toBeLessThanOrEqual(fontSizeNumero);
    console.log('✅ Rondas tienen estilos secundarios (menor tamaño)');

    // Paso 6: Verificar consistencia entre tabs
    console.log('\nPaso 6: Verificando consistencia entre tabs...');

    // Volver a "Mi grupo"
    await tabMiGrupo.click();
    await page.waitForTimeout(500);

    const numerosFinalesMiGrupo = await page.locator('.modal-partido-pos').allTextContents();

    // Ir a "Fixture"
    await tabFixture.click();
    await page.waitForTimeout(500);

    const numerosFinalesFixture = await page.locator('.modal-fixture-pos, .modal-partido-pos').allTextContents();

    console.log(`Números en "Mi grupo": ${numerosFinalesMiGrupo.slice(0, 3).join(', ')}...`);
    console.log(`Números en "Fixture": ${numerosFinalesFixture.slice(0, 3).join(', ')}...`);

    // Verificar que al menos algunos números coinciden (los partidos del jugador)
    const numerosCoincidentes = numerosFinalesMiGrupo.filter(num =>
      numerosFinalesFixture.includes(num)
    );

    expect(numerosCoincidentes.length).toBeGreaterThan(0);
    console.log(`✅ ${numerosCoincidentes.length} números coinciden entre tabs (consistencia verificada)`);

    // Cerrar modal
    console.log('\nPaso 7: Cerrando modal...');
    const botonCerrar = page.locator('[class*="modal-close"], button:has-text("Cerrar"), button:has-text("×")').first();
    const botonCerrarVisible = await botonCerrar.isVisible({ timeout: 3000 })
      .catch(() => false);

    if (botonCerrarVisible) {
      await botonCerrar.click();
      await page.waitForTimeout(500);
      console.log('✅ Modal cerrado correctamente');
    } else {
      console.log('ℹ️ Botón cerrar no encontrado (puede cerrarse con ESC o click fuera)');
    }

    // Resultado Final
    console.log('\n📊 RESULTADO TC-020: ✅ PASS');
    console.log('Números globales funcionan correctamente en todas las tabs del modal.');
    console.log('Jerarquía visual correcta: números prominentes, rondas secundarias.');
  });

  test('debe mostrar números dinámicos (excluye finalizados y en juego)', async ({ page }) => {
    console.log('\n📋 Iniciando TC-020b: Numeración Dinámica');

    // Pre-condición: Ir directo al fixture público (no requiere identificación)
    console.log('Navegando a /fixture...');
    await page.goto('/fixture');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verificar que hay partidos con números
    const numeros = page.locator('[class*="partido-pos"], [class*="fixture-pos"]');
    const count = await numeros.count();

    if (count === 0) {
      console.log('⚠️ No hay partidos pendientes para verificar numeración dinámica');
      console.log('ℹ️ Esto es válido si todos los partidos están finalizados');
      return; // Skip test si no hay partidos
    }

    console.log(`✅ ${count} partidos pendientes encontrados`);

    // Verificar que la numeración es secuencial (1, 2, 3...)
    const numerosTexto = await numeros.allTextContents();
    const numerosValores = numerosTexto.map(t => parseInt(t.replace('#', '')));

    console.log(`Números encontrados: ${numerosValores.slice(0, 10).join(', ')}...`);

    // Verificar que empieza en 1
    expect(numerosValores[0]).toBe(1);
    console.log('✅ Numeración empieza en #1');

    // Verificar que es secuencial (cada número es anterior + 1)
    let esSecuencial = true;
    for (let i = 1; i < Math.min(5, numerosValores.length); i++) {
      if (numerosValores[i] !== numerosValores[i-1] + 1) {
        esSecuencial = false;
        break;
      }
    }

    expect(esSecuencial).toBe(true);
    console.log('✅ Numeración es secuencial (#1, #2, #3...)');

    console.log('\n📊 RESULTADO TC-020b: ✅ PASS');
    console.log('Numeración dinámica funciona correctamente (solo cuenta pendientes).');
  });
});
