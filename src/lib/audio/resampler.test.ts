import { describe, expect, it } from 'vitest';
import { computePeaks } from './peaks';
import { StreamingResampler } from './resampler';

function sine(freq: number, rate: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
}

function resampleInChunks(
  input: Float32Array,
  from: number,
  to: number,
  chunk: number,
): Float32Array {
  const r = new StreamingResampler(from, to);
  const parts: Float32Array[] = [];
  for (let i = 0; i < input.length; i += chunk) parts.push(r.push(input.subarray(i, i + chunk)));
  parts.push(r.flush());
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const rms = (a: Float32Array, from = 0, to = a.length) => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += (a[i] ?? 0) ** 2;
  return Math.sqrt(sum / (to - from));
};

describe('StreamingResampler', () => {
  it.each([
    [48_000, 16_000],
    [44_100, 16_000],
    [22_050, 16_000],
  ])('%i Hz → %i Hz keeps duration and amplitude of a 440 Hz tone', (from, to) => {
    const out = resampleInChunks(sine(440, from, 2), from, to, 1024);
    expect(out.length).toBe(StreamingResampler.outputLength(2 * from, from, to));
    // Ignore filter edges; a sine of amplitude 1 has RMS 1/√2.
    expect(rms(out, 500, out.length - 500)).toBeCloseTo(Math.SQRT1_2, 2);
  });

  it('removes frequencies above the new Nyquist (anti-aliasing)', () => {
    const out = resampleInChunks(sine(12_000, 48_000, 1), 48_000, 16_000, 999);
    expect(rms(out, 500, out.length - 500)).toBeLessThan(0.01);
  });

  it('gives the same result regardless of chunk size', () => {
    const input = sine(300, 44_100, 0.5);
    const a = resampleInChunks(input, 44_100, 16_000, 128);
    const b = resampleInChunks(input, 44_100, 16_000, 7_000);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i]!, 5);
  });

  it('passes audio through when rates match', () => {
    const r = new StreamingResampler(16_000, 16_000);
    expect(Array.from(r.push(new Float32Array([0.1, 0.2])))).toEqual([
      expect.closeTo(0.1, 6),
      expect.closeTo(0.2, 6),
    ]);
  });
});

describe('computePeaks', () => {
  it('stores one max-abs value per bucket', () => {
    const samples = new Float32Array(16_000).fill(0.1);
    samples[200] = -0.9;
    const peaks = computePeaks(samples, 16_000, 100);
    expect(peaks).toHaveLength(100);
    expect(peaks[1]).toBeCloseTo(0.9);
    expect(peaks[0]).toBeCloseTo(0.1);
  });
});
