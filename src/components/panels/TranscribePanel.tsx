import { Languages, LoaderCircle, Wand2 } from 'lucide-react';
import { formatBytes, formatDuration } from '../../lib/media/validate';
import { languageName } from '../../lib/util/format';
import {
  cancelTranscription,
  resolveDevice,
  startTranscription,
  updateSettings,
} from '../../state/actions';
import { useAppStore } from '../../state/store';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { ModelPicker } from './ModelPicker';

export function TranscribePanel() {
  const settings = useAppStore((s) => s.settings);
  const capabilities = useAppStore((s) => s.capabilities);
  const transcription = useAppStore((s) => s.transcription);
  const duration = useAppStore((s) => s.media?.info.duration ?? 0);
  const hasDoc = useAppStore((s) => s.doc !== null);
  const webgpu = capabilities?.webgpu ?? false;
  const device = resolveDevice(settings, webgpu);
  const busy = ['loading-model', 'detecting-language', 'transcribing'].includes(
    transcription.status,
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <Languages className="size-4" aria-hidden /> Idioma
          </span>
          <select
            value={settings.language}
            disabled={busy}
            onChange={(e) =>
              updateSettings({ language: e.target.value as typeof settings.language })
            }
            className="h-10 w-full rounded-lg border border-line bg-surface-2 px-2"
          >
            <option value="auto">Detectar automáticamente</option>
            <option value="es">Español</option>
            <option value="en">Inglés</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Procesador</span>
          <select
            value={settings.device}
            disabled={busy}
            onChange={(e) => updateSettings({ device: e.target.value as typeof settings.device })}
            className="h-10 w-full rounded-lg border border-line bg-surface-2 px-2"
          >
            <option value="auto">Automático ({webgpu ? 'WebGPU' : 'WASM'})</option>
            <option value="webgpu" disabled={!webgpu}>
              WebGPU (tarjeta gráfica){webgpu ? '' : ' — no disponible'}
            </option>
            <option value="wasm">WASM (procesador)</option>
          </select>
        </label>
      </div>

      <ModelPicker
        value={settings.model}
        device={device}
        disabled={busy}
        onChange={(model) => updateSettings({ model })}
      />

      {busy ? (
        <TranscriptionProgress />
      ) : (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => void startTranscription()}
        >
          <Wand2 className="size-5" aria-hidden />
          {hasDoc ? 'Volver a transcribir' : 'Transcribir'}
          <span className="font-normal opacity-70">· {formatDuration(duration)}</span>
        </Button>
      )}
      {hasDoc && !busy && (
        <p className="text-xs text-muted">
          Volver a transcribir reemplaza los subtítulos actuales (puedes deshacerlo).
        </p>
      )}
    </div>
  );
}

function TranscriptionProgress() {
  const t = useAppStore((s) => s.transcription);
  let title = 'Cargando el modelo…';
  let value: number | null = null;
  if (t.status === 'loading-model') {
    if (t.loadTotal > 0) {
      title = `Descargando el modelo… ${formatBytes(t.loadLoaded)} de ${formatBytes(t.loadTotal)}`;
      value = t.loadLoaded / t.loadTotal;
    }
  } else if (t.status === 'detecting-language') {
    title = 'Detectando el idioma…';
  } else {
    title = `Transcribiendo… ${Math.round(t.progress * 100)}%`;
    value = t.progress;
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-2/60 p-4" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium">
        <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
        <span data-testid="transcription-status">{title}</span>
      </div>
      <ProgressBar value={value} label="Progreso de la transcripción" />
      {t.detectedLanguage && (
        <p className="text-xs text-muted">
          Idioma detectado: {languageName(t.detectedLanguage.code)} (
          {Math.round(t.detectedLanguage.probability * 100)}%)
        </p>
      )}
      {t.warning && <p className="text-xs text-warn">{t.warning}</p>}
      {t.partialText && (
        <p className="line-clamp-3 text-sm italic text-muted">“{t.partialText.trim()}”</p>
      )}
      <Button variant="ghost" size="sm" onClick={cancelTranscription}>
        Cancelar
      </Button>
    </div>
  );
}
