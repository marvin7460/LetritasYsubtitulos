import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from 'mediabunny';
import { computePeaks } from '../lib/audio/peaks';
import { StreamingResampler } from '../lib/audio/resampler';
import {
  TARGET_SAMPLE_RATE,
  type ExtractRequest,
  type ExtractResponse,
  type MediaInfo,
} from '../lib/audio/types';
import { AppError, toAppError } from '../lib/errors';
import { MAX_DURATION_SECONDS } from '../lib/media/validate';
import { workerScope } from './workerScope';

/**
 * Demuxes the file with Mediabunny, decodes the audio with WebCodecs and resamples it to 16 kHz
 * mono on the fly. Runs in a worker so a long file never freezes the UI.
 */
const scope = workerScope<ExtractRequest, ExtractResponse>();

function send(message: ExtractResponse, transfer: Transferable[] = []): void {
  scope.postMessage(message, transfer);
}

scope.addEventListener('message', (event) => {
  void extract(event.data.file).then(
    (result) => send({ type: 'done', result }, [result.samples.buffer, result.peaks.buffer]),
    (error: unknown) => {
      const appError = toAppError(error, 'decode-failed');
      // Format/codec problems may still be solved by the browser's own decoder on the main thread.
      const recoverable =
        appError.code === 'decode-failed' || appError.code === 'unsupported-format';
      send({ type: 'error', error: appError.toData(), recoverable });
    },
  );
});

async function extract(file: File) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    if (!(await input.canRead())) throw new AppError('unsupported-format', file.type || file.name);

    const [audioTrack, videoTrack] = await Promise.all([
      input.getPrimaryAudioTrack(),
      input.getPrimaryVideoTrack(),
    ]);
    const duration = await input.computeDuration();
    if (duration > MAX_DURATION_SECONDS) throw new AppError('media-too-long', `${duration}s`);

    const info: MediaInfo = {
      duration,
      hasVideo: videoTrack !== null,
      hasAudio: audioTrack !== null,
      width: videoTrack ? await videoTrack.getDisplayWidth() : 0,
      height: videoTrack ? await videoTrack.getDisplayHeight() : 0,
      videoCodec: videoTrack ? await videoTrack.getCodec() : null,
      audioCodec: audioTrack ? await audioTrack.getCodec() : null,
    };
    if (!audioTrack) throw new AppError('no-audio-track');
    if (!(await audioTrack.canDecode())) {
      throw new AppError(
        'decode-failed',
        `cannot decode audio codec ${info.audioCodec ?? 'unknown'}`,
      );
    }

    const sourceRate = await audioTrack.getSampleRate();
    const resampler = new StreamingResampler(sourceRate, TARGET_SAMPLE_RATE);
    const output = new GrowableFloat32Array(
      Math.ceil(duration * TARGET_SAMPLE_RATE) + TARGET_SAMPLE_RATE,
    );
    const sink = new AudioSampleSink(audioTrack);

    let written = 0; // input-rate samples already placed on the timeline
    let channelBuffers: Float32Array[] = [];
    let lastProgress = 0;

    for await (const sample of sink.samples()) {
      try {
        const frames = sample.numberOfFrames;
        const channels = sample.numberOfChannels;
        const startIndex = Math.round(sample.timestamp * sourceRate);

        // Keep audio aligned with the video timeline: fill gaps with silence…
        if (startIndex > written) {
          output.push(resampler.push(new Float32Array(startIndex - written)));
          written = startIndex;
        }
        // …and skip overlapping or negative-time (encoder priming) frames.
        const skip = Math.min(frames, Math.max(0, written - startIndex));
        if (skip < frames) {
          if (channelBuffers.length !== channels || (channelBuffers[0]?.length ?? 0) < frames) {
            channelBuffers = Array.from({ length: channels }, () => new Float32Array(frames));
          }
          const mono = new Float32Array(frames - skip);
          for (let c = 0; c < channels; c++) {
            const plane = channelBuffers[c];
            if (!plane) continue;
            sample.copyTo(plane, {
              planeIndex: c,
              format: 'f32-planar',
              frameOffset: 0,
              frameCount: frames,
            });
            for (let i = skip; i < frames; i++)
              mono[i - skip] = (mono[i - skip] ?? 0) + (plane[i] ?? 0);
          }
          if (channels > 1)
            for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] ?? 0) / channels;
          output.push(resampler.push(mono));
          written = startIndex + frames;
        }

        const progress =
          duration > 0 ? Math.min(1, (sample.timestamp + sample.duration) / duration) : 0;
        if (progress - lastProgress >= 0.01) {
          lastProgress = progress;
          send({ type: 'progress', progress });
        }
      } finally {
        sample.close();
      }
    }
    output.push(resampler.flush());

    const samples = output.toArray();
    if (samples.length === 0) throw new AppError('decode-failed', 'no audio samples decoded');
    return { info, samples, peaks: computePeaks(samples, TARGET_SAMPLE_RATE) };
  } finally {
    input.dispose();
  }
}

class GrowableFloat32Array {
  private data: Float32Array;
  private length = 0;

  constructor(initialCapacity: number) {
    this.data = new Float32Array(Math.max(1024, initialCapacity));
  }

  push(chunk: Float32Array): void {
    if (this.length + chunk.length > this.data.length) {
      const grown = new Float32Array(Math.max(this.length + chunk.length, this.data.length * 1.5));
      grown.set(this.data.subarray(0, this.length));
      this.data = grown;
    }
    this.data.set(chunk, this.length);
    this.length += chunk.length;
  }

  toArray(): Float32Array {
    return this.data.length === this.length ? this.data : this.data.slice(0, this.length);
  }
}
