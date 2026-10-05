export type Container = 'mp4' | 'webm';
export type EncodableVideoCodec = 'avc' | 'vp9' | 'vp8' | 'av1';

export interface ExportPlan {
  container: Container;
  videoCodec: EncodableVideoCodec;
  /** Even dimensions (H.264 requires them), capped to keep encoding fast and memory sane. */
  width: number;
  height: number;
}

/** Codecs tried per container, best first. MP4 means H.264: what every app and phone accepts. */
export const CODECS_BY_CONTAINER: Record<Container, readonly EncodableVideoCodec[]> = {
  mp4: ['avc'],
  webm: ['vp9', 'vp8', 'av1'],
};

/** Longest side of the exported video. 4K exports are slow and rarely needed for social media. */
export const MAX_EXPORT_SIDE = 1920;

export function exportSize(width: number, height: number, maxSide = MAX_EXPORT_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/**
 * Picks the first container/codec this browser can encode at this size. Prefers the requested
 * container, then falls back (MP4 → WebM). Returns null when nothing works, so the UI can offer
 * the subtitle files instead.
 */
export async function planExport(
  sourceWidth: number,
  sourceHeight: number,
  preferred: Container,
  canEncode: (codec: EncodableVideoCodec, width: number, height: number) => Promise<boolean>,
): Promise<ExportPlan | null> {
  const { width, height } = exportSize(sourceWidth, sourceHeight);
  const order: Container[] = preferred === 'mp4' ? ['mp4', 'webm'] : ['webm', 'mp4'];
  for (const container of order) {
    for (const videoCodec of CODECS_BY_CONTAINER[container]) {
      if (await canEncode(videoCodec, width, height).catch(() => false)) {
        return { container, videoCodec, width, height };
      }
    }
  }
  return null;
}
