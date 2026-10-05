import type { Caption, LineRules } from '../captions/types';
import { captionsToCues } from './cues';
import { formatTimestamp } from './time';

/** WebVTT (.vtt): the format of the web's `<track>` element. Cue text is HTML-like, so escape it. */
export function toVtt(captions: readonly Caption[], rules: LineRules): string {
  const cues = captionsToCues(captions, rules).map(
    (cue, index) =>
      `${index + 1}\n${formatTimestamp(cue.start, 'vtt')} --> ${formatTimestamp(cue.end, 'vtt')}\n${cue.lines.map(escapeVtt).join('\n')}\n`,
  );
  return ['WEBVTT\n', ...cues].join('\n');
}

function escapeVtt(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
