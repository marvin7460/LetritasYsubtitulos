/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

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

export default defineConfig({
  plugins: [react(), tailwindcss(), dropUnusedOnnxWasm()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  worker: { format: 'es' },
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
