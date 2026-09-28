import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// package.json is the single source of the app version. It reaches the UI as
// __APP_VERSION__ (see src/version.ts) and the service worker cache name via
// the placeholder in public/sw.js, which is stamped after each build.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const SW_VERSION_PLACEHOLDER = '__APP_VERSION__';

function stampServiceWorkerVersion(): Plugin {
  let swPath = '';
  return {
    name: 'stamp-service-worker-version',
    apply: 'build',
    configResolved(config) {
      swPath = resolve(config.root, config.build.outDir, 'sw.js');
    },
    closeBundle() {
      const source = readFileSync(swPath, 'utf8');
      if (!source.includes(SW_VERSION_PLACEHOLDER)) {
        throw new Error(`${swPath} has no ${SW_VERSION_PLACEHOLDER} placeholder to stamp`);
      }
      writeFileSync(swPath, source.replaceAll(SW_VERSION_PLACEHOLDER, version));
    },
  };
}

export default defineConfig({
  plugins: [react(), stampServiceWorkerVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  base: '/job_estimator/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
  server: {
    host: true,
    headers: {
      'Service-Worker-Allowed': '/',
    },
  },
});
