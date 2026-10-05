import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, formatBytes, mediaKindOf, validateMediaFile } from './validate';

describe('validateMediaFile', () => {
  it.each(['clip.mp4', 'clip.MOV', 'a.webm', 'a.mp3', 'a.wav', 'a.m4a'])('accepts %s', (name) => {
    expect(validateMediaFile({ name, type: '', size: 10 })).toBeNull();
  });

  it('rejects unsupported formats with a clear code', () => {
    expect(validateMediaFile({ name: 'clip.avi', type: 'video/x-msvideo', size: 10 })?.code).toBe(
      'unsupported-format',
    );
  });

  it('rejects huge and empty files', () => {
    expect(
      validateMediaFile({ name: 'a.mp4', type: 'video/mp4', size: MAX_FILE_BYTES + 1 })?.code,
    ).toBe('file-too-large');
    expect(validateMediaFile({ name: 'a.mp4', type: 'video/mp4', size: 0 })?.code).toBe(
      'decode-failed',
    );
  });
});

describe('helpers', () => {
  it('detects audio files', () => {
    expect(mediaKindOf({ name: 'voz.mp3', type: '', size: 1 })).toBe('audio');
    expect(mediaKindOf({ name: 'clip.mov', type: '', size: 1 })).toBe('video');
  });

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB');
  });
});
