import type { LineRules, Orientation } from './types';

/**
 * Defaults based on common subtitling guidelines (Netflix/BBC): 42 characters per line for
 * landscape video, two lines max, ~17 characters per second, between 5/6 s and 7 s on screen.
 * Vertical video is much narrower, so lines are shorter.
 */
export const HORIZONTAL_RULES: LineRules = {
  maxCharsPerLine: 42,
  maxLines: 2,
  maxWordsPerCaption: null,
  minDuration: 0.833,
  maxDuration: 7,
  maxCharsPerSecond: 17,
  pauseThreshold: 0.6,
  minGap: 0.083,
};

export const VERTICAL_RULES: LineRules = {
  ...HORIZONTAL_RULES,
  maxCharsPerLine: 24,
  maxDuration: 5,
};

export const SQUARE_RULES: LineRules = {
  ...HORIZONTAL_RULES,
  maxCharsPerLine: 32,
  maxDuration: 6,
};

export function orientationOf(width: number, height: number): Orientation {
  if (width <= 0 || height <= 0) return 'vertical';
  const ratio = width / height;
  if (ratio < 0.9) return 'vertical';
  if (ratio > 1.1) return 'horizontal';
  return 'square';
}

export function defaultRulesFor(orientation: Orientation): LineRules {
  switch (orientation) {
    case 'vertical':
      return { ...VERTICAL_RULES };
    case 'horizontal':
      return { ...HORIZONTAL_RULES };
    case 'square':
      return { ...SQUARE_RULES };
  }
}
