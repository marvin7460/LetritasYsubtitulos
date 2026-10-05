import { layoutLines } from '../captions/lines';
import type { Caption, LineRules, Word } from '../captions/types';
import { captionSafeArea } from './safeZones';
import type { CaptionStyle } from './style';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface RenderFrame {
  /** Canvas size in pixels. Everything scales from these, so preview and export match. */
  width: number;
  height: number;
  /** Media time in seconds. */
  time: number;
  captions: readonly Caption[];
  style: CaptionStyle;
  rules: LineRules;
  /** Optional emoji per word id (see emojis.ts). */
  emojis?: ReadonlyMap<string, string>;
}

const FADE_SECONDS = 0.15;
const POP_SECONDS = 0.2;

/** Binary search: the caption visible at `time`, or null. Captions must be sorted by start. */
export function findActiveCaption(captions: readonly Caption[], time: number): Caption | null {
  let lo = 0;
  let hi = captions.length - 1;
  let candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const caption = captions[mid];
    if (!caption) break;
    if (caption.start <= time) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const caption = candidate >= 0 ? captions[candidate] : undefined;
  return caption && time < caption.end ? caption : null;
}

export function fontString(style: CaptionStyle, px: number): string {
  return `${style.fontWeight} ${px.toFixed(2)}px "${style.fontFamily}", system-ui, sans-serif`;
}

/**
 * Draws the caption visible at `frame.time` onto `ctx`. Does not clear the canvas: the preview
 * clears its transparent overlay first; the exporter draws on top of the video frame.
 */
export function renderCaptions(ctx: Ctx2D, frame: RenderFrame): void {
  const caption = findActiveCaption(frame.captions, frame.time);
  if (caption) drawCaption(ctx, caption, frame);
}

interface PlacedWord {
  word: Word;
  text: string;
  x: number;
  y: number;
  width: number;
}

function drawCaption(ctx: Ctx2D, caption: Caption, frame: RenderFrame): void {
  const { width, height, time, style, rules } = frame;
  const safe = captionSafeArea(width, height);
  const sideInset = Math.max(safe.left, safe.right);
  const maxWidth = width * (1 - 2 * sideInset);

  let fontPx = (style.fontSize / 100) * height;
  ctx.font = fontString(style, fontPx);
  const lines = layoutLines(caption.words, rules.maxCharsPerLine, rules.maxLines);
  const texts = new Map<string, string>();
  for (const word of caption.words) texts.set(word.id, displayText(word.text, style));

  // Measure, then shrink the font if the widest line doesn't fit the safe area.
  let spaceWidth = ctx.measureText(' ').width;
  let lineWidths = lines.map((line) => measureLine(ctx, line, texts, spaceWidth));
  const widest = Math.max(...lineWidths, 1);
  if (widest > maxWidth) {
    const scale = maxWidth / widest;
    fontPx *= scale;
    ctx.font = fontString(style, fontPx);
    spaceWidth = ctx.measureText(' ').width;
    lineWidths = lines.map((line) => measureLine(ctx, line, texts, spaceWidth));
  }

  const lineHeight = fontPx * style.lineHeight;
  const blockHeight = lineHeight * lines.length;
  const offset = (style.offsetY / 100) * height;
  let top: number;
  if (style.position === 'top') top = safe.top * height - offset;
  else if (style.position === 'middle') top = height / 2 - blockHeight / 2 - offset;
  else top = height * (1 - safe.bottom) - blockHeight - offset;
  top = Math.min(Math.max(top, 0), height - blockHeight);

  const placed: PlacedWord[] = [];
  lines.forEach((line, index) => {
    let x = width / 2 - (lineWidths[index] ?? 0) / 2;
    const y = top + lineHeight * index + lineHeight / 2;
    for (const word of line) {
      const text = texts.get(word.id) ?? word.text;
      const w = ctx.measureText(text).width;
      placed.push({ word, text, x, y, width: w });
      x += w + spaceWidth;
    }
  });

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  applyCaptionAnimation(ctx, caption, frame, fontPx);

  if (style.background === 'box') {
    const padX = fontPx * 0.35;
    const padY = fontPx * 0.12;
    ctx.fillStyle = style.backgroundColor;
    lines.forEach((_, index) => {
      const lineWidth = lineWidths[index] ?? 0;
      roundedRect(
        ctx,
        width / 2 - lineWidth / 2 - padX,
        top + lineHeight * index - padY + (lineHeight - fontPx * 1.15) / 2,
        lineWidth + padX * 2,
        fontPx * 1.15 + padY * 2,
        fontPx * 0.25,
      );
    });
  }

  const nextStartById = new Map<string, number>();
  caption.words.forEach((word, i) => {
    nextStartById.set(word.id, caption.words[i + 1]?.start ?? caption.end);
  });

  for (const item of placed) {
    const { word } = item;
    if (style.reveal === 'word' && time < word.start) continue;
    const activeUntil = Math.max(word.end, nextStartById.get(word.id) ?? word.end);
    const active = time >= word.start && time < activeUntil;
    drawWord(ctx, item, { active, time, fontPx, style });
  }

  if (frame.emojis && style.emojis) drawEmojis(ctx, placed, frame, fontPx, top);
  ctx.restore();
}

