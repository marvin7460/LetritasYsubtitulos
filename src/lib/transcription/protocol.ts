import type { RawWordChunk } from '../captions/sanitize';
import type { AppErrorData } from '../errors';
import type { Device, ModelSize } from './models';

export type LanguageChoice = 'auto' | 'es' | 'en';

export interface Capabilities {
  webgpu: boolean;
  /** WebGPU `shader-f16` support. */
  fp16: boolean;
  crossOriginIsolated: boolean;
  threads: number;
}

export interface ModelInspection {
  model: ModelSize;
  device: Device;
  /** Total download size in bytes, or null when it couldn't be determined (offline, blocked…). */
  totalBytes: number | null;
  cached: boolean;
}

export interface TranscriptionResult {
  chunks: RawWordChunk[];
  text: string;
  /** ISO 639-1 code actually used ("es", "en", …). */
  language: string;
  /** Probability of the detected language when it was auto-detected, null otherwise. */
  languageProbability: number | null;
  device: Device;
  model: ModelSize;
  audioSeconds: number;
  transcribeMs: number;
}

export type WorkerRequest =
  | { type: 'probe'; requestId: number }
  | { type: 'inspect'; requestId: number; model: ModelSize; device: Device }
  | { type: 'load'; requestId: number; model: ModelSize; device: Device }
  | {
      type: 'transcribe';
      requestId: number;
      model: ModelSize;
      device: Device;
      audio: Float32Array;
      language: LanguageChoice;
    };

export type WorkerResponse =
  | { type: 'probe-result'; requestId: number; capabilities: Capabilities }
  | { type: 'inspect-result'; requestId: number; inspection: ModelInspection }
  | { type: 'load-progress'; requestId: number; loaded: number; total: number }
  | { type: 'loaded'; requestId: number; device: Device; loadMs: number }
  | { type: 'language-detected'; requestId: number; language: string; probability: number }
  | { type: 'transcribe-progress'; requestId: number; progress: number; partialText: string }
  | { type: 'transcribe-result'; requestId: number; result: TranscriptionResult }
  | { type: 'warning'; requestId: number; message: string }
  | { type: 'error'; requestId: number; error: AppErrorData };

/** What the worker delegates to: the real Whisper engine, or a deterministic mock for E2E tests. */
export interface TranscriptionEngine {
  probe(): Promise<Capabilities>;
  inspect(model: ModelSize, device: Device): Promise<ModelInspection>;
  load(
    model: ModelSize,
    device: Device,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<{ device: Device; loadMs: number }>;
  transcribe(
    audio: Float32Array,
    options: { model: ModelSize; device: Device; language: LanguageChoice },
    callbacks: {
      onLanguage: (language: string, probability: number) => void;
      onProgress: (progress: number, partialText: string) => void;
      onWarning: (message: string) => void;
    },
  ): Promise<TranscriptionResult>;
}
