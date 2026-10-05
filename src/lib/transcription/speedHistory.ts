import type { Device, ModelSize } from './models';

const KEY = 'letritas:speed-v1';

/**
 * Remembers how fast each model ran on *this* device (as a realtime factor: seconds of audio
 * per second of processing), so the model picker can show "en tu equipo: ~12× tiempo real".
 * Stored in localStorage; never leaves the browser.
 */
export function recordSpeed(
  model: ModelSize,
  device: Device,
  audioSeconds: number,
  ms: number,
): void {
  if (audioSeconds < 3 || ms <= 0) return;
  try {
    const data = readAll();
    const factor = audioSeconds / (ms / 1000);
    const key = `${model}:${device}`;
    const previous = data[key];
    data[key] = previous ? previous * 0.5 + factor * 0.5 : factor;
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private mode or storage disabled: the hint is optional.
  }
}

export function readSpeed(model: ModelSize, device: Device): number | null {
  try {
    return readAll()[`${model}:${device}`] ?? null;
  } catch {
    return null;
  }
}

function readAll(): Record<string, number> {
  const raw = localStorage.getItem(KEY);
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
}
