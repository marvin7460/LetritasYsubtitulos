import type { Word } from '../captions/types';

/**
 * Phrases Whisper is known to "hallucinate". It was trained on internet videos with fan-made
 * subtitles, so on silence or music it sometimes writes credits nobody said.
 */
export const KNOWN_HALLUCINATIONS: readonly string[] = [
  'subtítulos realizados por la comunidad de amara.org',
  'subtítulos por la comunidad de amara.org',
  'gracias por ver el video',
  'gracias por ver',
  'suscríbete al canal',
  'thanks for watching',
  'thank you for watching',
  'please subscribe',
];

/**
 * TODO(Marvin): remove hallucinated phrases from the transcription.
 *
 * Right now this returns the words untouched (so the app works), but a video with a silent
 * ending often gets a fake "Subtítulos realizados por la comunidad de Amara.org" caption.
 *
 * Hints:
 * 1. Normalize each word with `normalizeToken` from '../captions/text' (lowercase, no
 *    punctuation) and normalize the phrases in KNOWN_HALLUCINATIONS the same way, split by spaces
 *    ("amara.org" → "amaraorg").
 * 2. Slide over `words` comparing word by word against each phrase.
 * 3. Only drop a match when it is suspicious: surrounded by ≥ 1 s of silence (look at the
 *    previous word's `end` and the next word's `start`), or at the very end of the media
 *    (`mediaDuration`). A real person *can* say "gracias por ver" in the middle of a sentence!
 * 4. Replace the `it.todo`s in `hallucinations.test.ts` with real tests, then run `npm test`.
 */
export function cleanHallucinations(words: readonly Word[], _mediaDuration?: number): Word[] {
  return [...words];
}
