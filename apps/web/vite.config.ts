/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The site is a static SPA with hash routing (/#/dictionary/hello), so it can
 * be hosted anywhere with zero server config. Set VITE_BASE when it is served
 * from a sub-path, e.g. GitHub Pages: VITE_BASE=/meta-vr/ npm run build
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    // react-router is hoisted next to another workspace's React 19; always use ours.
    dedupe: ['react', 'react-dom', 'three'],
  },
  server: { host: '0.0.0.0', port: 5174, strictPort: true },
  preview: { host: '0.0.0.0', port: 5174, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
