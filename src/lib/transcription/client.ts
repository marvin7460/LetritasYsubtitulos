import { AppError } from '../errors';
import type { Device, ModelSize } from './models';
import type {
  Capabilities,
  LanguageChoice,
  ModelInspection,
  TranscriptionResult,
  WorkerRequest,
  WorkerResponse,
} from './protocol';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type RequestBody = DistributiveOmit<WorkerRequest, 'requestId'>;

interface Pending {
  resolve: (message: WorkerResponse) => void;
  reject: (error: Error) => void;
  onMessage?: (message: WorkerResponse) => void;
}

export interface TranscribeCallbacks {
  onLoadProgress?: (loaded: number, total: number) => void;
  onLoaded?: (device: Device, loadMs: number) => void;
  onLanguage?: (language: string, probability: number) => void;
  onProgress?: (progress: number, partialText: string) => void;
  onWarning?: (message: string) => void;
}

/**
 * Promise-based wrapper around the transcription worker. Cancelling terminates the worker:
 * ONNX Runtime can't be interrupted mid-inference, and a fresh worker reloads the model from
 * the browser cache in a few seconds.
 */
export class TranscriberClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('../../workers/transcriber.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.dispatch(event.data);
    worker.onerror = (event) => {
      event.preventDefault();
      this.failAll(new AppError('transcription-failed', event.message || 'worker crashed'));
      this.worker?.terminate();
      this.worker = null;
    };
    this.worker = worker;
    return worker;
  }

  private dispatch(message: WorkerResponse): void {
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    switch (message.type) {
      case 'error':
        this.pending.delete(message.requestId);
        pending.reject(AppError.fromData(message.error));
        return;
      case 'probe-result':
      case 'inspect-result':
      case 'loaded':
      case 'transcribe-result':
        pending.onMessage?.(message);
        this.pending.delete(message.requestId);
        pending.resolve(message);
        return;
      default:
        pending.onMessage?.(message);
    }
  }

  private request(
    body: RequestBody,
    onMessage?: (message: WorkerResponse) => void,
    transfer: Transferable[] = [],
  ) {
    const requestId = this.nextId++;
    const worker = this.getWorker();
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, ...(onMessage ? { onMessage } : {}) });
      const message: WorkerRequest = { ...body, requestId };
      worker.postMessage(message, transfer);
    });
  }

  async probe(): Promise<Capabilities> {
    const message = await this.request({ type: 'probe' });
    if (message.type !== 'probe-result') throw new AppError('unknown', 'unexpected probe response');
    return message.capabilities;
  }

  async inspect(model: ModelSize, device: Device): Promise<ModelInspection> {
    const message = await this.request({ type: 'inspect', model, device });
    if (message.type !== 'inspect-result')
      throw new AppError('unknown', 'unexpected inspect response');
    return message.inspection;
  }

  /** Loads the model (downloading it the first time) and transcribes. */
  async transcribe(
    audio: Float32Array,
    options: { model: ModelSize; device: Device; language: LanguageChoice },
    callbacks: TranscribeCallbacks = {},
  ): Promise<TranscriptionResult> {
    const onMessage = (message: WorkerResponse) => {
      switch (message.type) {
        case 'load-progress':
          callbacks.onLoadProgress?.(message.loaded, message.total);
          break;
        case 'loaded':
          callbacks.onLoaded?.(message.device, message.loadMs);
          break;
        case 'language-detected':
          callbacks.onLanguage?.(message.language, message.probability);
          break;
        case 'transcribe-progress':
          callbacks.onProgress?.(message.progress, message.partialText);
          break;
        case 'warning':
          callbacks.onWarning?.(message.message);
          break;
        default:
          break;
      }
    };

    const loaded = await this.request(
      { type: 'load', model: options.model, device: options.device },
      onMessage,
    );
    const device = loaded.type === 'loaded' ? loaded.device : options.device;
    // Send a copy: the caller keeps its samples (waveform, re-transcription) and the copy's
    // buffer is transferred, not cloned again.
    const copy = audio.slice();
    const message = await this.request(
      { type: 'transcribe', audio: copy, model: options.model, device, language: options.language },
      onMessage,
      [copy.buffer],
    );
    if (message.type !== 'transcribe-result')
      throw new AppError('unknown', 'unexpected transcribe response');
    return message.result;
  }

  /** Stops any running work immediately. */
  cancel(): void {
    this.worker?.terminate();
    this.worker = null;
    this.failAll(new DOMException('Transcription cancelled', 'AbortError'));
  }

  dispose(): void {
    this.cancel();
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
