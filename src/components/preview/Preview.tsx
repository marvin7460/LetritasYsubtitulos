import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../../lib/util/format';
import { registerMediaElement, seek, togglePlay, usePlayback } from '../../state/playback';
import type { MediaState } from '../../state/store';
import { useCaptionCanvas } from './useCaptionCanvas';

/**
 * The browser renders the video; a transparent canvas on top draws the captions with the same
 * renderer the exporter uses. The box keeps the video's aspect ratio so both align exactly.
 */
export function Preview({ media }: { media: MediaState }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playable, setPlayable] = useState(true);
  useCaptionCanvas(videoRef, canvasRef);

  useEffect(() => {
    registerMediaElement(videoRef.current);
    return () => registerMediaElement(null);
  }, []);

  const { width, height } = media.info;
  const aspect =
    media.kind === 'video' && width > 0 && height > 0 ? `${width} / ${height}` : '9 / 16';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center rounded-2xl bg-black/40 p-2">
        <div
          className="relative max-h-[62vh] w-full overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: aspect, maxWidth: `calc(62vh * (${aspect}))` }}
        >
          {media.kind === 'audio' && (
            <div
              className="absolute inset-0 bg-gradient-to-br from-violet/60 via-ink to-accent/40"
              aria-hidden
            />
          )}
          <video
            ref={videoRef}
            src={media.url}
            data-testid="preview-video"
            className="absolute inset-0 size-full object-contain"
            playsInline
            preload="auto"
            onClick={togglePlay}
            onLoadedMetadata={(event) =>
              usePlayback.setState({ duration: event.currentTarget.duration })
            }
            onError={() => setPlayable(false)}
          />
          <canvas
            ref={canvasRef}
            data-testid="caption-canvas"
            className="pointer-events-none absolute inset-0 size-full"
            aria-hidden
          />
          {!playable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-muted">
              Tu navegador no puede reproducir este video, pero puedes transcribirlo y exportar los
              subtítulos.
            </div>
          )}
        </div>
      </div>
      <PlayerControls videoRef={videoRef} />
    </div>
  );
}

function PlayerControls({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const currentTime = usePlayback((s) => s.currentTime);
  const duration = usePlayback((s) => s.duration);
  const playing = usePlayback((s) => s.playing);
  const [muted, setMuted] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pausar' : 'Reproducir'}
        className="flex size-9 items-center justify-center rounded-full bg-fg text-ink hover:bg-white"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>
      <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-muted">
        {formatClock(currentTime)} / {formatClock(duration)}
      </span>
      <input
        type="range"
        aria-label="Posición del video"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(currentTime, duration || 0)}
        onChange={(event) => seek(Number(event.target.value))}
        className="h-1 flex-1 accent-brand"
      />
      <button
        type="button"
        onClick={() => {
          const video = videoRef.current;
          if (!video) return;
          video.muted = !video.muted;
          setMuted(video.muted);
        }}
        aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        className="text-muted hover:text-fg"
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
    </div>
  );
}
