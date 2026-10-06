/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Cross-origin isolation (COOP + COEP) unlocks SharedArrayBuffer, which ONNX Runtime needs to run
 * the WASM fallback with multiple threads (several times faster than single-threaded). The same
 * headers are configured for production in `public/_headers` (Cloudflare Pages) and `vercel.json`.
 */
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

/**
 * onnxruntime-web references its 26 MB `.wasm` with `new URL(..., import.meta.url)`, so Vite
 * copies it into the build. Transformers.js never uses that copy: it loads the matching binary
 * from jsDelivr and caches it (Cache API). Dropping it keeps every file under Cloudflare Pages'
 * 25 MiB limit and makes deploys much smaller.
 */
function dropUnusedOnnxWasm(): Plugin {
  return {
    name: 'letritas:drop-unused-onnx-wasm',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (/ort-wasm.*\.wasm$/.test(fileName)) Reflect.deleteProperty(bundle, fileName);
      }
    },
  };
}

/**
 * Offline support. The app shell (HTML, JS, CSS, self-hosted fonts, icons) is precached. Large or
 * third-party files are cached the first time they're used:
 * - the ONNX Runtime WASM from jsDelivr (Transformers.js also keeps its own copy),
 * - the demo clip.
 * Whisper models are cached by Transformers.js itself (Cache Storage "transformers-cache").
 */
const pwa = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  manifest: {
    name: 'Letritas · Subtítulos animados con IA',
    short_name: 'Letritas',
    description:
      'Subtítulos animados para TikTok, Reels y Shorts, generados con IA en tu navegador. Gratis y privado.',
    lang: 'es',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0b12',
    theme_color: '#0b0b12',
    categories: ['productivity', 'video', 'utilities'],
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    globIgnores: ['samples/**', 'bench.html', 'assets/bench-*'],
    // The Whisper engine chunk is ~550 kB; allow it in the precache.
    maximumFileSizeToCacheInBytes: 4 * 1024 ** 2,
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/bench/],
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net',
        handler: 'CacheFirst',
        options: {
          cacheName: 'onnx-runtime',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 90 },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/samples/'),
        handler: 'CacheFirst',
        options: { cacheName: 'demo-samples', cacheableResponse: { statuses: [200] } },
      },
    ],
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), dropUnusedOnnxWasm(), pwa],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  worker: { format: 'es' },
  build: {
    rolldownOptions: {
      // The app plus the benchmark page (/bench.html), which isn't linked from the app.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        bench: fileURLToPath(new URL('./bench.html', import.meta.url)),
      },
    },
  },
  optimizeDeps: {
    // Transformers.js resolves the ONNX Runtime files at runtime; pre-bundling breaks that.
    exclude: ['@huggingface/transformers'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    restoreMocks: true,
  },
});
