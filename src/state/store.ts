import { create } from 'zustand';
import type { Caption, LineRules } from '../lib/captions/types';
import type { MediaInfo } from '../lib/audio/types';
import type { AppError } from '../lib/errors';
import type { CaptionStyle } from '../lib/render/style';
import type { DeviceChoice, Device, ModelSize } from '../lib/transcription/models';
import type { Capabilities, LanguageChoice } from '../lib/transcription/protocol';
import { DEFAULT_MODEL } from '../lib/transcription/models';

export type Stage = 'empty' | 'loading-media' | 'workspace';

export interface MediaState {
  file: File;
  /** Object URL used by the <video> element. Revoked when the media is replaced. */
  url: string;
  kind: 'video' | 'audio';
  name: string;
  info: MediaInfo;
}

export interface AudioData {
  /** 16 kHz mono samples. Kept outside React rendering paths: never iterate it in render. */
  samples: Float32Array;
  peaks: Float32Array;
}

export type TranscriptionStatus =
  'idle' | 'loading-model' | 'detecting-language' | 'transcribing' | 'done' | 'error';

export interface TranscriptionStats {
  model: ModelSize;
  device: Device;
  audioSeconds: number;
  transcribeMs: number;
  loadMs: number;
}

export interface TranscriptionState {
  status: TranscriptionStatus;
  loadLoaded: number;
  loadTotal: number;
  progress: number;
  partialText: string;
  detectedLanguage: { code: string; probability: number } | null;
  warning: string | null;
  stats: TranscriptionStats | null;
}

/** Everything that defines the subtitles of a project (what undo/redo and saving operate on). */
export interface ProjectDoc {
  captions: Caption[];
  rules: LineRules;
  style: CaptionStyle;
  language: string | null;
}

export interface Settings {
  model: ModelSize;
  device: DeviceChoice;
  language: LanguageChoice;
}

export interface AppState {
  stage: Stage;
  media: MediaState | null;
  audio: AudioData | null;
  extractProgress: number;
  settings: Settings;
  capabilities: Capabilities | null;
  transcription: TranscriptionState;
  doc: ProjectDoc | null;
  error: AppError | null;
}

export const INITIAL_TRANSCRIPTION: TranscriptionState = {
  status: 'idle',
  loadLoaded: 0,
  loadTotal: 0,
  progress: 0,
  partialText: '',
  detectedLanguage: null,
  warning: null,
  stats: null,
};

export const useAppStore = create<AppState>()(() => ({
  stage: 'empty',
  media: null,
  audio: null,
  extractProgress: 0,
  settings: { model: DEFAULT_MODEL, device: 'auto', language: 'auto' },
  capabilities: null,
  transcription: INITIAL_TRANSCRIPTION,
  doc: null,
  error: null,
}));

export function setTranscription(patch: Partial<TranscriptionState>): void {
  useAppStore.setState((state) => ({ transcription: { ...state.transcription, ...patch } }));
}
