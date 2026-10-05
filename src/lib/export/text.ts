import { joinWords } from '../captions/text';
import type { Caption, LineRules } from '../captions/types';
import type { CaptionStyle } from '../render/style';

/** Plain text: one paragraph per pause longer than `paragraphGap` seconds. */
export function toPlainText(captions: readonly Caption[], paragraphGap = 1.5): string {
  const paragraphs: string[][] = [];
  let previousEnd = -Infinity;
  for (const caption of captions) {
    const firstStart = caption.words[0]?.start ?? caption.start;
    if (paragraphs.length === 0 || firstStart - previousEnd > paragraphGap) paragraphs.push([]);
    paragraphs.at(-1)?.push(joinWords(caption.words));
    previousEnd = caption.words.at(-1)?.end ?? caption.end;
  }
  return paragraphs.map((p) => p.join(' ')).join('\n\n') + '\n';
}

export interface JsonExport {
  format: 'letritas';
  version: 1;
  language: string | null;
  rules: LineRules;
  style: CaptionStyle;
  captions: {
    start: number;
    end: number;
    text: string;
    words: { text: string; start: number; end: number }[];
  }[];
}

/** Full data with word timings, for developers or other tools. */
export function toJson(
  captions: readonly Caption[],
  rules: LineRules,
  style: CaptionStyle,
  language: string | null,
): string {
  const data: JsonExport = {
    format: 'letritas',
    version: 1,
    language,
    rules,
    style,
    captions: captions.map((c) => ({
      start: c.start,
      end: c.end,
      text: joinWords(c.words),
      words: c.words.map((w) => ({ text: w.text, start: w.start, end: w.end })),
    })),
  };
  return JSON.stringify(data, null, 2) + '\n';
}
