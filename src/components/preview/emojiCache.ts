import type { Caption } from '../../lib/captions/types';
import { computeEmojiMap } from '../../lib/render/emojis';

const EMPTY: ReadonlyMap<string, string> = new Map();
let lastCaptions: readonly Caption[] | null = null;
let lastMap: ReadonlyMap<string, string> = EMPTY;

/** Memoized per captions array (immutable), so the per-frame render loop doesn't recompute it. */
export function getEmojiMap(
  captions: readonly Caption[],
  enabled: boolean,
): ReadonlyMap<string, string> {
  if (!enabled) return EMPTY;
  if (captions !== lastCaptions) {
    lastCaptions = captions;
    lastMap = computeEmojiMap(captions);
  }
  return lastMap;
}
