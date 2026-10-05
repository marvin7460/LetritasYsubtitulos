export type ModelSize = 'tiny' | 'base' | 'small';
export type Device = 'webgpu' | 'wasm';
export type DeviceChoice = Device | 'auto';

export interface ModelOption {
  id: ModelSize;
  /** Hugging Face repo. "_timestamped" exports include the cross-attention outputs needed for
   * word-level timestamps (`return_timestamps: 'word'`). The non-timestamped exports can't do it. */
  repo: string;
  label: string;
  parameters: string;
  /** 1–3, shown as stars. */
  quality: 1 | 2 | 3;
  /** 1–3, shown as bolts. */
  speed: 1 | 2 | 3;
  /** Rough download size per device, in MB, used until the real size is fetched from the Hub. */
  approxDownloadMB: Record<Device, number>;
  description: string;
}

export const MODELS: readonly ModelOption[] = [
  {
    id: 'tiny',
    repo: 'onnx-community/whisper-tiny_timestamped',
    label: 'Tiny',
    parameters: '39 M',
    quality: 1,
    speed: 3,
    approxDownloadMB: { webgpu: 120, wasm: 45 },
    description: 'El más ligero. Ideal para probar o para equipos con poca memoria.',
  },
  {
    id: 'base',
    repo: 'onnx-community/whisper-base_timestamped',
    label: 'Base',
    parameters: '74 M',
    quality: 2,
    speed: 2,
    approxDownloadMB: { webgpu: 210, wasm: 80 },
    description: 'El equilibrio recomendado entre velocidad y precisión.',
  },
  {
    id: 'small',
    repo: 'onnx-community/whisper-small_timestamped',
    label: 'Small',
    parameters: '244 M',
    quality: 3,
    speed: 1,
    approxDownloadMB: { webgpu: 600, wasm: 250 },
    description: 'El más preciso. Necesita una buena GPU y más memoria.',
  },
];

export const DEFAULT_MODEL: ModelSize = 'base';

export function getModel(id: ModelSize): ModelOption {
  const model = MODELS.find((m) => m.id === id);
  if (!model) throw new Error(`Unknown model: ${id}`);
  return model;
}

/**
 * Precision per device:
 * - WebGPU: fp32 encoder (quality) + 4-bit decoder (the decoder runs once per token, so it's the
 *   bottleneck; q4 makes it faster and smaller). fp16 decoders are known to break on WebGPU.
 * - WASM: 8-bit everywhere — smaller downloads and faster CPU matmuls.
 */
export const DEVICE_DTYPES: Record<Device, string | Record<string, string>> = {
  webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  wasm: 'q8',
};

/** Suggests a model for this device. Low-memory devices get the tiny model. */
export function recommendModel(device: Device, deviceMemoryGB?: number): ModelSize {
  if (deviceMemoryGB !== undefined && deviceMemoryGB <= 2) return 'tiny';
  return device === 'webgpu' ? 'base' : 'tiny';
}
