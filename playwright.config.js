import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para testing E2E
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  // Timeout por test (30 segundos)
  timeout: 30 * 1000,

  // Configuración de expect
  expect: {
    timeout: 5000
  },

  // Ejecutar tests secuencialmente (evita problemas con BD compartida)
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  // Reporter: HTML report + consola
  reporter: [
    ['html'],
    ['list']
  ],

  // Configuración compartida para todos los tests
  use: {
    // URL base (producción por defecto, cambiar con env var)
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://torneo-padel-teal.vercel.app',

    // Screenshots solo en fallo
    screenshot: 'only-on-failure',

    // Video solo en retry
    video: 'retain-on-failure',

    // Trace solo en retry
    trace: 'on-first-retry',
  },

  // Proyectos: Mobile-first (crítico para esta app)
  projects: [
    // Mobile
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 }
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 }
      },
    },

    // Desktop
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },
    {
      name: 'desktop-firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },
  ],

  // Servidor local (opcional - para testing contra dev server)
  // Descomentar para testear contra npm run dev en lugar de producción
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  // },
});
