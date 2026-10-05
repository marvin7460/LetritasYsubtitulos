import { ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PEAKS_PER_SECOND } from '../../lib/audio/peaks';
import type { Caption } from '../../lib/captions/types';
import { formatClock } from '../../lib/util/format';
import {
  commitTransient,
  selectCaption,
  setTransientDoc,
  timingUpdater,
  useEditor,
} from '../../state/editor';
import { getMediaElement, seek, usePlayback } from '../../state/playback';
import { useAppStore } from '../../state/store';

const HEIGHT = 150;
const RULER = 18;
const LANE_TOP = 104;
const LANE_HEIGHT = 38;
const EDGE = 7;
const MIN_PPS = 10;
const MAX_PPS = 400;

type DragMode = 'move' | 'start' | 'end' | 'scrub';

interface Drag {
  mode: DragMode;
  captionId: string | null;
  originX: number;
  original: Caption | null;
}

const COLORS = {
  bg: '#14141f',
  ruler: '#9b9bb4',
  wave: '#3b3b58',
  waveActive: '#6d6d99',
  block: 'rgba(139,92,246,0.35)',
  blockBorder: 'rgba(139,92,246,0.9)',
  selected: 'rgba(255,225,77,0.30)',
  selectedBorder: '#ffe14d',
  text: '#ececf4',
  playhead: '#ff4d8d',
};

/**
 * Canvas timeline: waveform + caption blocks. Drag a block to move it, drag its edges to change
 * its start/end, click or drag on empty space to scrub. Wheel pans; Ctrl/⌘ + wheel zooms.
 * Drags update the document transiently and become a single undo step on release.
 */
