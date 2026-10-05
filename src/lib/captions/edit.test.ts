import { describe, expect, it } from 'vitest';
import { words } from '../../test/fixtures';
import { sequentialIds } from '../util/id';
import { setCaptionTiming, mergeWithNext, splitCaptionAt, updateCaptionText } from './docOps';
import { editCaptionText, lcs, retimeCaption, splitIndexAt } from './edit';
import type { Caption } from './types';

const caption = (spec: string, id = 'c1'): Caption => {
  const w = words(spec);
  return { id, start: w[0]!.start, end: w.at(-1)!.end, words: w };
};
const ids = () => sequentialIds('n');

const isWellFormed = (c: Caption) =>
  c.words.every((w, i) => w.end > w.start && (i === 0 || w.start >= c.words[i - 1]!.end - 1e-9)) &&
  c.start <= c.words[0]!.start &&
  c.end >= c.words.at(-1)!.end;

describe('lcs', () => {
  it('finds matched pairs in order', () => {
    expect(lcs(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd'])).toEqual([
      [0, 0],
      [2, 2],
      [3, 3],
    ]);
  });
});

describe('editCaptionText (timing redistribution)', () => {
  const base = caption('Hola@0-0.5 mundo@0.6-1.0 cruel@1.2-1.8');

  it('keeps timings and ids when only case or punctuation changes', () => {
    const edited = editCaptionText(base, '¡Hola, Mundo cruel!', ids())!;
    expect(edited.words.map((w) => [w.id, w.text, w.start, w.end])).toEqual([
      ['w1', '¡Hola,', 0, 0.5],
      ['w2', 'Mundo', 0.6, 1.0],
      ['w3', 'cruel!', 1.2, 1.8],
    ]);
  });

  it('keeps the timing of a corrected word (1-to-1 replacement)', () => {
    const edited = editCaptionText(base, 'Hola mundo cruel', ids())!;
    expect(edited).toEqual(base);
    const fixed = editCaptionText(base, 'Hola mundo fiel', ids())!;
    expect(fixed.words[2]).toMatchObject({ id: 'w3', text: 'fiel', start: 1.2, end: 1.8 });
  });

  it('splits the time of a replaced word among its replacements', () => {
    const edited = editCaptionText(base, 'Hola mundo muy cruel', ids())!;
    expect(edited.words.map((w) => w.text)).toEqual(['Hola', 'mundo', 'muy', 'cruel']);
    expect(edited.words[0]).toMatchObject({ start: 0, end: 0.5 });
    expect(edited.words[3]).toMatchObject({ start: 1.2, end: 1.8 });
    // "muy" goes into the silence between "mundo" and "cruel".
    expect(edited.words[2]!.start).toBeGreaterThanOrEqual(1.0);
    expect(edited.words[2]!.end).toBeLessThanOrEqual(1.2);
    expect(isWellFormed(edited)).toBe(true);
  });

  it('distributes a replaced phrase proportionally to word length', () => {
    const edited = editCaptionText(base, 'Hola a todo el planeta', ids())!;
    const inserted = edited.words.slice(1);
    expect(inserted[0]!.start).toBeCloseTo(0.6, 5);
    expect(inserted.at(-1)!.end).toBeCloseTo(1.8, 5);
    const durations = inserted.map((w) => w.end - w.start);
    expect(durations[3]).toBeGreaterThan(durations[0]!); // "planeta" > "a"
    expect(isWellFormed(edited)).toBe(true);
  });

  it('falls back to proportional timing over the whole caption when there is no room', () => {
    const tight = caption('uno@0-0.5 dos@0.5-1');
    const edited = editCaptionText(tight, 'uno y tres más dos', ids())!;
    expect(edited.words).toHaveLength(5);
    expect(edited.words[0]!.start).toBe(0);
    expect(edited.words.at(-1)!.end).toBeCloseTo(1, 5);
    expect(isWellFormed(edited)).toBe(true);
  });

  it('handles deletions', () => {
    const edited = editCaptionText(base, 'Hola cruel', ids())!;
    expect(edited.words.map((w) => [w.text, w.start])).toEqual([
      ['Hola', 0],
      ['cruel', 1.2],
    ]);
  });

  it('returns null for empty text', () => {
    expect(editCaptionText(base, '   ')).toBeNull();
  });
});

describe('document operations', () => {
  const doc = [caption('a@0-0.5 b@0.6-1 c@1.1-1.5', 'c1'), caption('d@3-3.5 e@3.6-4', 'c2')];

  it('splits and merges back to the same words', () => {
    const split = splitCaptionAt(doc, 'c1', 1, ids());
    expect(split.map((c) => c.words.map((w) => w.text).join(' '))).toEqual(['a', 'b c', 'd e']);
    expect(split[1]!.start).toBe(0.6);
    const merged = mergeWithNext(split, 'c1');
    expect(merged[0]!.words).toEqual(doc[0]!.words);
  });

  it('deletes a caption when its text is cleared', () => {
    expect(updateCaptionText(doc, 'c1', '')).toEqual([doc[1]]);
  });

  it('reuses untouched caption objects (cheap undo snapshots)', () => {
    const next = updateCaptionText(doc, 'c1', 'a b x');
    expect(next[1]).toBe(doc[1]);
  });

  it('retimes words linearly', () => {
    const moved = retimeCaption(doc[0]!, 1, 2.5);
    expect(moved.words.map((w) => w.start)).toEqual([1, 1.6, 2.1]);
    expect(moved.words.at(-1)!.end).toBe(2.5);
  });

  it('clamps timing changes to the neighbours', () => {
    const result = setCaptionTiming(doc, 'c1', 0, 5, { minGap: 0.1 });
    expect(result[0]!.end).toBeCloseTo(2.9, 5);
    const moved = setCaptionTiming(doc, 'c2', 1, 2, { minGap: 0.1 });
    expect(moved[1]!.start).toBeCloseTo(1.6, 5);
    expect(moved[1]!.end - moved[1]!.start).toBeCloseTo(1, 5);
  });

  it('finds the word to split at the playhead', () => {
    expect(splitIndexAt(doc[0]!, 0.7)).toBe(2);
    expect(splitIndexAt(doc[0]!, 0)).toBe(1);
    expect(splitIndexAt(doc[0]!, 9)).toBe(2);
  });
});
