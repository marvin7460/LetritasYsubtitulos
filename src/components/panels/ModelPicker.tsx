import { Check, HardDrive, Star, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatBytes } from '../../lib/media/validate';
import { MODELS, type Device, type ModelSize } from '../../lib/transcription/models';
import type { ModelInspection } from '../../lib/transcription/protocol';
import { readSpeed } from '../../lib/transcription/speedHistory';
import { transcriber } from '../../state/actions';

export interface ModelPickerProps {
  value: ModelSize;
  device: Device;
  disabled?: boolean;
  onChange: (model: ModelSize) => void;
}

/** Model cards: real download size (asked to the Hub), cache status and measured speed. */
export function ModelPicker({ value, device, disabled, onChange }: ModelPickerProps) {
  const inspections = useModelInspections(device);
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Modelo de IA</legend>
      {MODELS.map((model) => {
        const inspection = inspections[model.id];
        const selected = model.id === value;
        const speed = readSpeed(model.id, device);
        const size =
          inspection?.totalBytes != null
            ? formatBytes(inspection.totalBytes)
            : `~${model.approxDownloadMB[device]} MB`;
        return (
          <label
            key={model.id}
            className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
              selected
                ? 'border-brand bg-brand/10'
                : 'border-line bg-surface-2/50 hover:border-muted'
            }`}
          >
            <input
              type="radio"
              name="model"
              value={model.id}
              checked={selected}
              onChange={() => onChange(model.id)}
              className="mt-1 accent-brand"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{model.label}</span>
                <span className="text-xs text-muted">{model.parameters} parámetros</span>
                {inspection?.cached && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok">
                    <Check className="size-3" aria-hidden /> Descargado
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{model.description}</span>
              <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1" title="Tamaño de descarga">
                  <HardDrive className="size-3" aria-hidden /> {size}
                </span>
                <span
                  className="inline-flex items-center gap-0.5"
                  aria-label={`Velocidad ${model.speed} de 3`}
                >
                  {Array.from({ length: 3 }, (_, i) => (
                    <Zap
                      key={i}
                      className={`size-3 ${i < model.speed ? 'text-brand' : 'opacity-30'}`}
                      aria-hidden
                    />
                  ))}
                </span>
                <span
                  className="inline-flex items-center gap-0.5"
                  aria-label={`Precisión ${model.quality} de 3`}
                >
                  {Array.from({ length: 3 }, (_, i) => (
                    <Star
                      key={i}
                      className={`size-3 ${i < model.quality ? 'text-violet' : 'opacity-30'}`}
                      aria-hidden
                    />
                  ))}
                </span>
                {speed !== null && (
                  <span>En tu equipo: ~{speed.toFixed(speed < 10 ? 1 : 0)}× tiempo real</span>
                )}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function useModelInspections(device: Device): Partial<Record<ModelSize, ModelInspection>> {
  const [result, setResult] = useState<{
    device: Device;
    data: Partial<Record<ModelSize, ModelInspection>>;
  }>({
    device,
    data: {},
  });
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      MODELS.map((model) => transcriber.inspect(model.id, device).catch(() => null)),
    ).then((inspections) => {
      if (cancelled) return;
      const data: Partial<Record<ModelSize, ModelInspection>> = {};
      for (const inspection of inspections) if (inspection) data[inspection.model] = inspection;
      setResult({ device, data });
    });
    return () => {
      cancelled = true;
    };
  }, [device]);
  return result.device === device ? result.data : {};
}
