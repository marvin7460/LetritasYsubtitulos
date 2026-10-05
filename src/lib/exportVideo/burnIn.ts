import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSource,
  canEncodeVideo,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  StreamTarget,
  WebMOutputFormat,
  type StreamTargetChunk,
  type Target,
} from 'mediabunny';
import type { Caption, LineRules } from '../captions/types';
import { AppError, toAppError } from '../errors';
import { ensureFontLoaded } from '../render/fonts';
import { renderCaptions } from '../render/renderer';
import type { CaptionStyle } from '../render/style';
import { planExport, type Container, type ExportPlan } from './plan';

export interface BurnInOptions {
  file: File;
  captions: readonly Caption[];
  rules: LineRules;
  style: CaptionStyle;
  emojis: ReadonlyMap<string, string>;
  /** Source size; 0×0 for audio-only files (an "audiogram" is generated instead). */
  width: number;
  height: number;
  duration: number;
  container: Container;
  /** Stream straight to a file on disk (File System Access API) instead of building it in RAM. */
  writable?: WritableStream<StreamTargetChunk>;
  onProgress: (progress: number) => void;
  signal: AbortSignal;
}

export interface BurnInResult {
  plan: ExportPlan;
  /** Null when the output was streamed to disk. */
  blob: Blob | null;
  hasAudio: boolean;
}

const AUDIOGRAM_SIZE = { width: 1080, height: 1920 };
const HIGH_QUALITY = new Quality('high');
const AUDIOGRAM_FPS = 30;

export const canEncodeAt = (codec: ExportPlan['videoCodec'], width: number, height: number) =>
  canEncodeVideo(codec, { width, height, quality: HIGH_QUALITY });

/** Which formats can this browser produce for this video? Used to label the export buttons. */
export function planFor(width: number, height: number, container: Container) {
  const size = width > 0 && height > 0 ? { width, height } : AUDIOGRAM_SIZE;
  return planExport(size.width, size.height, container, canEncodeAt);
}

/**
 * Re-encodes the video with the captions drawn into every frame, using WebCodecs through
 * Mediabunny. Each decoded frame goes through the *same* `renderCaptions` the preview uses, so
 * the export matches what the user saw. Audio is copied as-is when the container allows it.
 *
 * Runs on the main thread on purpose: fonts are already loaded there (FontFace in workers is
 * not consistent across browsers). Decoding/encoding happen on WebCodecs' own threads; per frame
 * we only draw on a canvas.
 */
