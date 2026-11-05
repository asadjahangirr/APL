import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'capture-baseline.spec.ts', workers: 1, outputDir: '../.artifacts/phase-0/test-results',
  use: { baseURL: 'http://127.0.0.1:5174', headless: true },
  webServer: { command: 'npm.cmd exec vite -- .artifacts/phase-0/baseline --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174', cwd: 'C:/Users/ASAD/Projects/APL', reuseExistingServer: false },
});
