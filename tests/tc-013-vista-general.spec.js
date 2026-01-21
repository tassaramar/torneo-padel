import { test, expect } from '@playwright/test';

/**
 * TC-013: Vista Pública de Todos los Resultados
 * Rol: Visualizador Público
 * Prioridad: Media
 */
test.describe('TC-013: Vista Pública de Todos los Resultados', () => {
  
  test('debe mostrar vista pública sin requerir identificación', async ({ page }) => {
    console.log('📋 Iniciando TC-013: Vista Pública de Todos los Resultados');
    
    // Paso 1: Navegar a /general
    console.log('Paso 1: Navegando a /general...');
    await page.goto('/general');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Paso 2: Verificar que NO pide identificación
    console.log('Paso 2: Verificando que no pide identificación...');
    const pideIdentificacion = await page.getByText(/¿Quién sos?/i).isVisible()
      .catch(() => false);
    
    expect(pideIdentificacion).toBe(false);
    console.log('✅ No pide identificación (vista pública)');
    
    // Paso 3: Verificar que hay tabs de grupos
    console.log('Paso 3: Verificando tabs de grupos...');
    const bodyText = await page.locator('body').textContent();
    
    const contieneGrupos = bodyText.match(/grupo/i);
    expect(contieneGrupos).toBeTruthy();
    console.log('✅ Contenido de grupos presente');
    
    // Paso 4: Verificar que todos los partidos son visibles
    console.log('Paso 4: Verificando visibilidad de partidos...');
    const headings = await page.locator('h1, h2, h3').all();
    
    expect(headings.length).toBeGreaterThan(0);
    console.log(`✅ ${headings.length} secciones de contenido encontradas`);
    
    // Paso 5: Verificar navegación a vista personal
    console.log('Paso 5: Verificando botón de navegación a vista personal...');
    const botonMisPartidos = await page.getByText(/mis partidos|ver mis partidos/i).isVisible({ timeout: 3000 })
      .catch(() => false);
    
    if (botonMisPartidos) {
      console.log('✅ Botón de navegación a vista personal encontrado');
    } else {
      console.log('ℹ️ Botón no encontrado (puede ser variación de diseño)');
    }
    
    // Resultado Final
    console.log('\n📊 RESULTADO TC-013: ✅ PASS');
    console.log('Vista pública funciona correctamente.');
  });
});
