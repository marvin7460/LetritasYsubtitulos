import { layoutLines } from '../captions/lines';
import { joinWords } from '../captions/text';
import type { Caption, LineRules } from '../captions/types';

export interface Cue {
  start: number;
  end: number;
  lines: string[];
}

/**
 * Converts captions into ordered cues with their final line breaks. Every text exporter goes
 * through here, so SRT, VTT, ASS and the burned-in video always break lines identically.
 */
export function captionsToCues(captions: readonly Caption[], rules: LineRules): Cue[] {
  return captions
    .filter((c) => c.words.length > 0 && c.end > c.start)
    .toSorted((a, b) => a.start - b.start)
    .map((c) => ({
      start: c.start,
      end: c.end,
      lines: layoutLines(c.words, rules.maxCharsPerLine, rules.maxLines).map(joinWords),
    }));
}
