import { describe, expect, it } from 'vitest';
import { sequentialIds } from '../util/id';
import { wordsFromChunks } from './sanitize';

const ids = () => sequentialIds('w');

describe('wordsFromChunks', () => {
  it('trims text and keeps timestamps', () => {
    expect(wordsFromChunks([{ text: ' Hola', timestamp: [0, 0.4] }], ids())).toEqual([
      { id: 'w1', text: 'Hola', start: 0, end: 0.4 },
    ]);
  });

  it('glues stray punctuation to its neighbours', () => {
    const result = wordsFromChunks(
      [
        { text: ' ¿', timestamp: [0, 0.1] },
        { text: 'Qué', timestamp: [0.1, 0.3] },
        { text: ' tal', timestamp: [0.3, 0.6] },
        { text: '?', timestamp: [0.6, 0.62] },
      ],
      ids(),
    );
    expect(result.map((w) => w.text)).toEqual(['¿Qué', 'tal?']);
  });

  it('fills missing timestamps', () => {
    const result = wordsFromChunks(
      [
        { text: ' uno', timestamp: [0, 0.3] },
        { text: ' dos', timestamp: [0.4, null] },
        { text: ' tres', timestamp: [0.9, 1.2] },
      ],
      ids(),
    );
    expect(result[1]).toMatchObject({ start: 0.4, end: 0.9 });
  });

  it('removes overlaps and enforces a minimum duration', () => {
    const result = wordsFromChunks(
      [
        { text: ' uno', timestamp: [0, 0.5] },
        { text: ' dos', timestamp: [0.3, 0.3] },
      ],
      ids(),
    );
    expect(result[0]!.end).toBeLessThanOrEqual(result[1]!.start);
    expect(result[1]!.end).toBeGreaterThan(result[1]!.start);
  });

  it('drops empty chunks', () => {
    expect(wordsFromChunks([{ text: '  ', timestamp: [0, 1] }], ids())).toEqual([]);
  });
});
