import { AppError, toAppError } from '../errors';
import { MAX_DURATION_SECONDS } from '../media/validate';
import { computePeaks } from './peaks';
import {
  TARGET_SAMPLE_RATE,
  type ExtractRequest,
  type ExtractResponse,
  type ExtractedAudio,
  type MediaInfo,
} from './types';

/** The Web Audio fallback reads the whole file into memory, so keep it for small-ish files. */
const WEB_AUDIO_MAX_BYTES = 1024 ** 3;

class RecoverableExtractError extends Error {
  readonly appError: AppError;
  constructor(appError: AppError) {
    super(appError.message);
    this.appError = appError;
  }
}

/**
 * Extracts 16 kHz mono audio + metadata from a media file.
 * 1. Mediabunny + WebCodecs in a worker (streaming, low memory, any container it understands).
 * 2. Fallback: the browser's own `decodeAudioData` (e.g. Safari versions without AudioDecoder).
 */
export async function extractAudio(
  file: File,
  onProgress: (progress: number) => void = () => undefined,
  signal?: AbortSignal,
): Promise<ExtractedAudio> {
  try {
    return await extractInWorker(file, onProgress, signal);
  } catch (error) {
    if (!(error instanceof RecoverableExtractError)) throw error;
    if (signal?.aborted) throw error.appError;
    try {
      return await extractWithWebAudio(file, onProgress);
    } catch (fallbackError) {
      console.warn('Web Audio fallback failed', fallbackError);
      throw error.appError;
    }
  }
}

function extractInWorker(
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<ExtractedAudio> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/extractAudio.worker.ts', import.meta.url), {
      type: 'module',
    });
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      finish();
      reject(new DOMException('Extraction aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (event: MessageEvent<ExtractResponse>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress(message.progress);
      } else if (message.type === 'done') {
        finish();
        resolve(message.result);
      } else {
        finish();
        const appError = AppError.fromData(message.error);
        reject(message.recoverable ? new RecoverableExtractError(appError) : appError);
      }
    };
    worker.onerror = (event) => {
      finish();
      reject(new RecoverableExtractError(new AppError('decode-failed', event.message)));
    };
    const request: ExtractRequest = { type: 'extract', file };
    worker.postMessage(request);
  });
}

async function extractWithWebAudio(
  file: File,
  onProgress: (progress: number) => void,
): Promise<ExtractedAudio> {
  if (file.size > WEB_AUDIO_MAX_BYTES) throw new AppError('file-too-large', 'web audio fallback');
  const probe = await probeWithMediaElement(file);
  if (probe.duration > MAX_DURATION_SECONDS) throw new AppError('media-too-long');
  onProgress(0.1);

  try {
    const bytes = await file.arrayBuffer();
    onProgress(0.3);
    // Decoding through a 16 kHz context makes the browser resample for us.
    const context = new OfflineAudioContext({
      numberOfChannels: 1,
      length: 1,
      sampleRate: TARGET_SAMPLE_RATE,
    });
    const buffer = await context.decodeAudioData(bytes);
    const samples = new Float32Array(buffer.length);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const channel = buffer.getChannelData(c);
      for (let i = 0; i < samples.length; i++) samples[i] = (samples[i] ?? 0) + (channel[i] ?? 0);
    }
    if (buffer.numberOfChannels > 1) {
      for (let i = 0; i < samples.length; i++)
        samples[i] = (samples[i] ?? 0) / buffer.numberOfChannels;
    }
    onProgress(1);
    const info: MediaInfo = {
      ...probe,
      hasAudio: true,
      duration: probe.duration || buffer.duration,
    };
    return { info, samples, peaks: computePeaks(samples, TARGET_SAMPLE_RATE) };
  } catch (error) {
    throw toAppError(error, 'decode-failed');
  }
}

/** Reads duration and size through a detached <video> element (no decoding of the full file). */
export function probeWithMediaElement(file: Blob): Promise<MediaInfo> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const done = (info: MediaInfo) => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve(info);
    };
    video.onloadedmetadata = () => {
      done({
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        hasVideo: video.videoWidth > 0,
        hasAudio: true,
        width: video.videoWidth,
        height: video.videoHeight,
        videoCodec: null,
        audioCodec: null,
      });
    };
    video.onerror = () => {
      done({
        duration: 0,
        hasVideo: false,
        hasAudio: true,
        width: 0,
        height: 0,
        videoCodec: null,
        audioCodec: null,
      });
    };
    video.src = url;
  });
}
