import type { LineRules } from '../captions/types';
import { CLASSIC_STYLE, type CaptionStyle, type PresetId } from './style';

export interface Preset {
  id: Exclude<PresetId, 'custom'>;
  name: string;
  description: string;
  style: CaptionStyle;
  /** How words are grouped for this look (e.g. TikTok shows 2–3 words at a time). */
  rules: Partial<LineRules>;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'classic',
    name: 'Clásico',
    description: 'Texto blanco con contorno, abajo. Como en el cine.',
    style: CLASSIC_STYLE,
    rules: { maxWordsPerCaption: null, maxLines: 2 },
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Grande, en mayúsculas, palabra por palabra con resaltado.',
    style: {
      ...CLASSIC_STYLE,
      presetId: 'tiktok',
      fontFamily: 'Montserrat',
      fontWeight: 900,
      fontSize: 6.5,
      uppercase: true,
      highlightColor: '#ffe14d',
      outlineWidth: 16,
      shadowBlur: 0,
      shadowOffsetY: 6,
      shadowColor: 'rgba(0,0,0,0.85)',
      position: 'middle',
      offsetY: -12,
      highlight: 'color',
      reveal: 'word',
      animation: 'pop',
      emojis: true,
    },
    rules: { maxWordsPerCaption: 3, maxLines: 1, maxCharsPerLine: 18, maxDuration: 2.5 },
  },
  {
    id: 'karaoke',
    name: 'Karaoke',
    description: 'Las palabras se van pintando mientras se dicen.',
    style: {
      ...CLASSIC_STYLE,
      presetId: 'karaoke',
      fontFamily: 'Poppins',
      fontWeight: 800,
      fontSize: 5.2,
      textColor: '#ffffff',
      highlightColor: '#ff4d8d',
      outlineWidth: 10,
      highlight: 'karaoke',
      animation: 'fade',
    },
    rules: { maxWordsPerCaption: null, maxLines: 2 },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Discreto, sobre una caja semitransparente.',
    style: {
      ...CLASSIC_STYLE,
      presetId: 'minimal',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 3.8,
      outlineWidth: 0,
      shadowBlur: 0,
      shadowOffsetY: 0,
      background: 'box',
      backgroundColor: 'rgba(0,0,0,0.6)',
      animation: 'fade',
    },
    rules: { maxWordsPerCaption: null, maxLines: 2 },
  },
];

export function getPreset(id: PresetId): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
