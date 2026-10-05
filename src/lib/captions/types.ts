/** A single transcribed word. Times are in seconds from the start of the media. */
export interface Word {
  id: string;
  /** The word as displayed, trimmed, including attached punctuation (e.g. "¿Qué", "mundo,"). */
  text: string;
  start: number;
  end: number;
}

/**
 * A caption (a "cue" in SRT/VTT terms): a group of words shown on screen together.
 * `start`/`end` can extend beyond the words (e.g. to respect a minimum display time),
 * but always contain them: `start <= words[0].start` and `end >= words.at(-1).end`.
 */
export interface Caption {
  id: string;
  start: number;
  end: number;
  words: Word[];
}

/** Rules used to group words into captions and captions into lines. */
export interface LineRules {
  /** Maximum characters per line (spaces included). */
  maxCharsPerLine: number;
  /** Maximum number of lines per caption (1 or 2). */
  maxLines: number;
  /** Optional cap on words per caption, used by word-by-word styles (e.g. TikTok). */
  maxWordsPerCaption: number | null;
  /** Minimum time a caption stays on screen, in seconds. */
  minDuration: number;
  /** Maximum time a caption stays on screen, in seconds. */
  maxDuration: number;
  /** Comfortable reading speed, in characters per second. */
  maxCharsPerSecond: number;
  /** A silence at least this long (seconds) always starts a new caption. */
  pauseThreshold: number;
  /** Minimum gap between consecutive captions, in seconds (~2 frames). */
  minGap: number;
}

export type Orientation = 'vertical' | 'horizontal' | 'square';
