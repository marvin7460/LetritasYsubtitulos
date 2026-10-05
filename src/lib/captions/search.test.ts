import { describe, expect, it } from 'vitest';
import { words } from '../../test/fixtures';
import { captionIssues } from './issues';
import { HORIZONTAL_RULES } from './rules';
import { findMatches, replaceAll } from './search';
import { joinWords } from './text';
import type { Caption } from './types';

const caption = (spec: string, id: string): Caption => {
  const w = words(spec);
  return { id, start: w[0]!.start, end: w.at(-1)!.end, words: w };
};
const doc = [
  caption('Hola@0-0.5 Juan,@0.6-1 ¿cómo@1.1-1.5 estás?@1.6-2', 'c1'),
  caption('Juanito@3-3.5 dijo@3.6-4 hola@4.1-4.5', 'c2'),
];
const options = { matchCase: false, wholeWord: false };

describe('findMatches', () => {
  it('is case-insensitive by default', () => {
    expect(findMatches(doc, 'hola', options)).toHaveLength(2);
    expect(findMatches(doc, 'hola', { ...options, matchCase: true })).toHaveLength(1);
  });

  it('can match whole words only', () => {
    expect(findMatches(doc, 'juan', options)).toHaveLength(2);
    expect(findMatches(doc, 'juan', { ...options, wholeWord: true })).toHaveLength(1);
  });

  it('returns nothing for an empty query', () => {
    expect(findMatches(doc, '', options)).toEqual([]);
  });

  // TODO(Marvin): make these pass by implementing foldForSearch.
  it.todo('ignores accents: "como" finds "¿cómo"');
  it.todo('keeps offsets valid for replacing accented text');
});

describe('replaceAll', () => {
  it('replaces every match and keeps timings of untouched words', () => {
    const { captions, count } = replaceAll(doc, 'Juan', 'Ana', { ...options, wholeWord: true });
    expect(count).toBe(1);
    expect(joinWords(captions[0]!.words)).toBe('Hola Ana, ¿cómo estás?');
    expect(captions[0]!.words[1]).toMatchObject({ start: 0.6, end: 1 });
    expect(captions[1]).toBe(doc[1]);
  });
});

describe('captionIssues', () => {
  it('flags captions that are too fast or too long', () => {
    const fast = caption('Esta@0-0.1 frase@0.1-0.2 es@0.2-0.3 rapidísima@0.3-0.4', 'f');
    expect(captionIssues(fast, HORIZONTAL_RULES)).toContain('too-fast');
    const long = caption(Array.from({ length: 30 }, (_, i) => `palabra${i}`).join(' '), 'l');
    expect(captionIssues(long, HORIZONTAL_RULES)).toContain('too-long');
  });

  it('accepts a comfortable caption', () => {
    expect(captionIssues(caption('Hola@0-0.6 mundo@0.7-1.6', 'ok'), HORIZONTAL_RULES)).toEqual([]);
  });
});
