import { describe, expect, it } from 'vitest';
import { words } from '../../test/fixtures';
import { captionSafeArea } from './safeZones';
import { findActiveCaption } from './renderer';

const caption = (id: string, start: number, end: number) => ({
  id,
  start,
  end,
  words: words(`x@${start}-${end}`),
});

describe('findActiveCaption', () => {
  const captions = [caption('a', 0, 1), caption('b', 1.5, 2.5), caption('c', 3, 4)];

  it('finds the caption on screen at a time', () => {
    expect(findActiveCaption(captions, 0)?.id).toBe('a');
    expect(findActiveCaption(captions, 2)?.id).toBe('b');
    expect(findActiveCaption(captions, 3.99)?.id).toBe('c');
  });

  it('returns null in gaps and outside the captions', () => {
    expect(findActiveCaption(captions, 1.2)).toBeNull();
    expect(findActiveCaption(captions, 4)).toBeNull();
    expect(findActiveCaption(captions, -1)).toBeNull();
    expect(findActiveCaption([], 1)).toBeNull();
  });
});

describe('captionSafeArea', () => {
  it('keeps vertical captions away from every app interface', () => {
    const safe = captionSafeArea(1080, 1920);
    expect(safe.bottom).toBeGreaterThanOrEqual(0.2);
    expect(safe.right).toBeGreaterThanOrEqual(0.13);
  });

  it('uses small margins for landscape video', () => {
    expect(captionSafeArea(1920, 1080).bottom).toBeLessThan(0.1);
  });
});
