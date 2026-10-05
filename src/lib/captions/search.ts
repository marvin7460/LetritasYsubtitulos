import { createId, type IdFactory } from '../util/id';
import { editCaptionText } from './edit';
import { joinWords } from './text';
import type { Caption } from './types';

export interface SearchOptions {
  matchCase: boolean;
  wholeWord: boolean;
}

export interface SearchMatch {
  captionId: string;
  /** Character offsets in the caption text (words joined by single spaces). */
  index: number;
  length: number;
}

/**
 * TODO(Marvin): make search ignore accents, so "cancion" finds "canción" and "ANIMO" finds
 * "ánimo". Today it only ignores upper/lower case.
 *
 * Rule: the returned string MUST have the same length as the input — match offsets are used
 * to replace text in the original string, so removing characters would break replacements.
 *
 * Hints:
 * - "á".normalize('NFD') is "a" + U+0301 (a combining accent). `/\p{M}/gu` matches those marks.
 * - Fold each character on its own: `[...text].map((ch) => …).join('')`, so "á" → "a" keeps
 *   one character per character. Keep "ñ" as is if you want ("año" ≠ "ano").
 * - Add tests in search.test.ts (there are `it.todo`s waiting for you).
 */
export function foldForSearch(text: string, matchCase: boolean): string {
  return matchCase ? text : text.toLocaleLowerCase('es');
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

export function findMatches(
  captions: readonly Caption[],
  query: string,
  options: SearchOptions,
): SearchMatch[] {
  if (!query) return [];
  const needle = foldForSearch(query, options.matchCase);
  const matches: SearchMatch[] = [];
  for (const caption of captions) {
    const original = joinWords(caption.words);
    const haystack = foldForSearch(original, options.matchCase);
    let from = 0;
    for (;;) {
      const index = haystack.indexOf(needle, from);
      if (index === -1) break;
      from = index + Math.max(1, needle.length);
      if (options.wholeWord) {
        const before = original[index - 1];
        const after = original[index + needle.length];
        if ((before && WORD_CHAR.test(before)) || (after && WORD_CHAR.test(after))) continue;
      }
      matches.push({ captionId: caption.id, index, length: needle.length });
    }
  }
  return matches;
}

/** Replaces every match, re-timing edited captions with `editCaptionText`. */
export function replaceAll(
  captions: readonly Caption[],
  query: string,
  replacement: string,
  options: SearchOptions,
  makeId: IdFactory = () => createId('w'),
): { captions: Caption[]; count: number } {
  const matches = findMatches(captions, query, options);
  if (matches.length === 0) return { captions: [...captions], count: 0 };
  const byCaption = new Map<string, SearchMatch[]>();
  for (const match of matches)
    byCaption.set(match.captionId, [...(byCaption.get(match.captionId) ?? []), match]);

  const result: Caption[] = [];
  for (const caption of captions) {
    const list = byCaption.get(caption.id);
    if (!list) {
      result.push(caption);
      continue;
    }
    let text = joinWords(caption.words);
    for (const match of [...list].reverse()) {
      text = text.slice(0, match.index) + replacement + text.slice(match.index + match.length);
    }
    const edited = editCaptionText(caption, text, makeId);
    if (edited) result.push(edited);
  }
  return { captions: result, count: matches.length };
}
