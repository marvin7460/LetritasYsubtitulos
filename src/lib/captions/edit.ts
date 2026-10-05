import { createId, type IdFactory } from '../util/id';
import { charCount, normalizeToken } from './text';
import type { Caption, Word } from './types';

const MIN_WORD = 0.06;

/**
 * Applies a text correction to a caption, keeping word timings wherever possible.
 *
 * 1. Align old and new words with a longest-common-subsequence diff (case and punctuation
 *    insensitive), so "hola mundo" → "Hola, mundo" keeps both timings.
 * 2. Matched words keep their exact times (only the text changes).
 * 3. Each changed region gets the time span of the words it replaces (or, for pure insertions,
 *    the silence between its neighbours) and splits it proportionally to word length.
 * 4. If a region has no room (an insertion between two touching words), redistribute the whole
 *    caption proportionally — slightly less precise, never broken.
 *
 * Returns null when the new text is empty (the caller deletes the caption).
 */
export function editCaptionText(
  caption: Caption,
  newText: string,
  makeId: IdFactory = () => createId('w'),
): Caption | null {
  const tokens = newText.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const old = caption.words;
  const span = {
    start: old[0]?.start ?? caption.start,
    end: old.at(-1)?.end ?? caption.end,
  };

  const pairs = lcs(
    old.map((w) => key(w.text)),
    tokens.map(key),
  );
  const result: Word[] = [];
  let oi = 0;
  let ni = 0;
  const room = { fits: true };

  const fillGap = (oldEnd: number, newEnd: number, nextAnchor: Word | undefined) => {
    const replaced = old.slice(oi, oldEnd);
    const inserted = tokens.slice(ni, newEnd);
    if (inserted.length === 0) return;
    if (replaced.length === inserted.length) {
      // Same number of words: a one-to-one correction keeps each word's timing and id.
      inserted.forEach((text, k) => {
        const source = replaced[k];
        if (source) result.push({ ...source, text });
      });
      return;
    }
    const from = replaced[0]?.start ?? result.at(-1)?.end ?? caption.start;
    const to = replaced.at(-1)?.end ?? nextAnchor?.start ?? caption.end;
    if (to - from < MIN_WORD * inserted.length) room.fits = false;
    result.push(...distribute(inserted, from, to, makeId));
  };

  for (const [i, j] of pairs) {
    fillGap(i, j, old[i]);
    const anchor = old[i];
    const text = tokens[j];
    if (anchor && text !== undefined) result.push({ ...anchor, text });
    oi = i + 1;
    ni = j + 1;
  }
  fillGap(old.length, tokens.length, undefined);

  const words = room.fits ? result : distribute(tokens, span.start, span.end, makeId, result);
  return {
    ...caption,
    start: Math.min(caption.start, words[0]?.start ?? caption.start),
    end: Math.max(caption.end, words.at(-1)?.end ?? caption.end),
    words,
  };
}

function key(text: string): string {
  return normalizeToken(text) || text;
}

/** Splits [from, to] among words proportionally to their length (+1 so short words get time). */
function distribute(
  tokens: readonly string[],
  from: number,
  to: number,
  makeId: IdFactory,
  reuse: readonly Word[] = [],
): Word[] {
  const weights = tokens.map((t) => charCount(t) + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const duration = Math.max(to - from, MIN_WORD * tokens.length);
  let cursor = from;
  return tokens.map((text, k) => {
    const length = (duration * (weights[k] ?? 1)) / total;
    const start = round(cursor);
    cursor += length;
    return { id: reuse[k]?.id ?? makeId(), text, start, end: round(cursor) };
  });
}

/** Longest common subsequence of two token lists, as matched index pairs. */
export function lcs(a: readonly string[], b: readonly string[]): [number, number][] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i] === b[j]
          ? (table[(i + 1) * cols + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0)) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/** Splits a caption before `wordIndex`. Returns null if the index isn't strictly inside. */
export function splitCaption(
  caption: Caption,
  wordIndex: number,
  makeId: IdFactory = () => createId('cap'),
): [Caption, Caption] | null {
  if (wordIndex <= 0 || wordIndex >= caption.words.length) return null;
  const first = caption.words.slice(0, wordIndex);
  const second = caption.words.slice(wordIndex);
  const lastOfFirst = first.at(-1);
  const firstOfSecond = second[0];
  if (!lastOfFirst || !firstOfSecond) return null;
  return [
    { id: caption.id, start: caption.start, end: lastOfFirst.end, words: first },
    { id: makeId(), start: firstOfSecond.start, end: caption.end, words: second },
  ];
}

/** Index of the word to split at for a given time (the "split at playhead" shortcut). */
export function splitIndexAt(caption: Caption, time: number): number {
  const index = caption.words.findIndex((w) => w.start >= time);
  const n = caption.words.length;
  if (index === -1) return n - 1;
  return Math.min(Math.max(index, 1), n - 1);
}

export function mergeCaptions(first: Caption, second: Caption): Caption {
  return {
    id: first.id,
    start: Math.min(first.start, second.start),
    end: Math.max(first.end, second.end),
    words: [...first.words, ...second.words],
  };
}

/**
 * Moves/resizes a caption, remapping its words linearly into the new interval
 * (dragging the whole block shifts the words; dragging an edge stretches them).
 */
export function retimeCaption(caption: Caption, start: number, end: number): Caption {
  const oldDuration = caption.end - caption.start;
  const scale = oldDuration > 0 ? (end - start) / oldDuration : 1;
  const map = (t: number) => round(start + (t - caption.start) * scale);
  return {
    ...caption,
    start: round(start),
    end: round(end),
    words: caption.words.map((w) => ({
      ...w,
      start: map(w.start),
      end: Math.max(map(w.end), map(w.start) + 0.01),
    })),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
