// Self-hosted Google Fonts (all SIL Open Font License 1.1) via Fontsource. Loading them from
// fonts.googleapis.com would send every visitor's IP to Google and break offline use.
// Only the Latin subset is bundled: it covers Spanish (á é í ó ú ü ñ ¿ ¡) and English.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-900.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-900.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-800.css';
import '@fontsource/anton/latin-400.css';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import type { CaptionStyle } from './style';
import { fontString } from './renderer';

export interface FontOption {
  family: string;
  weights: readonly number[];
  description: string;
}

export const FONTS: readonly FontOption[] = [
  { family: 'Inter', weights: [400, 700, 900], description: 'Neutra y muy legible' },
  { family: 'Montserrat', weights: [700, 900], description: 'Gruesa, estilo TikTok' },
  { family: 'Poppins', weights: [600, 800], description: 'Redonda y amigable' },
  { family: 'Anton', weights: [400], description: 'Condensada e impactante' },
  { family: 'Bebas Neue', weights: [400], description: 'Títulos en mayúsculas' },
  {
    family: 'Atkinson Hyperlegible',
    weights: [400, 700],
    description: 'Diseñada para baja visión',
  },
];

/** Closest bundled weight, so the canvas never falls back to a synthetic bold. */
export function nearestWeight(family: string, weight: number): number {
  const font = FONTS.find((f) => f.family === family);
  if (!font) return weight;
  return font.weights.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
  );
}

/**
 * Canvas text silently falls back to another font while a web font is still loading, so the
 * exporter must wait for it. The sample text makes the browser fetch the right unicode subset.
 */
export async function ensureFontLoaded(style: CaptionStyle): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    await document.fonts.load(fontString(style, 48), 'Áá¿?¡!Ññ 0123 Letritas');
  } catch {
    // If loading fails the browser uses the fallback font; captions still render.
  }
}
