import { orientationOf } from '../../lib/captions/rules';
import { PLATFORM_ZONES, type Platform } from '../../lib/render/safeZones';

const LABELS: Record<Platform, string> = { tiktok: 'TikTok', reels: 'Reels', shorts: 'Shorts' };
const COLORS: Record<Platform, string> = {
  tiktok: 'rgba(255,77,141,0.18)',
  reels: 'rgba(139,92,246,0.18)',
  shorts: 'rgba(255,225,77,0.14)',
};

/** Shades the areas each app covers with its own interface (vertical video only). */
export function SafeZones({ width, height }: { width: number; height: number }) {
  if (orientationOf(width, height) !== 'vertical') {
    return (
      <div className="pointer-events-none absolute inset-[7%_5%_8%_5%] rounded border border-dashed border-white/50" />
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="safe-zones" aria-hidden>
      {(Object.keys(PLATFORM_ZONES) as Platform[]).map((platform) => {
        const z = PLATFORM_ZONES[platform];
        const pct = (n: number) => `${n * 100}%`;
        return (
          <div key={platform}>
            <div
              className="absolute inset-x-0 top-0"
              style={{ height: pct(z.top), background: COLORS[platform] }}
            />
            <div
              className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-1 text-[10px] font-medium text-white/80"
              style={{ height: pct(z.bottom), background: COLORS[platform] }}
            >
              {platform === 'tiktok' && 'Interfaz de TikTok · Reels · Shorts'}
            </div>
            <div
              className="absolute right-0"
              style={{
                top: pct(z.top),
                bottom: pct(z.bottom),
                width: pct(z.right),
                background: COLORS[platform],
              }}
              title={LABELS[platform]}
            />
          </div>
        );
      })}
    </div>
  );
}
