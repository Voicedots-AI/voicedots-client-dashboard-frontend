import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'mentor-management.spec.ts', fullyParallel: true,
  timeout: 60000, expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:5193', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5193 --strictPort', url: 'http://127.0.0.1:5193', reuseExistingServer: false },
});
