import { extractAudio } from '../lib/audio/extractAudio';
import { buildCaptions } from '../lib/captions/buildCaptions';
import { defaultRulesFor, orientationOf } from '../lib/captions/rules';
import { wordsFromChunks } from '../lib/captions/sanitize';
import { AppError, toAppError } from '../lib/errors';
import { mediaKindOf, validateMediaFile } from '../lib/media/validate';
import { CLASSIC_STYLE } from '../lib/render/style';
import { isAbortError, TranscriberClient } from '../lib/transcription/client';
import { cleanHallucinations } from '../lib/transcription/hallucinations';
import type { Device } from '../lib/transcription/models';
import { recordSpeed } from '../lib/transcription/speedHistory';
import { replaceDoc } from './editor';
import { pause, usePlayback } from './playback';
import { cancelVideoExport, resetVideoExport } from './videoExport';
import { INITIAL_TRANSCRIPTION, setTranscription, useAppStore, type Settings } from './store';

export const transcriber = new TranscriberClient();
let extractController: AbortController | null = null;

export async function probeCapabilities(): Promise<void> {
  try {
    const capabilities = await transcriber.probe();
    useAppStore.setState({ capabilities });
  } catch (error) {
    console.warn('Capability probe failed', error);
    useAppStore.setState({
      capabilities: { webgpu: false, fp16: false, crossOriginIsolated: false, threads: 1 },
    });
  }
}

/** Validates the file, extracts its audio and opens the workspace. */
export async function loadMediaFile(file: File): Promise<void> {
  const invalid = validateMediaFile(file);
  if (invalid) {
    useAppStore.setState({ error: invalid });
    return;
  }
  closeMedia();
  useAppStore.setState({ stage: 'loading-media', extractProgress: 0, error: null });
  const controller = new AbortController();
  extractController = controller;

  try {
    const { info, samples, peaks } = await extractAudio(
      file,
      (extractProgress) => useAppStore.setState({ extractProgress }),
      controller.signal,
    );
    if (controller.signal.aborted) return;
    const kind = info.hasVideo ? 'video' : mediaKindOf(file);
    useAppStore.setState({
      stage: 'workspace',
      media: { file, url: URL.createObjectURL(file), kind, name: file.name, info },
      audio: { samples, peaks },
      extractProgress: 1,
    });
  } catch (error) {
    if (isAbortError(error)) return;
    useAppStore.setState({ stage: 'empty', error: toAppError(error, 'decode-failed') });
  } finally {
    if (extractController === controller) extractController = null;
  }
}

/** Goes back to the start screen, releasing the media and cancelling any running work. */
export function closeMedia(): void {
  extractController?.abort();
  extractController = null;
  transcriber.cancel();
  pause();
  cancelVideoExport();
  resetVideoExport();
  const { media } = useAppStore.getState();
  if (media) URL.revokeObjectURL(media.url);
  usePlayback.setState({ currentTime: 0, duration: 0, playing: false, activeCaptionId: null });
  useAppStore.setState({
    stage: 'empty',
    media: null,
    audio: null,
    doc: null,
    history: null,
    projectId: null,
    saveStatus: 'idle',
    isDemo: false,
    extractProgress: 0,
    transcription: INITIAL_TRANSCRIPTION,
  });
}

export function updateSettings(patch: Partial<Settings>): void {
  useAppStore.setState((state) => ({ settings: { ...state.settings, ...patch } }));
}

export function resolveDevice(settings: Settings, webgpuAvailable: boolean): Device {
  if (settings.device === 'auto') return webgpuAvailable ? 'webgpu' : 'wasm';
  return settings.device;
}

export async function startTranscription(): Promise<void> {
  const { audio, media, settings, capabilities, doc } = useAppStore.getState();
  if (!audio || !media) return;
  const device = resolveDevice(settings, capabilities?.webgpu ?? false);
  useAppStore.setState({ error: null });
  setTranscription({ ...INITIAL_TRANSCRIPTION, status: 'loading-model' });

  let loadMs = 0;
  try {
    const result = await transcriber.transcribe(
      audio.samples,
      { model: settings.model, device, language: settings.language },
      {
        onLoadProgress: (loadLoaded, loadTotal) => setTranscription({ loadLoaded, loadTotal }),
        onLoaded: (_device, ms) => {
          loadMs = ms;
          setTranscription({
            status: settings.language === 'auto' ? 'detecting-language' : 'transcribing',
          });
        },
        onLanguage: (code, probability) =>
          setTranscription({ detectedLanguage: { code, probability }, status: 'transcribing' }),
        onProgress: (progress, partialText) =>
          setTranscription({ progress, partialText, status: 'transcribing' }),
        onWarning: (warning) => setTranscription({ warning }),
      },
    );

    const words = cleanHallucinations(wordsFromChunks(result.chunks), media.info.duration);
    if (words.length === 0) throw new AppError('no-speech');

    const rules = doc?.rules ?? defaultRulesFor(orientationOf(media.info.width, media.info.height));
    const captions = buildCaptions(words, rules, { mediaDuration: media.info.duration });
    // Re-transcribing replaces the captions as one undoable step; the style is kept.
    replaceDoc({ captions, rules, style: doc?.style ?? CLASSIC_STYLE, language: result.language });
    setTranscription({
      status: 'done',
      progress: 1,
      stats: {
        model: result.model,
        device: result.device,
        audioSeconds: result.audioSeconds,
        transcribeMs: result.transcribeMs,
        loadMs,
      },
    });
    recordSpeed(result.model, result.device, result.audioSeconds, result.transcribeMs);
  } catch (error) {
    if (isAbortError(error)) {
      setTranscription(INITIAL_TRANSCRIPTION);
      return;
    }
    setTranscription({ status: 'error' });
    useAppStore.setState({ error: toAppError(error, 'transcription-failed') });
  }
}

export function cancelTranscription(): void {
  transcriber.cancel();
  setTranscription(INITIAL_TRANSCRIPTION);
}

export function dismissError(): void {
  useAppStore.setState({ error: null });
}
