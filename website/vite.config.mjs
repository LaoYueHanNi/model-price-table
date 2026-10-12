import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readValidatedSource } from './scripts/validate-data.mjs';

// Both development and production read the repository's single source of truth.
function pricingData() {
  return {
    name: 'repository-pricing-data',
    buildStart() { readValidatedSource(); },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/model_pricing.json') return next();
        try {
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(readValidatedSource());
        } catch (error) {
          response.statusCode = 500;
          response.end(JSON.stringify({ error: String(error) }));
        }
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'model_pricing.json', source: readValidatedSource() });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [vue(), pricingData()],
  build: { target: 'es2022' },
});
