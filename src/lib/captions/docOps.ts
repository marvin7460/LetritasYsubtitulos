import { createId, type IdFactory } from '../util/id';
import { editCaptionText, mergeCaptions, retimeCaption, splitCaption } from './edit';
import type { Caption } from './types';

/**
 * Document-level operations on the (sorted) caption list. All return a new array and reuse
 * untouched caption objects, which keeps undo snapshots cheap.
 */

const MIN_CAPTION = 0.2;

function indexOf(captions: readonly Caption[], id: string): number {
  return captions.findIndex((c) => c.id === id);
}

export function updateCaptionText(
  captions: readonly Caption[],
  id: string,
  text: string,
  makeId?: IdFactory,
): Caption[] {
  const index = indexOf(captions, id);
  const caption = captions[index];
  if (!caption) return [...captions];
  const edited = editCaptionText(caption, text, makeId);
  if (!edited) return removeCaption(captions, id);
  return captions.map((c, i) => (i === index ? edited : c));
}

export function splitCaptionAt(
  captions: readonly Caption[],
  id: string,
  wordIndex: number,
  makeId: IdFactory = () => createId('cap'),
): Caption[] {
  const index = indexOf(captions, id);
  const caption = captions[index];
  const parts = caption ? splitCaption(caption, wordIndex, makeId) : null;
  if (!parts) return [...captions];
  return [...captions.slice(0, index), ...parts, ...captions.slice(index + 1)];
}

export function mergeWithNext(captions: readonly Caption[], id: string): Caption[] {
  const index = indexOf(captions, id);
  const first = captions[index];
  const second = captions[index + 1];
  if (!first || !second) return [...captions];
  return [...captions.slice(0, index), mergeCaptions(first, second), ...captions.slice(index + 2)];
}

export function removeCaption(captions: readonly Caption[], id: string): Caption[] {
  return captions.filter((c) => c.id !== id);
}

/**
 * Sets a caption's interval, clamped so it never overlaps its neighbours (keeping `minGap`)
 * and never gets shorter than 0.2 s. Words are remapped linearly.
 */
export function setCaptionTiming(
  captions: readonly Caption[],
  id: string,
  start: number,
  end: number,
  options: { minGap: number; mediaDuration?: number },
): Caption[] {
  const index = indexOf(captions, id);
  const caption = captions[index];
  if (!caption) return [...captions];
  const prev = captions[index - 1];
  const next = captions[index + 1];
  const lower = prev ? prev.end + options.minGap : 0;
  const upper = next ? next.start - options.minGap : (options.mediaDuration ?? Infinity);

  let s = Math.max(lower, start);
  let e = Math.min(upper, end);
  const wasMove = Math.abs(end - start - (caption.end - caption.start)) < 1e-6;
  if (wasMove) {
    // Moving the whole block: keep its duration, push it back inside the allowed range.
    const duration = caption.end - caption.start;
    if (start < lower) e = Math.min(upper, lower + duration);
    if (end > upper) s = Math.max(lower, upper - duration);
  }
  if (e - s < MIN_CAPTION) {
    if (s === Math.max(lower, start)) e = Math.min(upper, s + MIN_CAPTION);
    else s = Math.max(lower, e - MIN_CAPTION);
  }
  if (e - s < MIN_CAPTION / 2) return [...captions];
  return captions.map((c, i) => (i === index ? retimeCaption(caption, s, e) : c));
}
