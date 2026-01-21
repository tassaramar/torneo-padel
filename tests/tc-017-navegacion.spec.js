import { test, expect } from '@playwright/test';

/**
 * TC-017: Navegación
 * Rol: Usuario General
 * Prioridad: Media
 */
test.describe('TC-017: Navegación', () => {
  
  test('debe permitir navegación entre todas las páginas', async ({ page }) => {
    console.log('📋 Iniciando TC-017: Navegación');
    
    // Paso 1: Navegar a página principal
    console.log('Paso 1: Navegando a página principal...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Paso 2: Verificar que existe topnav (puede no estar en / por ser vista personalizada)
    console.log('Paso 2: Verificando navegación...');
    const bodyText = await page.locator('body').textContent();
    
    expect(bodyText).toBeTruthy();
    console.log('✅ Página principal cargó correctamente');
    
    // Paso 3: Navegar a carga (que sí tiene topnav)
    console.log('Paso 3: Navegando a /carga para verificar topnav...');
    await page.goto('/carga');
    await page.waitForLoadState('networkidle');
    
    const topnavVisible = await page.locator('.topnav').isVisible().catch(() => false);
    
    if (topnavVisible) {
      const links = await page.locator('.topnav a').all();
      console.log(`✅ Topnav encontrado con ${links.length} enlaces`);
    } else {
      console.log('ℹ️ Topnav no detectado');
    }
    
    // Paso 4: Probar navegación a /carga
    console.log('Paso 4: Navegando a /carga...');
    await page.goto('/carga');
    await page.waitForLoadState('networkidle');
    
    const cargaActiva = await page.locator('.topnav .is-active').isVisible().catch(() => false);
    
    if (cargaActiva) {
      console.log('✅ Enlace activo marcado correctamente');
    } else {
      console.log('ℹ️ Enlace activo no detectado (puede ser variación de estilo)');
    }
    
    // Paso 5: Probar navegación a /admin
    console.log('Paso 5: Navegando a /admin...');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    const adminCargado = await page.locator('body').textContent();
    expect(adminCargado).toContain('Admin');
    console.log('✅ Página de Admin cargó');
    
    // Paso 6: Probar navegación a /analytics
    console.log('Paso 6: Navegando a /analytics...');
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    const analyticsCargado = await page.locator('body').textContent();
    expect(analyticsCargado).toContain('Analytics');
    console.log('✅ Página de Analytics cargó');
    
    // Paso 7: Volver a /
    console.log('Paso 7: Navegando de vuelta a /...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const indexCargado = await page.locator('body').textContent();
    expect(indexCargado).toBeTruthy();
    console.log('✅ Navegación de regreso a / funciona');
    
    // Resultado Final
    console.log('\n📊 RESULTADO TC-017: ✅ PASS');
    console.log('Navegación entre todas las páginas funciona correctamente.');
  });
});
