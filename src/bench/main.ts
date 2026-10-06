import type { Device, ModelSize } from '../lib/transcription/models';
import {
  ALL_MODELS,
  benchExport,
  benchmarkAudio,
  benchTranscription,
  toMarkdown,
  type BenchRow,
} from './bench';

declare global {
  interface Window {
    __benchResults?: { done: boolean; rows: BenchRow[]; markdown: string; error?: string };
  }
}

const params = new URLSearchParams(location.search);
const logElement = document.getElementById('log');
const tableElement = document.getElementById('table');
const button = document.getElementById('run');

function log(message: string): void {
  if (logElement) logElement.textContent += `${message}\n`;
  console.log(message);
}

function machineDescription(): string {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const ua = navigator.userAgent.replace(/\s*\(KHTML, like Gecko\)/, '');
  return `${ua} · ${navigator.hardwareConcurrency} hilos${memory ? ` · ≥${memory} GB RAM` : ''}`;
}

async function run(): Promise<void> {
  const models = (params.get('models')?.split(',') ?? ALL_MODELS) as ModelSize[];
  const devices = (params.get('devices')?.split(',') ?? ['webgpu', 'wasm']) as Device[];
  const only = params.get('only'); // "transcription" | "export"
  const rows: BenchRow[] = [];
  window.__benchResults = { done: false, rows, markdown: '' };

  try {
    if (only !== 'export') {
      log('Preparando 60 s de audio…');
      const audio = await benchmarkAudio();
      for (const device of devices) {
        for (const model of models) rows.push(await benchTranscription(audio, model, device, log));
      }
    }
    if (only !== 'transcription') {
      rows.push(await benchExport('mp4', log));
      rows.push(await benchExport('webm', log));
    }
    const markdown = toMarkdown(rows, machineDescription());
    if (tableElement) tableElement.textContent = markdown;
    window.__benchResults = { done: true, rows, markdown };
    log('Listo.');
  } catch (error) {
    log(`Error: ${String(error)}`);
    window.__benchResults = { done: true, rows, markdown: '', error: String(error) };
  }
}

button?.addEventListener('click', () => void run());
if (params.has('auto')) void run();
