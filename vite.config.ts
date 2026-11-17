import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
const iconDependencies = [...new Set(readFileSync(new URL('./src/canvas/icons.ts', import.meta.url), 'utf8').match(/@phosphor-icons\/react\/dist\/csr\/[A-Za-z0-9]+/g) ?? [])];
export default defineConfig({
  plugins: [react()],
  // Discover lazy editor dependencies before first use, rather than reloading
  // an in-progress session when a new deep import is encountered.
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.tsx'],
    include: ['react', 'react-dom', 'react-dom/client', 'react-dom/server', 'fflate', 'zod', ...iconDependencies],
  },
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/.artifacts/**', '**/.local/**'] } },
  // Keep the export dependency tests serialized.
  test: { include: ['tests/**/*.test.{ts,tsx,mjs}'], maxWorkers: 1 },
});
