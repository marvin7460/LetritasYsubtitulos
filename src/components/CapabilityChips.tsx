import { Cpu, Zap } from 'lucide-react';
import { useAppStore } from '../state/store';

/** Honest, at-a-glance status of what this browser can do. */
export function CapabilityChips() {
  const capabilities = useAppStore((s) => s.capabilities);
  if (!capabilities) {
    return <p className="text-xs text-muted">Revisando qué puede hacer tu navegador…</p>;
  }
  return (
    <ul
      className="flex flex-wrap justify-center gap-2 text-xs"
      aria-label="Capacidades del navegador"
    >
      <li
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${
          capabilities.webgpu
            ? 'border-ok/30 bg-ok/10 text-ok'
            : 'border-warn/30 bg-warn/10 text-warn'
        }`}
      >
        <Zap className="size-3.5" aria-hidden />
        {capabilities.webgpu
          ? 'WebGPU disponible: transcripción rápida'
          : 'Sin WebGPU: usaremos WASM (más lento)'}
      </li>
      <li className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-muted">
        <Cpu className="size-3.5" aria-hidden />
        {capabilities.crossOriginIsolated
          ? `WASM con ${Math.min(4, Math.max(1, Math.ceil(capabilities.threads / 2)))} hilos`
          : 'WASM en un solo hilo'}
      </li>
    </ul>
  );
}
