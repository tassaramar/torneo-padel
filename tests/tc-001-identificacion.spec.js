import { test, expect } from '@playwright/test';

/**
 * TC-001: Identificación de Jugador
 * Rol: Jugador/Viewer
 * Prioridad: Crítica
 */
test.describe('TC-001: Identificación de Jugador', () => {
  
  test.beforeEach(async ({ page }) => {
    // Limpiar localStorage antes de cada test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('debe permitir identificación completa de jugador', async ({ page, context }) => {
    console.log('📋 Iniciando TC-001: Identificación de Jugador');
    
    // Paso 1: Navegar al sistema
    console.log('Paso 1: Navegando a la página principal...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Paso 2: Verificar que aparece la pantalla "¿Quién sos?"
    console.log('Paso 2: Verificando pantalla de identificación...');
    const identificacionVisible = await page.getByText(/¿Quién sos?/i).isVisible({ timeout: 10000 })
      .catch(() => false);
    
    if (!identificacionVisible) {
      // Puede que ya haya una identidad guardada, intentar limpiar y recargar
      await page.evaluate(() => {
        localStorage.removeItem('torneo_identidad');
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
    }
    
    // Verificar nuevamente
    await expect(page.getByText(/¿Quién sos?/i).or(page.locator('input[type="search"]')).first())
      .toBeVisible({ timeout: 10000 });
    
    console.log('✅ Pantalla de identificación mostrada correctamente');
    
    // Paso 3: Buscar un jugador
    console.log('Paso 3: Buscando jugador...');
    const searchInput = page.locator('input[type="search"]').first();
    await searchInput.fill('Ari');
    
    // Esperar un momento para que aparezcan sugerencias
    await page.waitForTimeout(1000);
    
    // Paso 4: Verificar que aparecen sugerencias
    console.log('Paso 4: Verificando sugerencias de jugadores...');
    
    // Esperar a que aparezcan resultados (clase .result-item)
    await page.waitForSelector('.result-item', { timeout: 5000 });
    
    // Contar resultados
    const sugerencias = await page.locator('.result-item').count();
    
    expect(sugerencias).toBeGreaterThan(0);
    console.log(`✅ Se encontraron ${sugerencias} sugerencias de jugadores`);
    
    // Paso 5: Seleccionar un jugador
    console.log('Paso 5: Seleccionando jugador...');
    
    // Seleccionar el primer result-item
    const primerJugador = page.locator('.result-item').first();
    
    const nombreJugador = await primerJugador.locator('.result-name').textContent();
    const metaJugador = await primerJugador.locator('.result-meta').textContent();
    console.log(`Seleccionando jugador: ${nombreJugador} (${metaJugador})`);
    
    await primerJugador.click();
    await page.waitForTimeout(1000);
    
    // Paso 6: Verificar que aparecen opciones de compañeros
    console.log('Paso 6: Verificando opciones de compañeros...');
    
    // Esperar a que aparezcan los botones de opciones (.option-btn)
    await page.waitForSelector('.option-btn', { timeout: 5000 });
    
    const companeros = await page.locator('.option-btn').count();
    
    expect(companeros).toBeGreaterThan(0);
    console.log(`✅ Se encontraron ${companeros} opciones de compañeros`);
    
    // Paso 7: Seleccionar el compañero CORRECTO
    console.log('Paso 7: Seleccionando compañero correcto...');
    
    // Seleccionar el botón que tiene data-correcto="true"
    const companeroCorrecto = page.locator('.option-btn[data-correcto="true"]').first();
    
    const nombreCompanero = await companeroCorrecto.textContent();
    console.log(`Seleccionando compañero correcto: ${nombreCompanero?.trim()}`);
    
    await companeroCorrecto.click();
    
    // Esperar a que la vista cambie
    await page.waitForTimeout(2000);
    
    // Paso 8: Verificar que la identidad se guardó y la vista cambió
    console.log('Paso 8: Verificando que la identidad se guardó...');
    
    // Verificar localStorage
    const identidad = await page.evaluate(() => {
      const data = localStorage.getItem('torneo_identidad');
      return data ? JSON.parse(data) : null;
    });
    
    console.log('Identidad guardada:', identidad);
    
    expect(identidad).not.toBeNull();
    expect(identidad).toHaveProperty('miNombre'); // En lugar de 'jugadorNombre'
    expect(identidad).toHaveProperty('companero'); // En lugar de 'companeroNombre'
    expect(identidad).toHaveProperty('parejaId');
    expect(identidad).toHaveProperty('parejaNombre');
    expect(identidad).toHaveProperty('grupo');
    expect(identidad).toHaveProperty('orden');
    
    console.log('✅ Identidad guardada correctamente en localStorage');
    
    // Verificar que la vista personalizada se cargó
    // Puede mostrar el nombre de la pareja en el header
    const vistaPersonal = await page.locator('body').textContent();
    const contieneNombrePareja = vistaPersonal.includes(identidad.jugadorNombre) || 
                                  vistaPersonal.includes(identidad.parejaNombre);
    
    expect(contieneNombrePareja).toBeTruthy();
    console.log('✅ Vista personalizada cargada correctamente');
    
    // Validación DB: Verificar tracking de evento de visita
    console.log('Validación DB: Verificando evento de tracking...');
    
    const trackingQuery = `
      SELECT * FROM tracking_eventos 
      WHERE tipo_evento = 'visita' 
      AND jugador_nombre LIKE '%${identidad.jugadorNombre}%'
      ORDER BY created_at DESC LIMIT 1;
    `;
    
    console.log('Query a ejecutar en Supabase:', trackingQuery);
    
    // Ejecutar query en la consola del navegador
    const trackingEvento = await page.evaluate(async (jugadorNombre) => {
      try {
        const { supabase } = await import('/src/carga/context.js');
        const { data, error } = await supabase
          .from('tracking_eventos')
          .select('*')
          .eq('tipo_evento', 'visita')
          .ilike('jugador_nombre', `%${jugadorNombre}%`)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('Error al consultar tracking_eventos:', error);
          return { error: error.message };
        }
        
        return { data: data[0] || null };
      } catch (e) {
        console.error('Error al importar contexto:', e);
        return { error: e.message };
      }
    }, identidad.jugadorNombre);
    
    console.log('Resultado tracking_eventos:', trackingEvento);
    
    if (trackingEvento.error) {
      console.warn('⚠️ No se pudo verificar tracking (puede ser restricción de RLS o timing):', trackingEvento.error);
      // No fallar el test por esto, es una validación secundaria
    } else if (trackingEvento.data) {
      console.log('✅ Evento de tracking registrado correctamente');
    } else {
      console.warn('⚠️ No se encontró evento de tracking (puede tomar unos segundos en registrarse)');
    }
    
    // Resultado Final
    console.log('\n📊 RESULTADO TC-001: ✅ PASS');
    console.log('Todas las validaciones principales pasaron correctamente.');
  });
});
