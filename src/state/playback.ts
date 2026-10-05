import { create } from 'zustand';

/**
 * Playback clock shared by the preview, the caption list and (later) the timeline.
 * The <video> element is the single source of truth; this store mirrors it for the UI.
 * `currentTime` is updated a few times per second, not every frame, to keep React renders cheap
 * (the canvas reads the exact frame time directly from requestVideoFrameCallback).
 */
interface PlaybackState {
  currentTime: number;
  duration: number;
  playing: boolean;
  activeCaptionId: string | null;
}

export const usePlayback = create<PlaybackState>()(() => ({
  currentTime: 0,
  duration: 0,
  playing: false,
  activeCaptionId: null,
}));

let mediaElement: HTMLVideoElement | null = null;

export function registerMediaElement(element: HTMLVideoElement | null): void {
  mediaElement = element;
}

export function getMediaElement(): HTMLVideoElement | null {
  return mediaElement;
}

export function seek(time: number): void {
  if (!mediaElement) return;
  const duration = Number.isFinite(mediaElement.duration) ? mediaElement.duration : time;
  mediaElement.currentTime = Math.min(Math.max(0, time), duration);
  usePlayback.setState({ currentTime: mediaElement.currentTime });
}

export function togglePlay(): void {
  if (!mediaElement) return;
  if (mediaElement.paused) void mediaElement.play().catch(() => undefined);
  else mediaElement.pause();
}

export function pause(): void {
  mediaElement?.pause();
}
