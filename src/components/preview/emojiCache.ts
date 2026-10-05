import type { Caption } from '../../lib/captions/types';

const EMPTY = new Map<string, string>();

/** Phase 3 fills this with keyword emojis; until then, no emojis. */
export function getEmojiMap(
  _captions: readonly Caption[],
  enabled: boolean,
): ReadonlyMap<string, string> {
  return enabled ? EMPTY : EMPTY;
}
