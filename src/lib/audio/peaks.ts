/** Waveform resolution: one peak every 10 ms is enough to draw and to snap edges. */
export const PEAKS_PER_SECOND = 100;

/** Max absolute amplitude per bucket — a tiny summary of the audio used to draw the waveform. */
export function computePeaks(
  samples: Float32Array,
  sampleRate: number,
  peaksPerSecond = PEAKS_PER_SECOND,
): Float32Array {
  const bucket = Math.max(1, Math.round(sampleRate / peaksPerSecond));
  const count = Math.ceil(samples.length / bucket);
  const peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const from = i * bucket;
    const to = Math.min(samples.length, from + bucket);
    let max = 0;
    for (let j = from; j < to; j++) {
      const v = Math.abs(samples[j] ?? 0);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}
