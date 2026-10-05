export type TimestampFormat = 'srt' | 'vtt' | 'ass';

/**
 * Formats seconds as a subtitle timestamp:
 * - SRT: `HH:MM:SS,mmm` (comma before milliseconds)
 * - VTT: `HH:MM:SS.mmm` (dot before milliseconds)
 * - ASS: `H:MM:SS.cc`   (centiseconds, single-digit hours)
 *
 * Rounds once to the target precision *before* splitting into units, so 59.9999 s becomes
 * `00:01:00,000` instead of the invalid `00:00:59,1000`.
 */
export function formatTimestamp(seconds: number, format: TimestampFormat): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const unitsPerSecond = format === 'ass' ? 100 : 1000;
  const total = Math.round(safe * unitsPerSecond);

  const fraction = total % unitsPerSecond;
  const totalSeconds = Math.floor(total / unitsPerSecond);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);

  if (format === 'ass') return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(fraction, 2)}`;
  const separator = format === 'srt' ? ',' : '.';
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${separator}${pad(fraction, 3)}`;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}
