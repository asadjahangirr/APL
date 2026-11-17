import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '**/*.spec.ts', use: { baseURL: 'http://127.0.0.1:5173', headless: true, channel: process.env.PW_CHANNEL || undefined }, webServer: { command: 'npm run dev', url:'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI } });

