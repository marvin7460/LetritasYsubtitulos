import { LoaderCircle } from 'lucide-react';
import { closeMedia } from '../state/actions';
import { useAppStore } from '../state/store';
import { Button } from './ui/Button';
import { ProgressBar } from './ui/ProgressBar';

export function LoadingMedia() {
  const progress = useAppStore((s) => s.extractProgress);
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-center gap-5 py-24 text-center"
      aria-live="polite"
    >
      <LoaderCircle className="size-10 animate-spin text-brand" aria-hidden />
      <div>
        <p className="text-lg font-semibold">Preparando el audio…</p>
        <p className="mt-1 text-sm text-muted">
          Lo extraemos y convertimos a 16 kHz aquí mismo, en tu navegador.
        </p>
      </div>
      <ProgressBar value={progress > 0 ? progress : null} label="Progreso de extracción de audio" />
      <Button variant="ghost" size="sm" onClick={closeMedia}>
        Cancelar
      </Button>
    </div>
  );
}