export async function burnIn(options: BurnInOptions): Promise<BurnInResult> {
  const audioOnly = !(options.width > 0 && options.height > 0);
  const plan = await planFor(options.width, options.height, options.container);
  if (!plan) throw new AppError('export-unsupported');
  await ensureFontLoaded(options.style);
  throwIfAborted(options.signal);

  const input = new Input({ source: new BlobSource(options.file), formats: ALL_FORMATS });
  const target: Target = options.writable
    ? new StreamTarget(options.writable, { chunked: true })
    : new BufferTarget();
  const output = new Output({
    format:
      plan.container === 'mp4'
        ? new Mp4OutputFormat({ fastStart: options.writable ? false : 'in-memory' })
        : new WebMOutputFormat(),
    target,
  });

  const { canvas, ctx } = createCanvas(plan.width, plan.height);

  const drawCaptions = (time: number) =>
    renderCaptions(ctx, {
      width: plan.width,
      height: plan.height,
      time,
      captions: options.captions,
      style: options.style,
      rules: options.rules,
      emojis: options.emojis,
    });

  try {
    let hasAudio: boolean;
    if (audioOnly) {
      hasAudio = await runAudiogram(input, output, canvas, ctx, plan, options, drawCaptions);
    } else {
      const conversion = await Conversion.init({
        input,
        output,
        tracks: 'primary',
        showWarnings: false,
        video: {
          codec: plan.videoCodec,
          quality: HIGH_QUALITY,
          forceTranscode: true,
          // Bake rotation into the pixels (phone videos often store it as metadata), so the
          // captions we draw end up upright.
          allowTransformationMetadata: false,
          width: plan.width,
          height: plan.height,
          fit: 'contain',
          process: (sample) => {
            ctx.clearRect(0, 0, plan.width, plan.height);
            sample.draw(ctx, 0, 0, plan.width, plan.height);
            drawCaptions(sample.timestamp);
            return canvas;
          },
          processedWidth: plan.width,
          processedHeight: plan.height,
        },
      });
      if (!conversion.isValid) {
        throw new AppError(
          'export-unsupported',
          conversion.discardedTracks.map((t) => `${t.track.type}: ${t.reason}`).join('; '),
        );
      }
      hasAudio = conversion.utilizedTracks.some((t) => t.isAudioTrack());
      conversion.onProgress = (progress) => options.onProgress(progress);
      // The user may have cancelled while we were preparing: a listener added to an already
      // aborted signal never fires, so check explicitly.
      throwIfAborted(options.signal);
      const abort = () => void conversion.cancel();
      options.signal.addEventListener('abort', abort, { once: true });
      try {
        await conversion.execute();
      } finally {
        options.signal.removeEventListener('abort', abort);
      }
    }

    options.onProgress(1);
    const mime = plan.container === 'mp4' ? 'video/mp4' : 'video/webm';
    const blob =
      target instanceof BufferTarget && target.buffer
        ? new Blob([target.buffer], { type: mime })
        : null;
    return { plan, blob, hasAudio };
  } catch (error) {
    if (
      error instanceof ConversionCanceledError ||
      (error instanceof DOMException && error.name === 'AbortError') ||
      options.signal.aborted
    ) {
      throw new DOMException('Export cancelled', 'AbortError');
    }
    throw toAppError(error, 'export-failed');
  } finally {
    input.dispose();
  }
}

/**
 * Audio-only input: generate the video ourselves (gradient background + captions at 30 fps)
 * and let a composable Conversion copy/transcode the audio into the same output.
 */
async function runAudiogram(
  input: Input,
  output: Output,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  plan: ExportPlan,
  options: BurnInOptions,
  drawCaptions: (time: number) => void,
): Promise<boolean> {
  const videoSource = new CanvasSource(canvas, { codec: plan.videoCodec, quality: HIGH_QUALITY });
  output.addVideoTrack(videoSource, { frameRate: AUDIOGRAM_FPS });
  const conversion = await Conversion.init({
    input,
    output,
    composable: true,
    showWarnings: false,
    video: { discard: true },
  });
  const hasAudio = conversion.utilizedTracks.some((t) => t.isAudioTrack());
  await output.start();

  const frames = Math.ceil(options.duration * AUDIOGRAM_FPS);
  const background = ctx.createLinearGradient(0, 0, plan.width, plan.height);
  background.addColorStop(0, '#2a1458');
  background.addColorStop(0.5, '#0b0b12');
  background.addColorStop(1, '#5a1233');

  const renderVideo = async () => {
    for (let i = 0; i < frames; i++) {
      if (options.signal.aborted) throw new ConversionCanceledError();
      const time = i / AUDIOGRAM_FPS;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, plan.width, plan.height);
      drawCaptions(time);
      await videoSource.add(time, 1 / AUDIOGRAM_FPS);
      if (i % 15 === 0) options.onProgress(i / frames);
    }
    videoSource.close();
  };

  throwIfAborted(options.signal);
  const abort = () => void conversion.cancel();
  options.signal.addEventListener('abort', abort, { once: true });
  try {
    await Promise.all([hasAudio ? conversion.execute() : Promise.resolve(), renderVideo()]);
    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw error;
  } finally {
    options.signal.removeEventListener('abort', abort);
  }
  return hasAudio;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
}

function createCanvas(
  width: number,
  height: number,
):
  | { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D }
  | { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) return { canvas, ctx };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AppError('export-failed', 'no 2d context');
  return { canvas, ctx };
}