function measureLine(ctx: Ctx2D, line: readonly Word[], texts: Map<string, string>, space: number) {
  let total = 0;
  line.forEach((word, i) => {
    total += ctx.measureText(texts.get(word.id) ?? word.text).width;
    if (i > 0) total += space;
  });
  return total;
}

function displayText(text: string, style: CaptionStyle): string {
  return style.uppercase ? text.toLocaleUpperCase('es') : text;
}

/** Fade / slide for the whole caption, at its start and end. */
function applyCaptionAnimation(
  ctx: Ctx2D,
  caption: Caption,
  frame: RenderFrame,
  fontPx: number,
): void {
  const { style, time } = frame;
  if (style.animation !== 'fade' && style.animation !== 'slide') return;
  const fadeIn = clamp01((time - caption.start) / FADE_SECONDS);
  const fadeOut = clamp01((caption.end - time) / FADE_SECONDS);
  ctx.globalAlpha *= easeOutCubic(Math.min(fadeIn, fadeOut));
  if (style.animation === 'slide') ctx.translate(0, (1 - easeOutCubic(fadeIn)) * fontPx * 0.4);
}

interface WordState {
  active: boolean;
  time: number;
  fontPx: number;
  style: CaptionStyle;
}

function drawWord(ctx: Ctx2D, item: PlacedWord, state: WordState): void {
  const { style, fontPx, time, active } = state;
  const { word, text, x, y, width } = item;
  const spoken = time >= word.start;

  ctx.save();
  if (style.animation === 'pop' && spoken) {
    const t = (time - word.start) / POP_SECONDS;
    if (t < 1) {
      const scale = 1 + 0.18 * Math.sin(Math.PI * clamp01(t));
      const cx = x + width / 2;
      ctx.translate(cx, y);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -y);
    }
  }

  if (style.background === 'word' && active) {
    const padX = fontPx * 0.18;
    const padY = fontPx * 0.08;
    ctx.fillStyle = style.backgroundColor;
    roundedRect(
      ctx,
      x - padX,
      y - fontPx * 0.6 - padY,
      width + padX * 2,
      fontPx * 1.2 + padY * 2,
      fontPx * 0.2,
    );
  }

  const outline = (style.outlineWidth / 100) * fontPx;
  const shadowBlur = (style.shadowBlur / 100) * fontPx;
  const shadowOffset = (style.shadowOffsetY / 100) * fontPx;
  const hasShadow = shadowBlur > 0 || shadowOffset !== 0;
  const setShadow = (on: boolean) => {
    ctx.shadowColor = on && hasShadow ? style.shadowColor : 'transparent';
    ctx.shadowBlur = on ? shadowBlur : 0;
    ctx.shadowOffsetY = on ? shadowOffset : 0;
  };

  if (outline > 0) {
    setShadow(true);
    ctx.lineWidth = outline * 2;
    ctx.strokeStyle = style.outlineColor;
    ctx.strokeText(text, x, y);
    setShadow(false);
  } else {
    setShadow(true);
  }

  if (style.highlight === 'karaoke') {
    // Base color first, then the sung part clipped left-to-right in the highlight color.
    ctx.fillStyle = style.textColor;
    ctx.fillText(text, x, y);
    setShadow(false);
    const progress = clamp01((time - word.start) / Math.max(0.05, word.end - word.start));
    if (progress > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - outline, y - fontPx, (width + outline) * progress + outline, fontPx * 2);
      ctx.clip();
      ctx.fillStyle = style.highlightColor;
      ctx.fillText(text, x, y);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = style.highlight === 'color' && active ? style.highlightColor : style.textColor;
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

/** Emoji above the caption, popping in when its keyword is spoken. */
function drawEmojis(
  ctx: Ctx2D,
  placed: readonly PlacedWord[],
  frame: RenderFrame,
  fontPx: number,
  top: number,
) {
  const emojis = frame.emojis;
  if (!emojis) return;
  const triggered = placed.filter((p) => emojis.has(p.word.id) && frame.time >= p.word.start);
  if (triggered.length === 0) return;
  const size = fontPx * 1.4;
  ctx.save();
  ctx.font = `${size.toFixed(1)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'transparent';
  const totalWidth = triggered.length * size * 1.1;
  triggered.forEach((item, index) => {
    const emoji = emojis.get(item.word.id) ?? '';
    const t = clamp01((frame.time - item.word.start) / POP_SECONDS);
    const scale = easeOutBack(t);
    const x = frame.width / 2 - totalWidth / 2 + size * 1.1 * (index + 0.5);
    const y = Math.max(size / 2, top - size * 0.7);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

function roundedRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}
