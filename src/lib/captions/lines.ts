import { charCount, endsClause, endsSentence, isFunctionWord, startsClause } from './text';

interface HasText {
  text: string;
}

/**
 * How bad it is to break a line (or a caption) between two words. Lower is better.
 * Breaking after a full stop is free; breaking right after "de" / "the" is expensive.
 */
export function breakPenalty(prev: string, next: string | undefined): number {
  if (next === undefined) return 0;
  if (endsSentence(prev)) return 0;
  if (startsClause(next)) return 2;
  if (endsClause(prev)) return 4;
  if (isFunctionWord(prev)) return 30;
  return 12;
}

/**
 * Splits words into the fewest lines (up to `maxLines`) that fit `maxChars`, choosing the most
 * balanced break with the best linguistic break point. Returns `null` when it is impossible
 * (too much text, or a single word longer than `maxChars`).
 *
 * Dynamic programming over break positions: cost = unbalance between lines + break penalties.
 */
export function splitIntoLines<T extends HasText>(
  words: readonly T[],
  maxChars: number,
  maxLines: number,
): T[][] | null {
  const n = words.length;
  if (n === 0) return [];
  const lengths = words.map((w) => charCount(w.text));
  if (lengths.some((len) => len > maxChars)) return null;

  // prefix[i] = characters of words[0..i) joined with spaces, plus one trailing space.
  const prefix = [0];
  for (const len of lengths) prefix.push((prefix.at(-1) ?? 0) + len + 1);
  const lineLength = (from: number, to: number) => (prefix[to] ?? 0) - (prefix[from] ?? 0) - 1;

  const total = lineLength(0, n);
  for (let lineCount = 1; lineCount <= maxLines; lineCount++) {
    if (total > lineCount * maxChars + (lineCount - 1)) continue;
    const result = bestSplit(words, lineCount, maxChars, lineLength);
    if (result) return result;
  }
  return null;
}

function bestSplit<T extends HasText>(
  words: readonly T[],
  lineCount: number,
  maxChars: number,
  lineLength: (from: number, to: number) => number,
): T[][] | null {
  const n = words.length;
  if (lineCount === 1) return lineLength(0, n) <= maxChars ? [words.slice()] : null;
  if (lineCount > n) return null;

  const target = lineLength(0, n) / lineCount;
  // cost[l][i]: best cost of putting words[0..i) into l lines; from[l][i]: start of the last line.
  const cost: number[][] = Array.from({ length: lineCount + 1 }, () =>
    new Array<number>(n + 1).fill(Infinity),
  );
  const from: number[][] = Array.from({ length: lineCount + 1 }, () =>
    new Array<number>(n + 1).fill(-1),
  );
  const row0 = cost[0];
  if (!row0) return null;
  row0[0] = 0;

  for (let l = 1; l <= lineCount; l++) {
    const row = cost[l];
    const prevRow = cost[l - 1];
    const fromRow = from[l];
    if (!row || !prevRow || !fromRow) return null;
    for (let i = l; i <= n; i++) {
      for (let j = l - 1; j < i; j++) {
        const before = prevRow[j] ?? Infinity;
        if (before === Infinity) continue;
        const len = lineLength(j, i);
        if (len > maxChars) continue;
        const lastWord = words[i - 1];
        const nextWord = words[i];
        // Penalize unbalanced lines; slightly prefer a shorter top line ("pyramid" shape).
        let lineCost = Math.abs(len - target);
        if (l < lineCount && len > target) lineCost += 0.5;
        if (l < lineCount && lastWord) lineCost += breakPenalty(lastWord.text, nextWord?.text);
        const total = before + lineCost;
        if (total < (row[i] ?? Infinity)) {
          row[i] = total;
          fromRow[i] = j;
        }
      }
    }
  }

  if ((cost[lineCount]?.[n] ?? Infinity) === Infinity) return null;
  const lines: T[][] = [];
  let end = n;
  for (let l = lineCount; l >= 1; l--) {
    const start = from[l]?.[end] ?? -1;
    if (start < 0) return null;
    lines.unshift(words.slice(start, end));
    end = start;
  }
  return lines;
}

/**
 * Always returns lines for display: the balanced split when possible, otherwise a greedy wrap
 * (which may exceed `maxLines` or `maxChars` — the editor flags those captions).
 */
export function layoutLines<T extends HasText>(
  words: readonly T[],
  maxChars: number,
  maxLines: number,
): T[][] {
  const balanced = splitIntoLines(words, maxChars, maxLines);
  if (balanced) return balanced;
  const lines: T[][] = [];
  let current: T[] = [];
  let currentLength = 0;
  for (const word of words) {
    const len = charCount(word.text);
    const extra = current.length === 0 ? len : len + 1;
    if (current.length > 0 && currentLength + extra > maxChars) {
      lines.push(current);
      current = [word];
      currentLength = len;
    } else {
      current.push(word);
      currentLength += extra;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}
