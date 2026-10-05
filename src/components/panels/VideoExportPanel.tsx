import { Clapperboard, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatEta } from '../../lib/exportVideo/eta';
import type { Container } from '../../lib/exportVideo/plan';
import { formatBytes } from '../../lib/media/validate';
import { useAppStore } from '../../state/store';
import {
  canSaveToDisk,
  cancelVideoExport,
  resetVideoExport,
  startVideoExport,
  useVideoExport,
} from '../../state/videoExport';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';

type Support = Record<Container, boolean> | null;

/** Which containers this browser can actually encode (probed with WebCodecs). */
function useEncodeSupport(width: number, height: number): Support {
  const [support, setSupport] = useState<Support>(null);
  useEffect(() => {
    let cancelled = false;
    void import('../../lib/exportVideo/burnIn').then(async ({ planFor }) => {
      const [mp4, webm] = await Promise.all([
        planFor(width, height, 'mp4'),
        planFor(width, height, 'webm'),
      ]);
      if (!cancelled) {
        setSupport({ mp4: mp4?.container === 'mp4', webm: webm?.container === 'webm' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [width, height]);
  return support;
}

export function VideoExportPanel() {
  const media = useAppStore((s) => s.media);
  const { status, progress, etaSeconds, result, plan } = useVideoExport();
  const support = useEncodeSupport(media?.info.width ?? 0, media?.info.height ?? 0);
  const [saveToDisk, setSaveToDisk] = useState(false);
  if (!media) return null;
  const audioOnly = media.kind === 'audio';

  if (status === 'exporting') {
    return (
      <div
        className="space-y-3 rounded-xl border border-line bg-surface-2/60 p-4"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
          <span data-testid="export-status">
            Creando el video… {Math.round(progress * 100)}% · {formatEta(etaSeconds)}
          </span>
        </div>
        <ProgressBar value={progress} label="Progreso de la exportación" />
        <p className="text-xs text-muted">
          Cada cuadro se dibuja y se codifica aquí, en tu navegador. Puedes seguir en otra pestaña.
        </p>
        <Button size="sm" variant="ghost" onClick={cancelVideoExport}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Clapperboard className="size-4" aria-hidden /> Video con subtítulos quemados
      </h3>
      {audioOnly && (
        <p className="text-xs text-muted">
          Es un audio: crearemos un video vertical con fondo y tus subtítulos animados.
        </p>
      )}

      {support === null ? (
        <p className="text-xs text-muted">Revisando qué formatos puede crear tu navegador…</p>
      ) : !support.mp4 && !support.webm ? (
        <p className="flex gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          Tu navegador no puede codificar video. Descarga los subtítulos de abajo y quémalos con tu
          editor, o abre Letritas en Chrome o Edge.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              data-testid="export-mp4"
              disabled={!support.mp4}
              onClick={() => void startVideoExport('mp4', saveToDisk)}
            >
              MP4 (H.264)
            </Button>
            <Button
              data-testid="export-webm"
              disabled={!support.webm}
              onClick={() => void startVideoExport('webm', saveToDisk)}
            >
              WebM
            </Button>
          </div>
          {!support.mp4 && (
            <p className="text-xs text-muted">
              Este navegador no puede codificar H.264, así que el MP4 no está disponible. WebM
              funciona en YouTube y en la mayoría de los reproductores.
            </p>
          )}
          {canSaveToDisk() && (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={saveToDisk}
                onChange={(e) => setSaveToDisk(e.target.checked)}
              />
              Guardar directamente en el disco (mejor para videos largos)
            </label>
          )}
        </>
      )}

      {status === 'done' && result && (
        <div
          className="space-y-1 rounded-lg border border-ok/30 bg-ok/10 p-3 text-xs"
          data-testid="export-done"
        >
          <p className="font-medium text-ok">
            ¡Listo! {result.filename}
            {result.size !== null && ` · ${formatBytes(result.size)}`} · {result.seconds.toFixed(1)}{' '}
            s
          </p>
          {plan && (
            <p className="text-muted">
              Codificado como {plan.container.toUpperCase()} · {plan.width}×{plan.height}
            </p>
          )}
          {!result.hasAudio && (
            <p className="text-warn">
              El video se exportó sin audio (el navegador no pudo procesarlo).
            </p>
          )}
          <div className="flex gap-3 pt-1">
            {result.url && (
              <a href={result.url} download={result.filename} className="text-fg underline">
                Descargar de nuevo
              </a>
            )}
            <button type="button" onClick={resetVideoExport} className="text-muted underline">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
