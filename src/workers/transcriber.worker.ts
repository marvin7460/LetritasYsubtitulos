import { AppError, toAppError } from '../lib/errors';
import type { Device, ModelSize } from '../lib/transcription/models';
import type {
  TranscriptionEngine,
  WorkerRequest,
  WorkerResponse,
} from '../lib/transcription/protocol';
import { workerScope } from './workerScope';

/**
 * Transcription worker. Whisper inference blocks for seconds at a time, so it must never run on
 * the main thread. The engine is picked at build time: `--mode e2e` bundles the deterministic
 * mock; every other build bundles the real Whisper engine (the mock is tree-shaken away).
 */
const scope = workerScope<WorkerRequest, WorkerResponse>();

const enginePromise: Promise<TranscriptionEngine> =
  import.meta.env.MODE === 'e2e'
    ? import('../lib/transcription/mockEngine').then((m) => m.createMockEngine())
    : import('../lib/transcription/whisperEngine').then((m) => m.createWhisperEngine());

function send(message: WorkerResponse): void {
  scope.postMessage(message);
}

scope.addEventListener('message', (event) => {
  const request = event.data;
  void handle(request).catch((error: unknown) => {
    send({ type: 'error', requestId: request.requestId, error: toAppError(error).toData() });
  });
});

async function handle(request: WorkerRequest): Promise<void> {
  const engine = await enginePromise;
  const { requestId } = request;
  switch (request.type) {
    case 'probe': {
      send({ type: 'probe-result', requestId, capabilities: await engine.probe() });
      return;
    }
    case 'inspect': {
      const inspection = await engine.inspect(request.model, request.device);
      send({ type: 'inspect-result', requestId, inspection });
      return;
    }
    case 'load': {
      const result = await loadWithFallback(engine, request.model, request.device, requestId);
      send({ type: 'loaded', requestId, device: result.device, loadMs: result.loadMs });
      return;
    }
    case 'transcribe': {
      const result = await engine.transcribe(
        request.audio,
        { model: request.model, device: request.device, language: request.language },
        {
          onLanguage: (language, probability) =>
            send({ type: 'language-detected', requestId, language, probability }),
          onProgress: (progress, partialText) =>
            send({ type: 'transcribe-progress', requestId, progress, partialText }),
          onWarning: (message) => send({ type: 'warning', requestId, message }),
        },
      );
      send({ type: 'transcribe-result', requestId, result });
      return;
    }
  }
}

/** If WebGPU fails to initialize (driver issues, blocklisted GPU…), fall back to WASM. */
async function loadWithFallback(
  engine: TranscriptionEngine,
  model: ModelSize,
  device: Device,
  requestId: number,
): Promise<{ device: Device; loadMs: number }> {
  const onProgress = (loaded: number, total: number) =>
    send({ type: 'load-progress', requestId, loaded, total });
  try {
    return await engine.load(model, device, onProgress);
  } catch (error) {
    const appError = toAppError(error);
    const canFallBack =
      device === 'webgpu' &&
      appError.code !== 'model-download-failed' &&
      appError.code !== 'offline-model-missing';
    if (!canFallBack) throw appError;
    send({
      type: 'warning',
      requestId,
      message: 'WebGPU no pudo iniciarse en este equipo; usamos WASM (más lento, pero funciona).',
    });
    try {
      return await engine.load(model, 'wasm', onProgress);
    } catch (fallbackError) {
      throw fallbackError instanceof AppError ? fallbackError : toAppError(fallbackError);
    }
  }
}
