import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const iconDependencies = [...new Set(readFileSync(new URL('./src/design/icons.ts', import.meta.url), 'utf8').match(/@phosphor-icons\/react\/dist\/csr\/[A-Za-z0-9]+/g) ?? [])];
export default defineConfig({
  plugins: [react(), tailwind()],
  // Discover lazy editor/canvas dependencies before first use, rather than
  // reloading an in-progress workspace when a new deep import is encountered.
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.tsx', 'tests/fixtures/*.tsx'],
    include: ['react', 'react-dom', 'react-dom/client', '@puckeditor/core', 'react-konva', 'konva', 'fflate', 'pdf-lib', 'zod', ...iconDependencies],
  },
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/.artifacts/**', '**/.local/**'] } },
  // Keep the canvas engine separately cached and loaded only by Design mode.
  build: { rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'canvas-engine', test: /node_modules[\\/]konva[\\/]/ }] } } } },
  // The maximum-size backup/history cases allocate real payloads; serialize files.
  test: { include: ['tests/**/*.test.{ts,tsx,mjs}'], maxWorkers: 1 },
});
