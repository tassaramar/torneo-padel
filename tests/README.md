# Testing Automatizado con Playwright

Tests E2E (end-to-end) para verificar funcionalidad de la app en producción.

## 🚀 Quick Start

```bash
# Correr todos los tests
npm test

# Correr solo el test de números en modal
npm run test:modal

# Correr tests con interfaz visual (recomendado)
npm run test:ui

# Correr tests con browser visible (debugging)
npm run test:headed

# Correr solo tests mobile
npm run test:mobile

# Ver reporte HTML del último run
npm run test:report
```

## 📋 Tests Disponibles

### TC-020: Números Globales en Modal ⭐ NUEVO
**Archivo**: `tc-020-modal-numeros-globales.spec.js`

**Verifica**:
- Tab "Mi grupo": muestra números globales (#N) + rondas (RN)
- Tab "Otros grupos": muestra números globales (#N) + rondas (RN)
- Tab "Fixture": muestra números globales (#N) + rondas (RN)
- Jerarquía visual: números prominentes (círculo teal), rondas secundarias (gris)
- Consistencia: mismos números entre tabs
- Numeración dinámica: #1, #2, #3... (excluye finalizados)

**Cómo correr**:
```bash
npm run test:modal
```

### Otros Tests
- **TC-001**: Identificación de jugador
- **TC-002**: Vista personalizada de partidos
- **TC-006**: Vista carga general
- **TC-013**: Vista general
- **TC-014**: Analytics
- **TC-017**: Navegación

## 🎯 Proyectos (Browsers + Viewports)

Los tests corren automáticamente en 4 configuraciones:

1. **mobile-chrome** - Pixel 5 (393x851)
2. **mobile-safari** - iPhone 12 (390x844)
3. **desktop-chrome** - Desktop (1280x720)
4. **desktop-firefox** - Desktop (1280x720)

### Correr proyecto específico

```bash
# Solo mobile
npx playwright test --project=mobile-chrome

# Solo desktop
npx playwright test --project=desktop-chrome
```

## 🔧 Configuración

**Archivo**: `playwright.config.js`

**URL base**: `https://torneo-padel-teal.vercel.app` (producción)

### Testear contra servidor local

1. Editar `playwright.config.js`:
   ```javascript
   use: {
     baseURL: 'http://localhost:5173',
     // ...
   }
   ```

2. O usar variable de entorno:
   ```bash
   PLAYWRIGHT_BASE_URL=http://localhost:5173 npm test
   ```

3. O descomentar `webServer` en config para auto-start:
   ```javascript
   webServer: {
     command: 'npm run dev',
     url: 'http://localhost:5173',
     reuseExistingServer: !process.env.CI,
   }
   ```

## 📊 Reportes y Debugging

### Ver reporte HTML
```bash
npm run test:report
```

Abre browser con reporte interactivo mostrando:
- Screenshots de fallos
- Videos de tests fallidos
- Traces para debugging

### Debug mode
```bash
npm run test:debug
```

Abre Playwright Inspector para step-by-step debugging.

### UI Mode (recomendado para desarrollo)
```bash
npm run test:ui
```

Interface gráfica para:
- Ver tests en tiempo real
- Time travel debugging
- Ver screenshots/videos inmediatamente

## 📝 Escribir Nuevos Tests

### Estructura básica

```javascript
import { test, expect } from '@playwright/test';

test.describe('TC-XXX: Nombre del Test', () => {
  test('debe verificar X funcionalidad', async ({ page }) => {
    // Pre-condición
    await page.goto('/');

    // Acción
    await page.click('button');

    // Verificación
    await expect(page.locator('.resultado')).toBeVisible();
  });
});
```

### Convenciones

1. **Nombres de archivo**: `tc-XXX-descripcion.spec.js`
2. **Console.log**: Usar para documentar pasos (facilita debugging)
3. **Comentarios**: Explicar pre-condiciones y contexto
4. **Timeouts**: Usar `waitForTimeout` con moderación (preferir `waitForSelector`)

### Ejemplo: Verificar elemento existe

```javascript
// ❌ Malo (frágil)
await page.waitForTimeout(3000);
const elemento = page.locator('.clase');

// ✅ Bueno (robusto)
const elemento = page.locator('.clase');
await expect(elemento).toBeVisible({ timeout: 5000 });
```

## 🎨 Mobile-First Testing

**IMPORTANTE**: Esta app es mobile-first. Siempre verificar que funciona en mobile.

### Prioridad de testing:
1. ✅ Mobile Chrome (Pixel 5)
2. ✅ Mobile Safari (iPhone 12)
3. ✅ Desktop Chrome
4. ✅ Desktop Firefox

Si un feature falla en mobile, es un bug crítico.

## 🚨 CI/CD Integration

En CI (GitHub Actions, Vercel, etc.):
```bash
npx playwright test --project=mobile-chrome --project=desktop-chrome
```

Config automática para CI:
- `retries: 2` - Reintentar tests fallidos
- `workers: 1` - Un solo worker (evita problemas de concurrencia)
- `forbidOnly: true` - No permite `.only()` en CI

## 📚 Recursos

- [Documentación oficial de Playwright](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging](https://playwright.dev/docs/debug)
- [Selectores](https://playwright.dev/docs/selectors)

## ⚡ Tips

1. **Usar `test:ui` para desarrollo** - Mucho más rápido que correr tests desde CLI
2. **Screenshots automáticos** - Se guardan en `test-results/` cuando hay fallos
3. **Trace viewer** - Usa `npx playwright show-trace trace.zip` para inspeccionar traces
4. **Mobile testing** - Siempre testear en mobile primero (app mobile-first)
5. **Selectores estables** - Preferir `data-testid` sobre clases CSS cuando sea posible

## 🐛 Troubleshooting

**Tests fallan con timeout**:
- Aumentar timeout en `playwright.config.js`
- Verificar que la URL base es correcta
- Verificar conectividad a internet (si testeas contra producción)

**Browser no instalado**:
```bash
npx playwright install
```

**Tests pasan local pero fallan en CI**:
- Verificar tiempos de espera (waitForTimeout)
- Usar `waitForSelector` en lugar de esperas fijas
- Verificar que no hay `.only()` en los tests
