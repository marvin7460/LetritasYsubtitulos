import {
  env,
  ModelRegistry,
  pipeline,
  Tensor,
  WhisperTextStreamer,
  type AutomaticSpeechRecognitionPipeline,
  type WhisperTokenizer,
} from '@huggingface/transformers';
import type { RawWordChunk } from '../captions/sanitize';
import { AppError, looksLikeOutOfMemory, toAppError } from '../errors';
import { DEVICE_DTYPES, getModel, type Device, type ModelSize } from './models';
import type {
  Capabilities,
  LanguageChoice,
  ModelInspection,
  TranscriptionEngine,
  TranscriptionResult,
} from './protocol';

const TASK = 'automatic-speech-recognition';
const SAMPLE_RATE = 16_000;
const CHUNK_SECONDS = 30;
const STRIDE_SECONDS = 5;

env.allowLocalModels = false;
const customHost = import.meta.env.VITE_MODEL_HOST as string | undefined;
if (customHost) env.remoteHost = customHost;

interface WhisperGenerationConfig {
  decoder_start_token_id: number;
  lang_to_id: Record<string, number>;
}

interface LoadedPipeline {
  key: string;
  device: Device;
  pipe: AutomaticSpeechRecognitionPipeline;
}

/** Real engine: Whisper running locally with Transformers.js (ONNX Runtime Web). */
export function createWhisperEngine(): TranscriptionEngine {
  let loaded: LoadedPipeline | null = null;

  async function probe(): Promise<Capabilities> {
    let webgpu = false;
    let fp16 = false;
    // `navigator.gpu` is typed as always present, but it's missing in browsers without WebGPU.
    const gpu = 'gpu' in navigator ? (navigator.gpu as GPU | undefined) : undefined;
    try {
      const adapter = gpu ? await gpu.requestAdapter() : null;
      webgpu = adapter !== null;
      fp16 = adapter?.features.has('shader-f16') ?? false;
    } catch {
      // requestAdapter can throw on blocklisted drivers: treat as "no WebGPU".
    }
    return {
      webgpu,
      fp16,
      crossOriginIsolated: globalThis.crossOriginIsolated,
      threads: navigator.hardwareConcurrency,
    };
  }

  async function inspect(model: ModelSize, device: Device): Promise<ModelInspection> {
    const { repo } = getModel(model);
    const options = { dtype: DEVICE_DTYPES[device] as never, device };
    try {
      const files = await ModelRegistry.get_pipeline_files(TASK, repo, options);
      const metadata = await Promise.all(
        files.map((file) => ModelRegistry.get_file_metadata(repo, file)),
      );
      const totalBytes = metadata.reduce((sum, m) => sum + (m.size ?? 0), 0);
      const cached = metadata.every((m) => m.fromCache === true);
      return { model, device, totalBytes: totalBytes > 0 ? totalBytes : null, cached };
    } catch {
      const cached = await ModelRegistry.is_pipeline_cached(TASK, repo, options).catch(() => false);
      return { model, device, totalBytes: null, cached };
    }
  }

  async function load(
    model: ModelSize,
    device: Device,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<{ device: Device; loadMs: number }> {
    const key = `${model}:${device}`;
    if (loaded?.key === key) return { device: loaded.device, loadMs: 0 };
    if (loaded) {
      await loaded.pipe.dispose();
      loaded = null;
    }
    const started = performance.now();
    const { repo } = getModel(model);
    try {
      const pipe: AutomaticSpeechRecognitionPipeline = await pipeline(TASK, repo, {
        device,
        dtype: DEVICE_DTYPES[device] as never,
        progress_callback: (info) => {
          if (info.status === 'progress_total') onProgress(info.loaded, info.total);
        },
      });
      loaded = { key, device, pipe };
      return { device, loadMs: performance.now() - started };
    } catch (error) {
      throw classifyLoadError(error);
    }
  }

  async function transcribe(
    audio: Float32Array,
    options: { model: ModelSize; device: Device; language: LanguageChoice },
    callbacks: Parameters<TranscriptionEngine['transcribe']>[2],
  ): Promise<TranscriptionResult> {
    await load(options.model, options.device, () => undefined);
    if (!loaded) throw new AppError('transcription-failed', 'pipeline not loaded');
    const { pipe, device } = loaded;
    const audioSeconds = audio.length / SAMPLE_RATE;
    const started = performance.now();

    try {
      let language: string = options.language;
      let languageProbability: number | null = null;
      if (options.language === 'auto') {
        const detected = await detectLanguage(pipe, audio);
        language = detected.language;
        languageProbability = detected.probability;
        callbacks.onLanguage(detected.language, detected.probability);
      }

      // Progress: the pipeline processes 30 s windows that advance by 20 s (30 − 2 × 5 s stride).
      // The streamer tells us when a window finishes and which timestamp it has reached.
      const jump = CHUNK_SECONDS - 2 * STRIDE_SECONDS;
      let windowIndex = 0;
      let windowTime = 0;
      let partialText = '';
      const report = () => {
        const done = Math.min(
          audioSeconds,
          windowIndex * jump + Math.min(windowTime, CHUNK_SECONDS),
        );
        callbacks.onProgress(
          audioSeconds > 0 ? Math.min(0.99, done / audioSeconds) : 0,
          partialText.slice(-240),
        );
      };
      const streamer = new WhisperTextStreamer(pipe.tokenizer as WhisperTokenizer, {
        skip_prompt: true,
        callback_function: (text: string) => {
          partialText += text;
          report();
        },
        on_chunk_start: (time: number) => {
          windowTime = time;
          report();
        },
        on_finalize: () => {
          windowIndex++;
          windowTime = 0;
          report();
        },
      });

      const output = await pipe(audio, {
        language,
        task: 'transcribe',
        return_timestamps: 'word',
        chunk_length_s: CHUNK_SECONDS,
        stride_length_s: STRIDE_SECONDS,
        streamer,
      });
      const result = (Array.isArray(output) ? output[0] : output) as
        { text: string; chunks?: { text: string; timestamp: (number | null)[] }[] } | undefined;
      const chunks: RawWordChunk[] = (result?.chunks ?? []).map((chunk) => ({
        text: chunk.text,
        timestamp: chunk.timestamp,
      }));
      return {
        chunks,
        text: result?.text ?? '',
        language,
        languageProbability,
        device,
        model: options.model,
        audioSeconds,
        transcribeMs: performance.now() - started,
      };
    } catch (error) {
      const appError = toAppError(error, 'transcription-failed');
      if (appError.code === 'out-of-memory' || looksLikeOutOfMemory(appError.detail ?? '')) {
        // The GPU device may be lost: drop the pipeline so the next attempt starts clean.
        loaded = null;
      }
      throw appError;
    }
  }

  return { probe, inspect, load, transcribe };
}

/**
 * Spoken-language identification, like `model.detect_language()` in Python: run the encoder on
 * 30 s of speech, feed only `<|startoftranscript|>` to the decoder, and compare the logits of
 * the language tokens (<|es|>, <|en|>, …). Transformers.js doesn't do this on its own: without
 * an explicit language, multilingual Whisper silently defaults to English.
 */
async function detectLanguage(
  pipe: AutomaticSpeechRecognitionPipeline,
  audio: Float32Array,
): Promise<{ language: string; probability: number }> {
  const config = (pipe.model as unknown as { generation_config: WhisperGenerationConfig | null })
    .generation_config;
  if (!config?.lang_to_id) return { language: 'en', probability: 0 };

  const start = firstSpeechSample(audio);
  const window = audio.subarray(start, start + CHUNK_SECONDS * SAMPLE_RATE);
  const features = (await (pipe.processor as unknown as (a: Float32Array) => Promise<object>)(
    window,
  )) as Record<string, unknown>;
  const decoderInputIds = new Tensor(
    'int64',
    BigInt64Array.from([BigInt(config.decoder_start_token_id)]),
    [1, 1],
  );
  const callModel = pipe.model as unknown as (
    inputs: Record<string, unknown>,
  ) => Promise<{ logits: { data: Float32Array; dims: number[] } }>;
  const { logits } = await callModel({ ...features, decoder_input_ids: decoderInputIds });

  const vocabSize = logits.dims.at(-1) ?? logits.data.length;
  const offset = logits.data.length - vocabSize; // logits of the last (only) position
  const candidates = Object.entries(config.lang_to_id).map(([token, id]) => ({
    language: token.slice(2, -2),
    logit: logits.data[offset + id] ?? -Infinity,
  }));
  const maxLogit = Math.max(...candidates.map((c) => c.logit));
  const sum = candidates.reduce((acc, c) => acc + Math.exp(c.logit - maxLogit), 0);
  const best = candidates.reduce((a, b) => (b.logit > a.logit ? b : a));
  return { language: best.language, probability: Math.exp(best.logit - maxLogit) / sum };
}

/** Index of the first 100 ms block with audible energy (skips silent intros). */
function firstSpeechSample(audio: Float32Array): number {
  const block = SAMPLE_RATE / 10;
  for (let start = 0; start + block <= audio.length; start += block) {
    let energy = 0;
    for (let i = start; i < start + block; i++) energy += (audio[i] ?? 0) ** 2;
    if (Math.sqrt(energy / block) > 0.01) return Math.max(0, start - block * 5);
  }
  return 0;
}

function classifyLoadError(error: unknown): AppError {
  const appError = toAppError(error, 'model-download-failed');
  if (appError.code === 'out-of-memory') return appError;
  const detail = appError.detail ?? '';
  if (!navigator.onLine) return new AppError('offline-model-missing', detail);
  if (/webgpu|adapter|gpu/i.test(detail)) return new AppError('webgpu-unavailable', detail);
  if (/fetch|network|404|401|403|failed to load|could not locate/i.test(detail)) {
    return new AppError('model-download-failed', detail);
  }
  return new AppError('transcription-failed', detail);
}
