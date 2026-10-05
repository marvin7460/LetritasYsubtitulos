import { AppError } from '../errors';

export const SUPPORTED_EXTENSIONS = ['mp4', 'mov', 'webm', 'mp3', 'wav', 'm4a'] as const;
export const ACCEPT_ATTRIBUTE =
  '.mp4,.mov,.webm,.mp3,.wav,.m4a,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/x-wav,audio/mp4';

/** Browsers read files lazily in slices, but decoding and exporting still need RAM. */
export const MAX_FILE_BYTES = 4 * 1024 ** 3;
/** 2 h of 16 kHz mono audio ≈ 460 MB of Float32 samples — about what a tab can safely hold. */
export const MAX_DURATION_SECONDS = 2 * 60 * 60;

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a']);

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function isSupportedFile(file: FileLike): boolean {
  const ext = extensionOf(file.name);
  if ((SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) return true;
  return /^(video\/(mp4|quicktime|webm)|audio\/(mpeg|mp3|wav|x-wav|wave|mp4|x-m4a))$/.test(
    file.type,
  );
}

/** Returns a user-facing error when the file can't be used, or null when it looks fine. */
export function validateMediaFile(file: FileLike): AppError | null {
  if (!isSupportedFile(file)) {
    const ext = extensionOf(file.name);
    return new AppError('unsupported-format', ext ? `.${ext}` : file.type || 'unknown');
  }
  if (file.size === 0) return new AppError('decode-failed', 'empty file');
  if (file.size > MAX_FILE_BYTES) return new AppError('file-too-large', `${file.size} bytes`);
  return null;
}

export function mediaKindOf(file: FileLike): 'video' | 'audio' {
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return AUDIO_EXTENSIONS.has(extensionOf(file.name)) ? 'audio' : 'video';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit] ?? 'GB'}`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}
