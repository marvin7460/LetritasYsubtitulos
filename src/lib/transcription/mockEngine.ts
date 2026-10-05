import type { RawWordChunk } from '../captions/sanitize';
import type { Device, ModelSize } from './models';
import type {
  Capabilities,
  ModelInspection,
  TranscriptionEngine,
  TranscriptionResult,
} from './protocol';

/**
 * Deterministic stand-in for Whisper, used by the E2E tests (CI machines have no GPU and can't
 * download 100+ MB models on every run). It is only bundled in `--mode e2e` builds.
 */
export const MOCK_TRANSCRIPT =
  'Hola a todos, bienvenidos a Letritas. Hoy les muestro cómo crear subtítulos animados en segundos. ¡Y todo funciona en tu navegador, sin subir nada!';

const SAMPLE_RATE = 16_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Spreads the transcript's words evenly over the audio, leaving a short margin at both ends. */
export function mockWordChunks(audioSeconds: number, transcript = MOCK_TRANSCRIPT): RawWordChunk[] {
  const words = transcript.split(/\s+/).filter(Boolean);
  const start = Math.min(0.4, audioSeconds * 0.05);
  const end = Math.max(start + 0.1, audioSeconds - Math.min(0.4, audioSeconds * 0.05));
  const slot = (end - start) / words.length;
  return words.map((word, index) => {
    const wordStart = start + index * slot;
    return {
      text: ` ${word}`,
      timestamp: [round(wordStart), round(wordStart + slot * 0.85)],
    };
  });
}

export function createMockEngine(): TranscriptionEngine {
  const loadedModels = new Set<string>();

  return {
    probe(): Promise<Capabilities> {
      return Promise.resolve({
        webgpu: true,
        fp16: false,
        crossOriginIsolated: globalThis.crossOriginIsolated,
        threads: 4,
      });
    },

    inspect(model: ModelSize, device: Device): Promise<ModelInspection> {
      return Promise.resolve({
        model,
        device,
        totalBytes: 42 * 1024 * 1024,
        cached: loadedModels.has(`${model}:${device}`),
      });
    },

    async load(model, device, onProgress) {
      const total = 42 * 1024 * 1024;
      for (let step = 1; step <= 4; step++) {
        await delay(40);
        onProgress((total * step) / 4, total);
      }
      loadedModels.add(`${model}:${device}`);
      return { device, loadMs: 160 };
    },

    async transcribe(audio, options, callbacks): Promise<TranscriptionResult> {
      const audioSeconds = audio.length / SAMPLE_RATE;
      const language = options.language === 'auto' ? 'es' : options.language;
      if (options.language === 'auto') callbacks.onLanguage('es', 0.97);
      const chunks = mockWordChunks(audioSeconds);
      for (let step = 1; step <= 5; step++) {
        await delay(60);
        const partial = chunks
          .slice(0, Math.round((chunks.length * step) / 5))
          .map((c) => c.text)
          .join('');
        callbacks.onProgress(Math.min(0.99, step / 5), partial);
      }
      return {
        chunks,
        text: chunks.map((c) => c.text).join(''),
        language,
        languageProbability: options.language === 'auto' ? 0.97 : null,
        device: options.device,
        model: options.model,
        audioSeconds,
        transcribeMs: 300,
      };
    },
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
