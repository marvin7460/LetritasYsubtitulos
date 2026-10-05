/**
 * Streaming windowed-sinc resampler (mono, Float32).
 *
 * Why not just `OfflineAudioContext`? It needs the whole decoded file in memory at the source
 * rate: one hour of 48 kHz stereo is ~1.4 GB of Float32. Resampling chunk by chunk as the
 * decoder produces audio keeps memory proportional to the *output* (16 kHz mono ≈ 230 MB/h),
 * and it works inside a Web Worker, where Web Audio is not available.
 *
 * Each output sample is a weighted sum of nearby input samples, weighted by a low-pass filter
 * (sinc) shaped by a Blackman window. The cutoff sits just below the output Nyquist frequency
 * so downsampling doesn't alias.
 */
export class StreamingResampler {
  readonly inRate: number;
  readonly outRate: number;
  private readonly step: number;
  private readonly halfWidth: number;
  private readonly table: Float32Array;
  private readonly tableResolution = 512;

  private buffer = new Float32Array(0);
  /** Global index of `buffer[0]` in the input stream. */
  private bufferStart = 0;
  private bufferLength = 0;
  private totalIn = 0;
  private nextOut = 0;

  constructor(inRate: number, outRate: number, zeroCrossings = 12) {
    if (!(inRate > 0 && outRate > 0)) throw new RangeError('Sample rates must be positive');
    this.inRate = inRate;
    this.outRate = outRate;
    this.step = inRate / outRate;
    const cutoff = 0.94 * Math.min(1, outRate / inRate);
    this.halfWidth = Math.ceil(zeroCrossings / cutoff);

    const size = this.halfWidth * this.tableResolution + 2;
    this.table = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const d = i / this.tableResolution;
      this.table[i] =
        d >= this.halfWidth ? 0 : cutoff * sinc(cutoff * d) * blackman(d / this.halfWidth);
    }
  }

  /** Feeds input samples; returns every output sample that can already be computed. */
  push(input: Float32Array): Float32Array {
    if (this.inRate === this.outRate) {
      this.totalIn += input.length;
      this.nextOut += input.length;
      return input.slice();
    }
    this.append(input);
    this.totalIn += input.length;
    const output = this.produce(false);
    this.discardConsumed();
    return output;
  }

  /** Signals the end of the stream and returns the remaining output samples. */
  flush(): Float32Array {
    if (this.inRate === this.outRate) return new Float32Array(0);
    const output = this.produce(true);
    this.buffer = new Float32Array(0);
    this.bufferLength = 0;
    return output;
  }

  /** Number of output samples the whole stream produces for `inputLength` input samples. */
  static outputLength(inputLength: number, inRate: number, outRate: number): number {
    return Math.round((inputLength * outRate) / inRate);
  }

  private produce(final: boolean): Float32Array {
    const expectedTotal = StreamingResampler.outputLength(this.totalIn, this.inRate, this.outRate);
    let lastComputable: number;
    if (final) {
      lastComputable = expectedTotal - 1;
    } else {
      // Output m needs input samples up to floor(m * step + halfWidth).
      lastComputable = Math.floor((this.totalIn - 1 - this.halfWidth) / this.step);
      lastComputable = Math.min(lastComputable, expectedTotal - 1);
    }
    const count = Math.max(0, lastComputable - this.nextOut + 1);
    const out = new Float32Array(count);
    const { table, tableResolution, halfWidth, buffer, bufferStart, bufferLength } = this;

    for (let o = 0; o < count; o++) {
      const position = (this.nextOut + o) * this.step;
      const first = Math.max(Math.ceil(position - halfWidth), bufferStart);
      const last = Math.min(Math.floor(position + halfWidth), bufferStart + bufferLength - 1);
      let acc = 0;
      for (let k = first; k <= last; k++) {
        const t = Math.abs(position - k) * tableResolution;
        const ti = Math.floor(t);
        const frac = t - ti;
        const weight = (table[ti] ?? 0) + ((table[ti + 1] ?? 0) - (table[ti] ?? 0)) * frac;
        acc += (buffer[k - bufferStart] ?? 0) * weight;
      }
      out[o] = acc;
    }
    this.nextOut += count;
    return out;
  }

  private append(input: Float32Array): void {
    const needed = this.bufferLength + input.length;
    if (needed > this.buffer.length) {
      const grown = new Float32Array(Math.max(needed, this.buffer.length * 2, 4096));
      grown.set(this.buffer.subarray(0, this.bufferLength));
      this.buffer = grown;
    }
    this.buffer.set(input, this.bufferLength);
    this.bufferLength += input.length;
  }

  /** Drops input samples that no future output sample needs. */
  private discardConsumed(): void {
    const firstNeeded = Math.ceil(this.nextOut * this.step - this.halfWidth);
    const drop = Math.min(Math.max(0, firstNeeded - this.bufferStart), this.bufferLength);
    if (drop === 0) return;
    this.buffer.copyWithin(0, drop, this.bufferLength);
    this.bufferLength -= drop;
    this.bufferStart += drop;
  }
}

function sinc(x: number): number {
  if (x === 0) return 1;
  const px = Math.PI * x;
  return Math.sin(px) / px;
}

function blackman(u: number): number {
  // u in [0, 1]: 1 at the center, 0 at the edge of the window.
  return 0.42 + 0.5 * Math.cos(Math.PI * u) + 0.08 * Math.cos(2 * Math.PI * u);
}

/** Averages planar channels into one mono channel (in place into `target`). */
export function downmixInto(target: Float32Array, channels: readonly Float32Array[]): void {
  const count = channels.length;
  if (count === 0) return;
  target.fill(0);
  for (const channel of channels) {
    for (let i = 0; i < target.length; i++) target[i] = (target[i] ?? 0) + (channel[i] ?? 0);
  }
  if (count > 1) for (let i = 0; i < target.length; i++) target[i] = (target[i] ?? 0) / count;
}
