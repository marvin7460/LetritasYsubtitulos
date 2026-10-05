import { describe, expect, it } from 'vitest';
import { wordsFromChunks } from '../captions/sanitize';
import { MOCK_TRANSCRIPT, mockWordChunks } from './mockEngine';

describe('mockWordChunks', () => {
  it('spreads the fixed transcript over the audio', () => {
    const chunks = mockWordChunks(8);
    expect(chunks.map((c) => c.text.trim()).join(' ')).toBe(MOCK_TRANSCRIPT);
    const words = wordsFromChunks(chunks);
    expect(words[0]!.start).toBeGreaterThanOrEqual(0);
    expect(words.at(-1)!.end).toBeLessThanOrEqual(8);
  });
});
