import { createId, type IdFactory } from '../util/id';
import type { Word } from './types';

/** The `chunks` Transformers.js returns with `return_timestamps: 'word'`. */
export interface RawWordChunk {
  text: string;
  timestamp: readonly (number | null | undefined)[];
}

const MIN_WORD_DURATION = 0.02;
const FALLBACK_WORD_DURATION = 0.3;
const PUNCTUATION_ONLY = /^[\p{P}\p{S}]+$/u;
const OPENING_PUNCTUATION = /^[¿¡(«"“‘[]+$/u;

/**
 * Turns raw Whisper word chunks into clean, ordered words:
 * trims text, drops empty chunks, glues stray punctuation to its neighbour, fills missing
 * timestamps and guarantees `start < end` with no overlaps between consecutive words.
 */
export function wordsFromChunks(
  chunks: readonly RawWordChunk[],
  makeId: IdFactory = () => createId('w'),
): Word[] {
  const words: Word[] = [];
  let pendingPrefix = '';

  for (let k = 0; k < chunks.length; k++) {
    const chunk = chunks[k];
    if (!chunk) continue;
    const text = chunk.text.trim();
    if (!text) continue;

    if (PUNCTUATION_ONLY.test(text)) {
      const prev = words.at(-1);
      if (OPENING_PUNCTUATION.test(text) || !prev) pendingPrefix += text;
      else prev.text += text;
      continue;
    }

    const prevEnd = words.at(-1)?.end ?? 0;
    const rawStart = finite(chunk.timestamp[0]);
    const rawEnd = finite(chunk.timestamp[1]);
    const nextStart = finite(chunks[k + 1]?.timestamp[0]);

    let start = round(Math.max(0, rawStart ?? prevEnd));
    let end = round(rawEnd ?? nextStart ?? start + FALLBACK_WORD_DURATION);

    const prev = words.at(-1);
    if (prev && start < prev.end) {
      // Overlap: shrink the previous word when possible, otherwise push this one later.
      if (start > prev.start + MIN_WORD_DURATION) prev.end = start;
      else start = prev.end;
    }
    end = Math.max(end, round(start + MIN_WORD_DURATION));

    words.push({ id: makeId(), text: pendingPrefix + text, start, end });
    pendingPrefix = '';
  }

  const last = words.at(-1);
  if (pendingPrefix && last) last.text += pendingPrefix;
  return words;
}

function finite(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
