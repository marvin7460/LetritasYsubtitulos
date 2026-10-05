import type { Caption } from '../captions/types';

/** Keyword → emoji. Keys are lowercase, written as they usually appear. */
export const EMOJI_KEYWORDS: Readonly<Record<string, string>> = {
  dinero: '💰',
  plata: '💰',
  money: '💰',
  amor: '❤️',
  love: '❤️',
  corazón: '❤️',
  fuego: '🔥',
  fire: '🔥',
  increíble: '🤯',
  amazing: '🤯',
  idea: '💡',
  ideas: '💡',
  música: '🎵',
  music: '🎵',
  comida: '🍕',
  food: '🍕',
  café: '☕',
  coffee: '☕',
  tiempo: '⏰',
  time: '⏰',
  trabajo: '💼',
  work: '💼',
  casa: '🏠',
  home: '🏠',
  viaje: '✈️',
  travel: '✈️',
  feliz: '😄',
  happy: '😄',
  triste: '😢',
  sad: '😢',
  risa: '😂',
  gracias: '🙏',
  thanks: '🙏',
  cohete: '🚀',
  rápido: '⚡',
  fast: '⚡',
  secreto: '🤫',
  secret: '🤫',
  ojo: '👀',
  mira: '👀',
  look: '👀',
  ganar: '🏆',
  win: '🏆',
  video: '🎬',
  videos: '🎬',
  subtítulos: '💬',
  navegador: '🌐',
  computadora: '💻',
  computer: '💻',
};

/**
 * TODO(Marvin): make keyword matching forgiving. Today only an exact lowercase match works, so
 * "Dinero" works but "DINERO," (TikTok style is uppercase), "dineros", "increible" (no accent)
 * or "¡Fuego!" don't get their emoji.
 *
 * Hints:
 * 1. Strip punctuation around the word: `normalizeToken` in '../captions/text' does it.
 * 2. Compare without accents on both sides: the NFD trick from `foldForSearch` (search.ts).
 * 3. Simple plurals: if there's no match, try removing a final "es" or "s".
 * 4. Replace the `it.todo`s in emojis.test.ts with real tests.
 */
export function pickEmoji(word: string): string | null {
  return EMOJI_KEYWORDS[word.toLowerCase()] ?? null;
}

/** Word id → emoji for every keyword word, at most one emoji per caption. */
export function computeEmojiMap(captions: readonly Caption[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const caption of captions) {
    for (const word of caption.words) {
      const emoji = pickEmoji(word.text);
      if (emoji) {
        map.set(word.id, emoji);
        break;
      }
    }
  }
  return map;
}
