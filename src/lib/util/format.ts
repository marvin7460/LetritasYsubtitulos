/** 83.4 → "1:23"; 3723 → "1:02:03" */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 83.456 → "1:23.4" (editor precision) */
export function formatPreciseClock(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const tenths = Math.floor((safe % 1) * 10);
  return `${formatClock(safe)}.${tenths}`;
}

const languageNames = new Intl.DisplayNames(['es'], { type: 'language' });

/** "es" → "español" */
export function languageName(code: string): string {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}
