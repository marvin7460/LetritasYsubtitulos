import { create } from 'zustand';
import type { StreamTargetChunk } from 'mediabunny';
import { getEmojiMap } from '../components/preview/emojiCache';
import { toAppError } from '../lib/errors';
import { estimateRemainingSeconds, type ProgressSample } from '../lib/exportVideo/eta';
import type { Container, ExportPlan } from '../lib/exportVideo/plan';
import { baseName, downloadBlob } from '../lib/util/download';
import { useAppStore } from './store';

export type ExportStatus = 'idle' | 'exporting' | 'done' | 'error';

interface VideoExportState {
  status: ExportStatus;
  progress: number;
  etaSeconds: number | null;
  plan: ExportPlan | null;
  result: {
    url: string | null;
    filename: string;
    size: number | null;
    hasAudio: boolean;
    seconds: number;
  } | null;
}

export const useVideoExport = create<VideoExportState>()(() => ({
  status: 'idle',
  progress: 0,
  etaSeconds: null,
  plan: null,
  result: null,
}));

let controller: AbortController | null = null;

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<WritableStream<StreamTargetChunk>> }>;
}

export function canSaveToDisk(): boolean {
  return typeof (window as SaveFilePickerWindow).showSaveFilePicker === 'function';
}

/**
 * Exports the video with burned-in captions. When `saveToDisk` is on (Chrome/Edge), the user
 * picks the destination first and the file is streamed there, so even long videos don't have
 * to fit in memory. Must be called from a click handler (the picker needs a user gesture).
 */
export async function startVideoExport(container: Container, saveToDisk: boolean): Promise<void> {
  const { media, doc } = useAppStore.getState();
  if (!media || !doc) return;
  const extension = container === 'mp4' ? 'mp4' : 'webm';
  let filename = `${baseName(media.name)}-subtitulado.${extension}`;

  let writable: WritableStream<StreamTargetChunk> | undefined;
  if (saveToDisk && canSaveToDisk()) {
    try {
      const handle = await (window as SaveFilePickerWindow).showSaveFilePicker?.({
        suggestedName: filename,
        types: [
          {
            description: container === 'mp4' ? 'Video MP4' : 'Video WebM',
            accept: { [`video/${extension}`]: [`.${extension}`] },
          },
        ],
      });
      writable = await handle?.createWritable();
    } catch {
      return; // The user closed the picker.
    }
  }

  controller?.abort();
  const current = new AbortController();
  controller = current;
  const started = performance.now();
  const samples: ProgressSample[] = [];
  useVideoExport.setState({
    status: 'exporting',
    progress: 0,
    etaSeconds: null,
    result: null,
    plan: null,
  });
  useAppStore.setState({ error: null });

  try {
    const { burnIn } = await import('../lib/exportVideo/burnIn');
    const { blob, plan, hasAudio } = await burnIn({
      file: media.file,
      captions: doc.captions,
      rules: doc.rules,
      style: doc.style,
      emojis: getEmojiMap(doc.captions, doc.style.emojis),
      width: media.info.width,
      height: media.info.height,
      duration: media.info.duration,
      container,
      ...(writable ? { writable } : {}),
      signal: current.signal,
      onProgress: (progress) => {
        samples.push({ progress, time: performance.now() });
        if (samples.length > 300) samples.splice(0, samples.length - 300);
        useVideoExport.setState({ progress, etaSeconds: estimateRemainingSeconds(samples) });
      },
    });
    if (plan.container !== container) filename = filename.replace(/\.\w+$/, `.${plan.container}`);
    const url = blob ? URL.createObjectURL(blob) : null;
    if (blob) downloadBlob(blob, filename);
    useVideoExport.setState({
      status: 'done',
      progress: 1,
      plan,
      result: {
        url,
        filename,
        size: blob?.size ?? null,
        hasAudio,
        seconds: (performance.now() - started) / 1000,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      useVideoExport.setState({ status: 'idle', progress: 0, etaSeconds: null });
      return;
    }
    useVideoExport.setState({ status: 'error' });
    useAppStore.setState({ error: toAppError(error, 'export-failed') });
  } finally {
    if (controller === current) controller = null;
  }
}

export function cancelVideoExport(): void {
  controller?.abort();
}

export function resetVideoExport(): void {
  const { result } = useVideoExport.getState();
  if (result?.url) URL.revokeObjectURL(result.url);
  useVideoExport.setState({
    status: 'idle',
    progress: 0,
    etaSeconds: null,
    result: null,
    plan: null,
  });
}
