import type { Caption, LineRules } from '../captions/types';
import { captionsToCues } from './cues';
import { formatTimestamp } from './time';

/** SubRip (.srt): the most widely supported format (YouTube, Premiere, DaVinci, CapCut…). */
export function toSrt(captions: readonly Caption[], rules: LineRules): string {
  return captionsToCues(captions, rules)
    .map(
      (cue, index) =>
        `${index + 1}\n${formatTimestamp(cue.start, 'srt')} --> ${formatTimestamp(cue.end, 'srt')}\n${cue.lines.join('\n')}\n`,
    )
    .join('\n');
}
