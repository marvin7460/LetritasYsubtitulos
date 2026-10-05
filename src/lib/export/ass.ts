import { layoutLines } from '../captions/lines';
import type { Caption, LineRules } from '../captions/types';
import { captionSafeArea } from '../render/safeZones';
import type { CaptionStyle } from '../render/style';
import { formatTimestamp } from './time';

/**
 * Advanced SubStation Alpha (.ass): the subtitle format that carries styling (font, colors,
 * outline, position, karaoke timing). Read by FFmpeg, mpv, VLC, Aegisub, Kdenlive…
 * Premiere and DaVinci import SRT instead (text and timing only).
 */
export interface AssOptions {
  width: number;
  height: number;
  title?: string;
}

export function toAss(
  captions: readonly Caption[],
  rules: LineRules,
  style: CaptionStyle,
  options: AssOptions,
): string {
  const width = Math.round(options.width || 1920);
  const height = Math.round(options.height || 1080);
  const safe = captionSafeArea(width, height);
  const fontSize = Math.round((style.fontSize / 100) * height);
  const outline = round1((style.outlineWidth / 100) * fontSize);
  const shadow = round1((Math.max(style.shadowOffsetY, style.shadowBlur / 3) * fontSize) / 100);
  const alignment = style.position === 'top' ? 8 : style.position === 'middle' ? 5 : 2;
  const marginV = Math.round(
    (style.position === 'top' ? safe.top : style.position === 'bottom' ? safe.bottom : 0) * height +
      (style.position === 'top' ? -1 : 1) * (style.offsetY / 100) * height,
  );
  const marginH = Math.round(Math.max(safe.left, safe.right) * width);
  const boxed = style.background === 'box';

  const styleLine = [
    'Default',
    style.fontFamily,
    fontSize,
    assColor(style.textColor),
    assColor(style.highlightColor),
    assColor(boxed ? style.backgroundColor : style.outlineColor),
    assColor(boxed ? style.backgroundColor : style.shadowColor),
    style.fontWeight >= 600 ? -1 : 0,
    0,
    0,
    0,
    100,
    100,
    0,
    0,
    boxed ? 3 : 1,
    boxed ? round1(fontSize * 0.2) : outline,
    boxed ? 0 : shadow,
    alignment,
    marginH,
    marginH,
    Math.max(0, marginV),
    1,
  ].join(',');

  const events: string[] = [];
  const sorted = captions.filter((c) => c.words.length > 0).toSorted((a, b) => a.start - b.start);
  for (const caption of sorted) {
    const lines = layoutLines(caption.words, rules.maxCharsPerLine, rules.maxLines);
    const display = (text: string) =>
      escapeAss(style.uppercase ? text.toLocaleUpperCase('es') : text);

    if (style.highlight === 'karaoke') {
      // \kf: fill from left to right over the word's duration (in centiseconds).
      let cursor = caption.start;
      const text = lines
        .map((line) =>
          line
            .map((word) => {
              const lead = Math.max(0, word.start - cursor);
              cursor = Math.max(cursor, word.end);
              const gap = lead > 0.01 ? `{\\k${Math.round(lead * 100)}}` : '';
              return `${gap}{\\kf${Math.max(1, Math.round((word.end - word.start) * 100))}}${display(word.text)}`;
            })
            .join(' '),
        )
        .join('\\N');
      events.push(dialogue(caption.start, caption.end, text));
    } else if (style.highlight === 'color' || style.reveal === 'word') {
      // One event per word interval, with the active word recolored (and future words hidden).
      caption.words.forEach((active, index) => {
        const start = index === 0 ? caption.start : active.start;
        const end = caption.words[index + 1]?.start ?? caption.end;
        if (end <= start) return;
        const text = lines
          .map((line) =>
            line
              .map((word) => {
                const position = caption.words.indexOf(word);
                if (style.reveal === 'word' && position > index)
                  return `{\\alpha&HFF&}${display(word.text)}{\\r}`;
                if (style.highlight === 'color' && word === active) {
                  return `{\\c${assColor(style.highlightColor)}}${display(word.text)}{\\r}`;
                }
                return display(word.text);
              })
              .join(' '),
          )
          .join('\\N');
        events.push(dialogue(start, end, text));
      });
    } else {
      const text = lines.map((line) => line.map((w) => display(w.text)).join(' ')).join('\\N');
      events.push(dialogue(caption.start, caption.end, text));
    }
  }

  return [
    '[Script Info]',
    `Title: ${options.title ?? 'Letritas'}`,
    'ScriptType: v4.00+',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ${styleLine}`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}

function dialogue(start: number, end: number, text: string): string {
  return `Dialogue: 0,${formatTimestamp(start, 'ass')},${formatTimestamp(end, 'ass')},Default,,0,0,0,,${text}`;
}

/** CSS color (#rgb, #rrggbb, rgb(), rgba()) → ASS `&HAABBGGRR` (AA = transparency). */
export function assColor(css: string): string {
  const { r, g, b, a } = parseColor(css);
  const alpha = Math.round((1 - a) * 255);
  return `&H${hex(alpha)}${hex(b)}${hex(g)}${hex(r)}`;
}

export function parseColor(css: string): { r: number; g: number; b: number; a: number } {
  const value = css.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value);
  if (short) {
    const [, r = '0', g = '0', b = '0'] = short;
    return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16), a: 1 };
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/.exec(value);
  if (long) {
    const [, r = '0', g = '0', b = '0', a] = long;
    return {
      r: parseInt(r, 16),
      g: parseInt(g, 16),
      b: parseInt(b, 16),
      a: a ? parseInt(a, 16) / 255 : 1,
    };
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const [r = 0, g = 0, b = 0, a = 1] = (rgb[1] ?? '').split(',').map((p) => Number(p.trim()));
    return { r, g, b, a };
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

function hex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function escapeAss(text: string): string {
  return text.replaceAll('\\', '\\\\').replaceAll('{', '(').replaceAll('}', ')');
}
