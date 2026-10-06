import {
  BufferTarget,
  CanvasSource,
  canEncodeVideo,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
} from 'mediabunny';
import { extractAudio } from '../lib/audio/extractAudio';
import { TARGET_SAMPLE_RATE } from '../lib/audio/types';
import { buildCaptions } from '../lib/captions/buildCaptions';
import { VERTICAL_RULES } from '../lib/captions/rules';
import { ensureFontLoaded } from '../lib/render/fonts';
import { getPreset } from '../lib/render/presets';
import { renderCaptions } from '../lib/render/renderer';
import { CLASSIC_STYLE } from '../lib/render/style';
import { TranscriberClient } from '../lib/transcription/client';
import { MODELS, type Device, type ModelSize } from '../lib/transcription/models';
import { createId } from '../lib/util/id';

/**
 * Benchmark harness (open /bench.html). Measures, on *this* machine:
 * - transcription of 60 s of speech per model × device (load time and processing time),
 * - burning captions into 60 s of 1080×1920 video, per container.
 * Results are printed as a Markdown table and exposed on `window.__benchResults` for
 * `scripts/bench.mjs`, which drives this page with Playwright.
 */
export interface TranscriptionRow {
  kind: 'transcription';
  model: ModelSize;
  device: Device;
  loadSeconds: number | null;
  transcribeSeconds: number | null;
  realtimeFactor: number | null;
  error?: string;
}

export interface ExportRow {
  kind: 'export';
  container: 'mp4' | 'webm';
  codec: string;
  seconds: number | null;
  fps: number | null;
  error?: string;
}

export type BenchRow = TranscriptionRow | ExportRow;

const AUDIO_SECONDS = 60;
const EXPORT_SECONDS = 60;
const EXPORT_SIZE = { width: 1080, height: 1920 };
const FPS = 30;

/** 60 s of speech: the demo clip's audio repeated. */
export async function benchmarkAudio(): Promise<Float32Array> {
  const video = document.createElement('video');
  const url = video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
    ? '/samples/demo.mp4'
    : '/samples/demo.webm';
  const blob = await (await fetch(url)).blob();
  const { samples } = await extractAudio(new File([blob], url, { type: blob.type }));
  const out = new Float32Array(AUDIO_SECONDS * TARGET_SAMPLE_RATE);
  for (let offset = 0; offset < out.length; offset += samples.length) {
    out.set(samples.subarray(0, Math.min(samples.length, out.length - offset)), offset);
  }
  return out;
}

export async function benchTranscription(
  audio: Float32Array,
  model: ModelSize,
  device: Device,
  log: (message: string) => void,
): Promise<TranscriptionRow> {
  // A fresh worker per run so one run's GPU memory doesn't affect the next.
  const client = new TranscriberClient();
  let loadSeconds: number | null = null;
  try {
    log(`→ ${model} / ${device}: cargando…`);
    const result = await client.transcribe(
      audio,
      { model, device, language: 'es' },
      {
        onLoaded: (_device, ms) => {
          loadSeconds = ms / 1000;
        },
      },
    );
    const transcribeSeconds = result.transcribeMs / 1000;
    log(`  ${transcribeSeconds.toFixed(1)} s · ${result.text.slice(0, 60)}…`);
    return {
      kind: 'transcription',
      model,
      device: result.device,
      loadSeconds,
      transcribeSeconds,
      realtimeFactor: AUDIO_SECONDS / transcribeSeconds,
    };
  } catch (error) {
    log(`  error: ${String(error)}`);
    return {
      kind: 'transcription',
      model,
      device,
      loadSeconds,
      transcribeSeconds: null,
      realtimeFactor: null,
      error: String(error),
    };
  } finally {
    client.dispose();
  }
}

export async function benchExport(
  container: 'mp4' | 'webm',
  log: (message: string) => void,
): Promise<ExportRow> {
  const codec = container === 'mp4' ? 'avc' : 'vp9';
  const quality = new Quality('high');
  if (!(await canEncodeVideo(codec, { ...EXPORT_SIZE, quality }))) {
    return { kind: 'export', container, codec, seconds: null, fps: null, error: 'no soportado' };
  }
  const style = getPreset('tiktok')?.style ?? CLASSIC_STYLE;
  await ensureFontLoaded(style);
  const words = Array.from({ length: EXPORT_SECONDS * 3 }, (_, i) => ({
    id: createId('w'),
    text: ['Hola', 'esto', 'es', 'un', 'benchmark', 'de', 'Letritas.'][i % 7] ?? 'hola',
    start: i / 3,
    end: i / 3 + 0.3,
  }));
  const captions = buildCaptions(words, { ...VERTICAL_RULES, maxWordsPerCaption: 3 });

  const canvas = new OffscreenCanvas(EXPORT_SIZE.width, EXPORT_SIZE.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const output = new Output({
    format:
      container === 'mp4'
        ? new Mp4OutputFormat({ fastStart: 'in-memory' })
        : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, { codec, quality });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  log(`→ export ${container.toUpperCase()} (${codec}) 1080×1920 · ${EXPORT_SECONDS} s…`);
  const started = performance.now();
  const frames = EXPORT_SECONDS * FPS;
  for (let i = 0; i < frames; i++) {
    const t = i / FPS;
    const hue = (t * 12) % 360;
    ctx.fillStyle = `hsl(${hue} 60% 25%)`;
    ctx.fillRect(0, 0, EXPORT_SIZE.width, EXPORT_SIZE.height);
    renderCaptions(ctx, { ...EXPORT_SIZE, time: t, captions, style, rules: VERTICAL_RULES });
    await source.add(t, 1 / FPS);
  }
  source.close();
  await output.finalize();
  const seconds = (performance.now() - started) / 1000;
  log(`  ${seconds.toFixed(1)} s (${(frames / seconds).toFixed(0)} fps)`);
  return { kind: 'export', container, codec, seconds, fps: frames / seconds };
}

export function toMarkdown(rows: readonly BenchRow[], machine: string): string {
  const fmt = (n: number | null, digits = 1) => (n === null ? '—' : n.toFixed(digits));
  const lines = [`Máquina: ${machine}`, ''];
  const transcription = rows.filter((r): r is TranscriptionRow => r.kind === 'transcription');
  if (transcription.length > 0) {
    lines.push(
      `| Modelo | Dispositivo | Carga (s) | Transcribir ${AUDIO_SECONDS} s de audio (s) | × tiempo real |`,
      '|---|---|---:|---:|---:|',
      ...transcription.map(
        (r) =>
          `| ${r.model} | ${r.device.toUpperCase()} | ${fmt(r.loadSeconds)} | ${r.error ? `error: ${r.error.slice(0, 40)}` : fmt(r.transcribeSeconds)} | ${fmt(r.realtimeFactor)} |`,
      ),
      '',
    );
  }
  const exports = rows.filter((r): r is ExportRow => r.kind === 'export');
  if (exports.length > 0) {
    lines.push(
      `| Exportar ${EXPORT_SECONDS} s · 1080×1920 · 30 fps | Códec | Tiempo (s) | FPS |`,
      '|---|---|---:|---:|',
      ...exports.map(
        (r) =>
          `| ${r.container.toUpperCase()} | ${r.codec} | ${r.error ?? fmt(r.seconds)} | ${fmt(r.fps, 0)} |`,
      ),
    );
  }
  return lines.join('\n');
}

export const ALL_MODELS: ModelSize[] = MODELS.map((m) => m.id);
