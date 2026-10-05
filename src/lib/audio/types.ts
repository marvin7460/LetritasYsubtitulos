import type { AppErrorData } from '../errors';

export const TARGET_SAMPLE_RATE = 16_000;

export interface MediaInfo {
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  /** Display size (rotation applied). 0 for audio-only files. */
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
}

export interface ExtractedAudio {
  info: MediaInfo;
  /** 16 kHz mono PCM, aligned with the media timeline (sample i ↔ i / 16000 s). */
  samples: Float32Array;
  peaks: Float32Array;
}

export interface ExtractRequest {
  type: 'extract';
  file: File;
}

export type ExtractResponse =
  | { type: 'progress'; progress: number }
  | { type: 'done'; result: ExtractedAudio }
  | { type: 'error'; error: AppErrorData; recoverable: boolean };
