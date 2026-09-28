/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from 'node:url';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig } from 'vite';

export default defineConfig({
  // The UI is built in code (not UIKitML files), so tell the plugin which
  // bundled MSDF font to keep in production builds.
  plugins: [iwsdkDev({ bundle: { fonts: ['inter'] } })],
  server: { host: '0.0.0.0', port: 8081, open: false },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
    rollupOptions: { input: './index.html' },
  },
  esbuild: { target: 'esnext' },
  // @drawcall/uikitml otherwise pulls a second three/@pmndrs/uikit graph
  // (three@0.185 vs app super-three@0.181). Duplicate Component classes break
  // instanceof checks → "Only pmndrs/uikit components can be added as children".
  resolve: {
    // Ship only the icons we use (see src/ui/lucide-subset.ts).
    alias: [
      {
        find: /^@pmndrs\/uikit-lucide$/,
        replacement: fileURLToPath(new URL('./src/ui/lucide-subset.ts', import.meta.url)),
      },
    ],
    dedupe: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
    ],
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@drawcall/uikitml',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
  base: './',
});
