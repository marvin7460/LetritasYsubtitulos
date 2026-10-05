import { createId, type IdFactory } from '../util/id';
import { breakPenalty, splitIntoLines } from './lines';
import { charCount, endsSentence, joinedLength } from './text';
import type { Caption, LineRules, Word } from './types';

export interface BuildOptions {
  /** Media duration in seconds; the last caption never extends past it. */
  mediaDuration?: number;
  makeId?: IdFactory;
}

/** Fixed cost of every caption: fewer, fuller captions are preferred unless a break is natural. */
const CAPTION_COST = 10;
/** Captions using less than this share of the available space are considered "too short". */
const MIN_FILL = 0.35;
/** Captions separated by less than this (seconds) are chained to avoid a flicker between them. */
const CHAIN_GAP = 0.5;

/**
 * Groups words into captions.
 *
 * Instead of a greedy "fill until it doesn't fit" loop, this finds the segmentation with the
 * lowest total cost using dynamic programming (the same idea Knuth–Plass uses to break
 * paragraphs into lines). Hard rules (max characters/lines, max duration, long pauses) make a
 * segment invalid; soft preferences (break after punctuation, never after "de"/"the", avoid tiny
 * captions, balanced lines, comfortable reading speed) add cost.
 *
 * Complexity: O(n · k) segments, where k is the max words that fit in one caption.
 */
export function buildCaptions(
  words: readonly Word[],
  rules: LineRules,
  options: BuildOptions = {},
): Caption[] {
  const n = words.length;
  if (n === 0) return [];
  const makeId = options.makeId ?? (() => createId('cap'));
  const capacity = rules.maxCharsPerLine * rules.maxLines + (rules.maxLines - 1);

  const best = new Array<number>(n + 1).fill(Infinity);
  const segmentStart = new Array<number>(n + 1).fill(-1);
  best[0] = 0;

  for (let j = 1; j <= n; j++) {
    let chars = -1;
    for (let i = j - 1; i >= 0; i--) {
      const first = words[i];
      const last = words[j - 1];
      if (!first || !last) break;
      chars += charCount(first.text) + 1;
      const count = j - i;

      if (count > 1) {
        // Hard constraints. All of them only get worse as the segment grows, so we can stop.
        if (chars > capacity) break;
        if (rules.maxWordsPerCaption !== null && count > rules.maxWordsPerCaption) break;
        const next = words[i + 1];
        if (next && next.start - first.end >= rules.pauseThreshold) break;
        if (last.end - first.start > rules.maxDuration) break;
      }

      const before = best[i] ?? Infinity;
      if (before === Infinity) continue;

      const segment = words.slice(i, j);
      const lines = splitIntoLines(segment, rules.maxCharsPerLine, rules.maxLines);
      if (!lines && count > 1) continue;

      const cost =
        before +
        segmentCost(segment, chars, lines, rules, capacity) +
        boundaryCost(words, j, rules);
      if (cost < (best[j] ?? Infinity)) {
        best[j] = cost;
        segmentStart[j] = i;
      }
    }
  }

  const segments: Word[][] = [];
  let end = n;
  while (end > 0) {
    const start = segmentStart[end] ?? -1;
    if (start < 0) throw new Error('buildCaptions: no valid segmentation (this is a bug)');
    segments.unshift(words.slice(start, end));
    end = start;
  }

  const captions = segments.map((segment) => ({
    id: makeId(),
    start: segment[0]?.start ?? 0,
    end: segment.at(-1)?.end ?? 0,
    words: segment,
  }));
  return applyTimingRules(captions, rules, options.mediaDuration);
}

function segmentCost(
  segment: readonly Word[],
  chars: number,
  lines: Word[][] | null,
  rules: LineRules,
  capacity: number,
): number {
  let cost = CAPTION_COST;
  const first = segment[0];
  const last = segment.at(-1);
  if (!first || !last) return cost;

  // Avoid tiny captions that flash on screen.
  const wordFill =
    rules.maxWordsPerCaption !== null ? segment.length / rules.maxWordsPerCaption : 0;
  const fill = Math.max(chars / capacity, wordFill);
  if (fill < MIN_FILL) cost += ((MIN_FILL - fill) / MIN_FILL) * 14;

  const duration = last.end - first.start;
  if (duration < rules.minDuration)
    cost += ((rules.minDuration - duration) / rules.minDuration) * 6;

  // Reading speed: penalize captions that would be too fast to read.
  const cps = chars / Math.max(duration, rules.minDuration);
  if (cps > rules.maxCharsPerSecond) cost += (cps - rules.maxCharsPerSecond) * 1.5;

  // A sentence ending in the middle of a caption reads worse than one ending at its edge.
  for (let k = 0; k < segment.length - 1; k++) {
    const word = segment[k];
    if (word && endsSentence(word.text)) cost += 5;
  }

  // Balanced lines read better than a long line over a one-word line.
  if (lines && lines.length > 1) {
    const lengths = lines.map((line) => joinedLength(line));
    const unbalance = Math.max(...lengths) - Math.min(...lengths);
    cost += (unbalance / rules.maxCharsPerLine) * 8;
  }
  return cost;
}

/** Cost of ending a caption right before `words[j]`. */
function boundaryCost(words: readonly Word[], j: number, rules: LineRules): number {
  const prev = words[j - 1];
  const next = words[j];
  if (!prev || !next) return 0;
  const gap = next.start - prev.end;
  if (gap >= rules.pauseThreshold) return 0;
  // Short pauses are good break points too: the penalty fades as the pause grows.
  const pauseFactor = 1 - Math.max(0, gap) / rules.pauseThreshold;
  return breakPenalty(prev.text, next.text) * pauseFactor;
}

/**
 * Sets each caption's display interval:
 * - start when its first word starts,
 * - stay at least `minDuration` and long enough to read at `maxCharsPerSecond`,
 * - never exceed `maxDuration`, never overlap the next caption (keeping `minGap`),
 * - chain captions separated by a tiny gap so the text doesn't flicker off and on.
 */
export function applyTimingRules(
  captions: readonly Caption[],
  rules: LineRules,
  mediaDuration?: number,
): Caption[] {
  const result = captions.map((c) => ({
    ...c,
    start: c.words[0]?.start ?? c.start,
    end: c.words.at(-1)?.end ?? c.end,
  }));
  for (let k = 0; k < result.length; k++) {
    const caption = result[k];
    if (!caption) continue;
    const next = result[k + 1];
    const lastWordEnd = caption.end;
    const limit = next ? next.start - rules.minGap : (mediaDuration ?? Infinity);
    const readingTime = joinedLength(caption.words) / rules.maxCharsPerSecond;
    const maxEnd = Math.max(lastWordEnd, caption.start + rules.maxDuration);

    let desired = Math.max(
      lastWordEnd,
      caption.start + rules.minDuration,
      caption.start + readingTime,
    );
    desired = Math.min(desired, maxEnd);
    if (next && limit > desired && limit - desired < CHAIN_GAP && limit <= maxEnd) desired = limit;

    caption.end = Math.max(lastWordEnd, Math.min(desired, limit));
  }
  return result;
}
