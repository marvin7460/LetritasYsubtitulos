import { Fragment } from 'react';
import { joinWords } from '../../lib/captions/text';
import { formatPreciseClock } from '../../lib/util/format';
import { seek, usePlayback } from '../../state/playback';
import { useAppStore } from '../../state/store';

/** Read-only list of captions. Clicking a word jumps the video to that moment. */
export function CaptionList() {
  const captions = useAppStore((s) => s.doc?.captions ?? []);
  const activeId = usePlayback((s) => s.activeCaptionId);
  if (captions.length === 0)
    return <p className="text-sm text-muted">Todavía no hay subtítulos.</p>;
  return (
    <ol className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1" data-testid="caption-list">
      {captions.map((caption) => (
        <li
          key={caption.id}
          data-testid="caption-item"
          className={`rounded-lg border px-3 py-2 ${
            caption.id === activeId ? 'border-brand/60 bg-brand/10' : 'border-line bg-surface-2/40'
          }`}
        >
          <button
            type="button"
            onClick={() => seek(caption.start)}
            className="font-mono text-[11px] text-muted hover:text-fg"
            aria-label={`Ir a ${formatPreciseClock(caption.start)}`}
          >
            {formatPreciseClock(caption.start)} → {formatPreciseClock(caption.end)}
          </button>
          <p className="text-sm" aria-label={joinWords(caption.words)}>
            {caption.words.map((word, index) => (
              <Fragment key={word.id}>
                {index > 0 && ' '}
                <button
                  type="button"
                  onClick={() => seek(word.start + 0.001)}
                  className="rounded hover:bg-surface"
                >
                  {word.text}
                </button>
              </Fragment>
            ))}
          </p>
        </li>
      ))}
    </ol>
  );
}
