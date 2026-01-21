import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Ejecutar tests secuencialmente
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Un worker para tests secuenciales
  reporter: [
    ['html'],
    ['list']
  ],
  use: {
    baseURL: 'https://torneo-padel-teal.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  timeout: 60000, // 60 segundos por test
});
