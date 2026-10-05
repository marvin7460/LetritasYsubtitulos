/**
 * Caption style. Every size is relative (percent of the frame height or of the font size), so
 * the same style renders identically in a 360p preview and a 1080p export.
 */
export interface CaptionStyle {
  presetId: PresetId;
  fontFamily: string;
  fontWeight: number;
  /** Font size in % of the frame height. */
  fontSize: number;
  uppercase: boolean;
  /** Line height as a multiple of the font size. */
  lineHeight: number;

  textColor: string;
  /** Color of the active word (TikTok) or of the sung part (Karaoke). */
  highlightColor: string;
  outlineColor: string;
  /** Outline thickness in % of the font size. */
  outlineWidth: number;
  shadowColor: string;
  /** Shadow blur in % of the font size. */
  shadowBlur: number;
  /** Shadow vertical offset in % of the font size. */
  shadowOffsetY: number;

  /** Box behind the whole caption, behind the active word, or nothing. */
  background: 'none' | 'box' | 'word';
  backgroundColor: string;

  position: 'top' | 'middle' | 'bottom';
  /** Extra vertical offset in % of the frame height (positive = up). */
  offsetY: number;

  highlight: 'none' | 'color' | 'karaoke';
  /** Show the whole caption at once, or reveal words as they are spoken. */
  reveal: 'caption' | 'word';
  animation: 'none' | 'pop' | 'fade' | 'slide';
  emojis: boolean;
}

export type PresetId = 'classic' | 'tiktok' | 'karaoke' | 'minimal' | 'custom';

export const CLASSIC_STYLE: CaptionStyle = {
  presetId: 'classic',
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: 5,
  uppercase: false,
  lineHeight: 1.2,
  textColor: '#ffffff',
  highlightColor: '#ffe14d',
  outlineColor: '#000000',
  outlineWidth: 12,
  shadowColor: 'rgba(0,0,0,0.6)',
  shadowBlur: 10,
  shadowOffsetY: 4,
  background: 'none',
  backgroundColor: 'rgba(0,0,0,0.55)',
  position: 'bottom',
  offsetY: 0,
  highlight: 'none',
  reveal: 'caption',
  animation: 'none',
  emojis: false,
};
