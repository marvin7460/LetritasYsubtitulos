import { splitIntoLines } from './lines';
import { joinedLength } from './text';
import type { Caption, LineRules } from './types';

export type CaptionIssue = 'too-long' | 'too-fast' | 'too-short' | 'too-long-on-screen';

export const ISSUE_LABELS: Record<CaptionIssue, string> = {
  'too-long': 'No cabe en las líneas permitidas',
  'too-fast': 'Demasiado rápido para leer',
  'too-short': 'Dura muy poco en pantalla',
  'too-long-on-screen': 'Dura demasiado en pantalla',
};

/** Checks a caption against the line rules. The editor shows these as warnings. */
export function captionIssues(caption: Caption, rules: LineRules): CaptionIssue[] {
  const issues: CaptionIssue[] = [];
  const duration = caption.end - caption.start;
  if (
    caption.words.length > 1 &&
    !splitIntoLines(caption.words, rules.maxCharsPerLine, rules.maxLines)
  ) {
    issues.push('too-long');
  }
  // 10% tolerance: reading speed is a guideline, not a hard limit.
  if (duration > 0 && joinedLength(caption.words) / duration > rules.maxCharsPerSecond * 1.1) {
    issues.push('too-fast');
  }
  if (duration < rules.minDuration * 0.6) issues.push('too-short');
  if (duration > rules.maxDuration + 0.5) issues.push('too-long-on-screen');
  return issues;
}
