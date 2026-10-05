import { useEffect, type RefObject } from 'react';
import { ensureFontLoaded } from '../../lib/render/fonts';
import { findActiveCaption, renderCaptions } from '../../lib/render/renderer';
import { usePlayback } from '../../state/playback';
import { useAppStore } from '../../state/store';
import { getEmojiMap } from './emojiCache';

/**
 * Keeps the overlay canvas in sync with the video.
 * - Playing video: requestVideoFrameCallback gives the exact media time of each presented frame.
 * - Audio-only files or browsers without rVFC: requestAnimationFrame + currentTime.
 * - Paused: redraw on seek and whenever the captions or style change.
 */
export function useCaptionCanvas(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): void {
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastUiUpdate = 0;
    const draw = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);
      const { doc } = useAppStore.getState();
      if (doc) {
        renderCaptions(ctx, {
          width,
          height,
          time,
          captions: doc.captions,
          style: doc.style,
          rules: doc.rules,
          emojis: getEmojiMap(doc.captions, doc.style.emojis),
        });
      }
      const now = performance.now();
      const activeId = doc ? (findActiveCaption(doc.captions, time)?.id ?? null) : null;
      const playback = usePlayback.getState();
      if (activeId !== playback.activeCaptionId || now - lastUiUpdate > 200) {
        lastUiUpdate = now;
        usePlayback.setState({ currentTime: time, activeCaptionId: activeId });
      }
    };

    const useVideoFrames = 'requestVideoFrameCallback' in video;
    let frameHandle = 0;
    let rafHandle = 0;
    const onVideoFrame = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      draw(metadata.mediaTime);
      frameHandle = video.requestVideoFrameCallback(onVideoFrame);
    };
    const onAnimationFrame = () => {
      draw(video.currentTime);
      if (!video.paused) rafHandle = requestAnimationFrame(onAnimationFrame);
    };
    const start = () => {
      usePlayback.setState({ playing: true });
      cancelAnimationFrame(rafHandle);
      // Audio files produce no video frames, so rVFC would never fire.
      if (useVideoFrames && video.videoWidth > 0) {
        video.cancelVideoFrameCallback(frameHandle);
        frameHandle = video.requestVideoFrameCallback(onVideoFrame);
      }
      rafHandle = requestAnimationFrame(onAnimationFrame);
    };
    const stop = () => {
      usePlayback.setState({ playing: false });
      draw(video.currentTime);
    };
    const redraw = () => draw(video.currentTime);

    video.addEventListener('play', start);
    video.addEventListener('pause', stop);
    video.addEventListener('ended', stop);
    video.addEventListener('seeked', redraw);
    video.addEventListener('loadeddata', redraw);
    const unsubscribe = useAppStore.subscribe((state, prev) => {
      const style = state.doc?.style;
      // Canvas text doesn't trigger web font loading reliably: load it, then redraw.
      if (style && style !== prev.doc?.style) void ensureFontLoaded(style).then(redraw);
      if (state.doc !== prev.doc && video.paused) redraw();
    });
    const initialStyle = useAppStore.getState().doc?.style;
    if (initialStyle) void ensureFontLoaded(initialStyle).then(redraw);
    const resize = new ResizeObserver(redraw);
    resize.observe(canvas);
    const onFonts = () => redraw();
    document.fonts.addEventListener('loadingdone', onFonts);
    redraw();

    return () => {
      video.removeEventListener('play', start);
      video.removeEventListener('pause', stop);
      video.removeEventListener('ended', stop);
      video.removeEventListener('seeked', redraw);
      video.removeEventListener('loadeddata', redraw);
      unsubscribe();
      resize.disconnect();
      document.fonts.removeEventListener('loadingdone', onFonts);
      cancelAnimationFrame(rafHandle);
      if (useVideoFrames) video.cancelVideoFrameCallback(frameHandle);
    };
  }, [videoRef, canvasRef]);
}
