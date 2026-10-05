import { orientationOf } from '../captions/rules';

/** Insets as fractions of the frame (0.1 = 10% of the width or height). */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type Platform = 'tiktok' | 'reels' | 'shorts';

/**
 * Areas of a 9:16 frame covered by each app's interface (username, description, music, the
 * like/comment/share buttons on the right…). Approximations measured on 1080×1920 screenshots;
 * the apps change their UI often, so treat them as guides, not exact pixels.
 */
export const PLATFORM_ZONES: Record<Platform, Insets> = {
  tiktok: { top: 0.08, right: 0.15, bottom: 0.24, left: 0.05 },
  reels: { top: 0.13, right: 0.13, bottom: 0.22, left: 0.05 },
  shorts: { top: 0.08, right: 0.14, bottom: 0.2, left: 0.05 },
};

const HORIZONTAL_SAFE: Insets = { top: 0.07, right: 0.05, bottom: 0.08, left: 0.05 };
const SQUARE_SAFE: Insets = { top: 0.08, right: 0.06, bottom: 0.1, left: 0.06 };

/** The area where captions are visible on every platform: the union of all their UI zones. */
export function captionSafeArea(width: number, height: number): Insets {
  switch (orientationOf(width, height)) {
    case 'horizontal':
      return HORIZONTAL_SAFE;
    case 'square':
      return SQUARE_SAFE;
    case 'vertical': {
      const zones = Object.values(PLATFORM_ZONES);
      return {
        top: Math.max(...zones.map((z) => z.top)),
        right: Math.max(...zones.map((z) => z.right)),
        bottom: Math.max(...zones.map((z) => z.bottom)),
        left: Math.max(...zones.map((z) => z.left)),
      };
    }
  }
}
