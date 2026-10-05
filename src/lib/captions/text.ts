/**
 * Small text helpers shared by line building, editing and exporting.
 * Character counts use Unicode code points so "ñ", "á" or "💰" count as one character.
 */

export function charCount(text: string): number {
  let count = 0;
  for (const _ of text) count++;
  return count;
}

export function joinWords(words: readonly { text: string }[]): string {
  return words.map((w) => w.text).join(' ');
}

/** Characters of the words joined by single spaces, without building the string. */
export function joinedLength(words: readonly { text: string }[]): number {
  if (words.length === 0) return 0;
  let total = words.length - 1;
  for (const w of words) total += charCount(w.text);
  return total;
}

const CLOSING = `"'»”’)\\]`;
const SENTENCE_END = new RegExp(`[.!?…][${CLOSING}]*$`, 'u');
const CLAUSE_END = new RegExp(`[,;:—–][${CLOSING}]*$`, 'u');
const CLAUSE_START = /^[¿¡(«"“‘[]/u;

/** "hola." / "¿listos?" / "fin…" → true */
export function endsSentence(text: string): boolean {
  return SENTENCE_END.test(text);
}

/** "hola," / "pero:" → true */
export function endsClause(text: string): boolean {
  return CLAUSE_END.test(text);
}

/** "¿Qué" / "¡Vamos" / "(nota" → true */
export function startsClause(text: string): boolean {
  return CLAUSE_START.test(text);
}

/** Lowercase, accents kept, punctuation removed: "¿Qué," → "qué". */
export function normalizeToken(text: string): string {
  return text
    .toLocaleLowerCase('es')
    .replace(/[^\p{L}\p{N}'’-]+/gu, '')
    .replace(/^['’-]+|['’-]+$/gu, '');
}

/**
 * Words that read badly at the end of a line or caption ("la", "de", "the", "of"…).
 * Breaking right after them splits a phrase in two, so the line builder penalizes it.
 */
// prettier-ignore
const FUNCTION_WORDS = new Set([
  // Spanish
  'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'el', 'en', 'entre',
  'hacia', 'hasta', 'la', 'las', 'lo', 'los', 'mi', 'mis', 'muy', 'ni', 'o', 'para', 'pero', 'por',
  'que', 'se', 'si', 'sin', 'sobre', 'su', 'sus', 'tan', 'te', 'tu', 'tus', 'u', 'un', 'una',
  'unas', 'unos', 'y', 'e', 'nos', 'les', 'le', 'me', 'cuando', 'como', 'donde', 'este', 'esta',
  'ese', 'esa', 'aquel', 'aquella',
  // English
  'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'i', 'if', 'in', 'into',
  'is', 'it', 'its', 'my', 'nor', 'of', 'on', 'or', 'our', 'so', 'than', 'that', 'the', 'their',
  'this', 'to', 'was', 'we', 'were', 'with', 'you', 'your', 'very', 'will', 'can', 'just',
]);

export function isFunctionWord(text: string): boolean {
  if (endsSentence(text) || endsClause(text)) return false;
  return FUNCTION_WORDS.has(normalizeToken(text));
}
