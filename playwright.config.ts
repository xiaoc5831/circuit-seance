import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4319);
const executablePath = process.env.CHROMIUM_PATH ?? (process.env.CI ? undefined : '/usr/bin/chromium');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: { executablePath, args: ['--no-sandbox'] },
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.PW_EXTERNAL_SERVER
    ? undefined
    : {
    command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
