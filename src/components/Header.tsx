import { ShieldCheck } from 'lucide-react';

export function Header({ onHome }: { onHome?: () => void }) {
  return (
    <header className="border-b border-line/60 bg-ink/80 backdrop-blur supports-[backdrop-filter]:bg-ink/60">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-2 font-display text-lg font-black tracking-tight"
          aria-label="Letritas, volver al inicio"
        >
          <img src="/favicon.svg" alt="" className="size-7" />
          <span>
            Letritas<span className="text-brand">.</span>
          </span>
        </button>
        <PrivacyBadge />
      </div>
    </header>
  );
}

export function PrivacyBadge() {
  return (
    <p
      className="flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok/10 px-3 py-1 text-xs font-medium text-ok"
      title="Letritas procesa tus archivos con la IA de tu propio navegador. Ningún video, audio ni texto se envía a un servidor."
    >
      <ShieldCheck className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">Nada sale de tu computadora</span>
      <span className="sm:hidden">100% local</span>
    </p>
  );
}
