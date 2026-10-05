import { describe, expect, it } from 'vitest';
import { estimateRemainingSeconds, formatEta } from './eta';
import { exportSize, planExport, type EncodableVideoCodec } from './plan';

const supports =
  (...codecs: EncodableVideoCodec[]) =>
  (codec: EncodableVideoCodec) =>
    Promise.resolve(codecs.includes(codec));

describe('planExport', () => {
  it('prefers MP4 with H.264 when available', async () => {
    expect(await planExport(1080, 1920, 'mp4', supports('avc', 'vp9'))).toMatchObject({
      container: 'mp4',
      videoCodec: 'avc',
    });
  });

  it('falls back to WebM when H.264 cannot be encoded', async () => {
    expect(await planExport(1080, 1920, 'mp4', supports('vp8'))).toMatchObject({
      container: 'webm',
      videoCodec: 'vp8',
    });
  });

  it('returns null when nothing can be encoded', async () => {
    expect(await planExport(1080, 1920, 'mp4', supports())).toBeNull();
  });

  it('treats a failing capability check as unsupported', async () => {
    const plan = await planExport(640, 360, 'webm', (codec) =>
      codec === 'vp9' ? Promise.reject(new Error('boom')) : Promise.resolve(codec === 'av1'),
    );
    expect(plan?.videoCodec).toBe('av1');
  });
});

describe('exportSize', () => {
  it('keeps even dimensions and caps the longest side', () => {
    expect(exportSize(1080, 1920)).toEqual({ width: 1080, height: 1920 });
    expect(exportSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
    expect(exportSize(721, 405)).toEqual({ width: 722, height: 406 });
  });
});

describe('estimateRemainingSeconds', () => {
  it('extrapolates from the measured speed', () => {
    const eta = estimateRemainingSeconds([
      { progress: 0, time: 0 },
      { progress: 0.25, time: 5000 },
    ]);
    expect(eta).toBeCloseTo(15, 5);
  });

  it('returns null without progress', () => {
    expect(estimateRemainingSeconds([])).toBeNull();
    expect(estimateRemainingSeconds([{ progress: 0.1, time: 0 }])).toBeNull();
  });

  it('formats for humans', () => {
    expect(formatEta(null)).toBe('calculando…');
    expect(formatEta(12.4)).toBe('~12 s');
    expect(formatEta(150)).toBe('~3 min');
  });

  // TODO(Marvin): make the estimate steadier (see eta.ts) and turn these into real tests.
  it.todo('ignores the slow warm-up at the beginning (uses recent speed)');
  it.todo('returns null until there are at least ~2 seconds of samples');
  it.todo('does not jump more than 30% between consecutive updates at a constant speed');
});
