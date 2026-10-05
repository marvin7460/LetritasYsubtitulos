export interface ProgressSample {
  /** 0–1 */
  progress: number;
  /** performance.now() in ms */
  time: number;
}

/**
 * Estimated seconds remaining, or null when there isn't enough data yet.
 *
 * TODO(Marvin): this baseline extrapolates linearly from the start, so the ETA jumps around at
 * the beginning (the encoder warms up) and reacts slowly when speed changes.
 * Make it steadier:
 * - Use only recent samples (e.g. the last 5 seconds) to measure the current speed, or
 * - keep an exponential moving average of the speed: `speed = 0.2 * current + 0.8 * speed`.
 * - Return null until there are at least ~2 s of samples.
 * Add tests in eta.test.ts (there are `it.todo`s for you).
 */
export function estimateRemainingSeconds(samples: readonly ProgressSample[]): number | null {
  const first = samples[0];
  const last = samples.at(-1);
  if (!first || !last || last.progress <= first.progress) return null;
  const elapsed = (last.time - first.time) / 1000;
  const speed = (last.progress - first.progress) / elapsed;
  return speed > 0 ? (1 - last.progress) / speed : null;
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return 'calculando…';
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))} s`;
  return `~${Math.round(seconds / 60)} min`;
}
