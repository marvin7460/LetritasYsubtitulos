import { Clapperboard, Cpu, ShieldCheck, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { loadMediaFile } from '../state/actions';
import { loadDemo } from '../state/demo';
import { ProjectsList } from './ProjectsList';
import { Button } from './ui/Button';
import { CapabilityChips } from './CapabilityChips';
import { DropZone } from './DropZone';

export function Landing({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 py-8 text-center sm:py-14">
      <div className="space-y-4">
        <p className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
          <Sparkles className="size-3.5 text-brand" aria-hidden />
          Para TikTok, Reels y Shorts
        </p>
        <h1 className="font-display text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          Subtítulos animados con IA,{' '}
          <span className="bg-gradient-to-r from-brand via-accent to-violet bg-clip-text text-transparent">
            gratis y privados
          </span>
        </h1>
        <p className="mx-auto max-w-xl text-base text-muted sm:text-lg">
          Arrastra tu video. La IA lo transcribe en tu propia computadora, ajustas el texto y el
          estilo, y exportas. Tus archivos nunca se suben a ningún servidor.
        </p>
      </div>

      <div className="w-full space-y-4">
        <DropZone onFile={(file) => void loadMediaFile(file)} />
        <Button
          variant="secondary"
          size="lg"
          onClick={() => void loadDemo()}
          data-testid="demo-button"
        >
          <Clapperboard className="size-5 text-brand" aria-hidden />
          Probar con un video de ejemplo
        </Button>
        {children}
        <CapabilityChips />
      </div>

      <ProjectsList />

      <ol className="grid w-full gap-3 text-left sm:grid-cols-3">
        <Step
          icon={<ShieldCheck className="size-5 text-ok" aria-hidden />}
          title="Privado de verdad"
        >
          El video se lee directamente en tu navegador. No hay servidor que lo reciba.
        </Step>
        <Step icon={<Cpu className="size-5 text-violet" aria-hidden />} title="IA local">
          Whisper corre con WebGPU (o WASM). El modelo se descarga una vez y queda guardado.
        </Step>
        <Step
          icon={<Sparkles className="size-5 text-brand" aria-hidden />}
          title="Listo para publicar"
        >
          Exporta SRT, VTT o el video con los subtítulos ya quemados.
        </Step>
      </ol>
    </div>
  );
}

function Step({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="rounded-2xl border border-line bg-surface/60 p-4">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </div>
      <p className="text-sm text-muted">{children}</p>
    </li>
  );
}