export function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pps, setPps] = useState(80);
  const [viewStart, setViewStart] = useState(0);
  const dragRef = useRef<Drag | null>(null);
  const [cursor, setCursor] = useState('default');
  const duration = useAppStore((s) => s.media?.info.duration ?? 0);

  // Draw on every relevant change, and continuously while playing.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let follow = viewStart;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth;
      if (canvas.width !== Math.round(width * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(HEIGHT * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const video = getMediaElement();
      const time = video ? video.currentTime : usePlayback.getState().currentTime;
      // Keep the playhead in view while playing.
      const visible = width / pps;
      if (video && !video.paused && (time < follow || time > follow + visible * 0.9)) {
        follow = Math.max(0, time - visible * 0.1);
        setViewStart(follow);
      }
      paint(ctx, width, time, follow, pps);
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    const unsubApp = useAppStore.subscribe(draw);
    const unsubEditor = useEditor.subscribe(draw);
    const unsubPlayback = usePlayback.subscribe((state, prev) => {
      if (state.playing && !prev.playing) loop();
      if (!state.playing) {
        cancelAnimationFrame(raf);
        draw();
      }
      if (state.currentTime !== prev.currentTime) draw();
    });
    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    if (usePlayback.getState().playing) loop();
    else draw();
    return () => {
      cancelAnimationFrame(raf);
      unsubApp();
      unsubEditor();
      unsubPlayback();
      resize.disconnect();
    };
  }, [pps, viewStart]);

  const timeAt = (x: number) => viewStart + x / pps;

  const hitTest = (x: number, y: number): { caption: Caption; mode: DragMode } | null => {
    if (y < LANE_TOP || y > LANE_TOP + LANE_HEIGHT) return null;
    const captions = useAppStore.getState().doc?.captions ?? [];
    for (const caption of captions) {
      const x0 = (caption.start - viewStart) * pps;
      const x1 = (caption.end - viewStart) * pps;
      if (x < x0 - EDGE || x > x1 + EDGE) continue;
      if (Math.abs(x - x0) <= EDGE) return { caption, mode: 'start' };
      if (Math.abs(x - x1) <= EDGE) return { caption, mode: 'end' };
      if (x > x0 && x < x1) return { caption, mode: 'move' };
    }
    return null;
  };

  const localPoint = (event: React.PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = localPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    const hit = hitTest(x, y);
    if (hit) {
      selectCaption(hit.caption.id);
      dragRef.current = {
        mode: hit.mode,
        captionId: hit.caption.id,
        originX: x,
        original: hit.caption,
      };
    } else {
      dragRef.current = { mode: 'scrub', captionId: null, originX: x, original: null };
      seek(timeAt(x));
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = localPoint(event);
    const drag = dragRef.current;
    if (!drag) {
      const hit = hitTest(x, y);
      setCursor(hit ? (hit.mode === 'move' ? 'grab' : 'ew-resize') : 'text');
      return;
    }
    if (drag.mode === 'scrub') {
      seek(timeAt(x));
      return;
    }
    const original = drag.original;
    if (!original) return;
    const delta = (x - drag.originX) / pps;
    const start = drag.mode === 'end' ? original.start : original.start + delta;
    const end = drag.mode === 'start' ? original.end : original.end + delta;
    // Always compute from the pre-drag caption so the gesture doesn't accumulate rounding.
    setTransientDoc((doc) => {
      const restored = {
        ...doc,
        captions: doc.captions.map((c) => (c.id === original.id ? original : c)),
      };
      return timingUpdater(original.id, start, end)(restored);
    });
  };

  const onPointerUp = () => {
    if (dragRef.current && dragRef.current.mode !== 'scrub') commitTransient();
    dragRef.current = null;
  };

  const onWheel = (event: React.WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
      setPps((p) => Math.min(MAX_PPS, Math.max(MIN_PPS, p * factor)));
    } else {
      const delta = (event.deltaX || event.deltaY) / pps;
      setViewStart((v) => Math.min(Math.max(0, duration - 1), Math.max(0, v + delta)));
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-2" data-testid="timeline">
      <div className="mb-1 flex items-center justify-between px-1 text-xs text-muted">
        <span>Línea de tiempo · arrastra los bloques o sus bordes para ajustar los tiempos</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Alejar"
            className="rounded p-1 hover:bg-surface-2 hover:text-fg"
            onClick={() => setPps((p) => Math.max(MIN_PPS, p / 1.5))}
          >
            <ZoomOut className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Acercar"
            className="rounded p-1 hover:bg-surface-2 hover:text-fg"
            onClick={() => setPps((p) => Math.min(MAX_PPS, p * 1.5))}
          >
            <ZoomIn className="size-4" />
          </button>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="block w-full touch-none select-none rounded-lg"
        style={{ height: HEIGHT, cursor }}
        role="slider"
        aria-label="Línea de tiempo"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(usePlayback.getState().currentTime)}
        tabIndex={-1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
    </div>
  );
}

function paint(
  ctx: CanvasRenderingContext2D,
  width: number,
  time: number,
  viewStart: number,
  pps: number,
) {
  const { doc, audio, media } = useAppStore.getState();
  const { selectedId } = useEditor.getState();
  const duration = media?.info.duration ?? 0;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, HEIGHT);
  const viewEnd = viewStart + width / pps;

  // Ruler
  const step = niceStep(pps);
  ctx.fillStyle = COLORS.ruler;
  ctx.strokeStyle = 'rgba(155,155,180,0.25)';
  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  for (let t = Math.floor(viewStart / step) * step; t <= viewEnd; t += step) {
    const x = (t - viewStart) * pps;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, RULER - 6);
    ctx.stroke();
    ctx.fillText(formatClock(t), x + 3, 2);
  }

  // Waveform (one bar per pixel column, max of the peaks under it)
  const peaks = audio?.peaks;
  if (peaks && peaks.length > 0) {
    const mid = RULER + (LANE_TOP - RULER) / 2;
    const amp = (LANE_TOP - RULER) / 2 - 4;
    let max = 0;
    for (const p of peaks) if (p > max) max = p;
    const norm = max > 0 ? 1 / max : 1;
    for (let x = 0; x < width; x++) {
      const t0 = viewStart + x / pps;
      if (t0 > duration) break;
      const from = Math.floor(t0 * PEAKS_PER_SECOND);
      const to = Math.max(from + 1, Math.floor((t0 + 1 / pps) * PEAKS_PER_SECOND));
      let peak = 0;
      for (let i = from; i < to && i < peaks.length; i++) peak = Math.max(peak, peaks[i] ?? 0);
      const h = Math.max(1, peak * norm * amp);
      ctx.fillStyle = t0 < time ? COLORS.waveActive : COLORS.wave;
      ctx.fillRect(x, mid - h, 1, h * 2);
    }
  }

  // Caption blocks
  ctx.textBaseline = 'middle';
  ctx.font = '12px Inter, system-ui, sans-serif';
  for (const caption of doc?.captions ?? []) {
    if (caption.end < viewStart || caption.start > viewEnd) continue;
    const x0 = (caption.start - viewStart) * pps;
    const w = Math.max(2, (caption.end - caption.start) * pps);
    const selected = caption.id === selectedId;
    ctx.fillStyle = selected ? COLORS.selected : COLORS.block;
    ctx.strokeStyle = selected ? COLORS.selectedBorder : COLORS.blockBorder;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x0 + 0.5, LANE_TOP + 0.5, w - 1, LANE_HEIGHT - 1, 6);
    ctx.fill();
    ctx.stroke();
    // Edge handles
    ctx.fillStyle = selected ? COLORS.selectedBorder : COLORS.blockBorder;
    ctx.fillRect(x0 + 1, LANE_TOP + 10, 3, LANE_HEIGHT - 20);
    ctx.fillRect(x0 + w - 4, LANE_TOP + 10, 3, LANE_HEIGHT - 20);
    if (w > 24) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 + 6, LANE_TOP, w - 12, LANE_HEIGHT);
      ctx.clip();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(
        caption.words.map((word) => word.text).join(' '),
        x0 + 8,
        LANE_TOP + LANE_HEIGHT / 2,
      );
      ctx.restore();
    }
  }

  // Playhead
  const px = (time - viewStart) * pps;
  if (px >= 0 && px <= width) {
    ctx.fillStyle = COLORS.playhead;
    ctx.fillRect(px - 1, 0, 2, HEIGHT);
    ctx.beginPath();
    ctx.moveTo(px - 5, 0);
    ctx.lineTo(px + 5, 0);
    ctx.lineTo(px, 7);
    ctx.fill();
  }
}

function niceStep(pps: number): number {
  const target = 90 / pps;
  for (const step of [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300])
    if (step >= target) return step;
  return 600;
}
