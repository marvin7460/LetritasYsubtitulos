import { Combine, Scissors, Trash2, TriangleAlert } from 'lucide-react';
import { Fragment, memo, useEffect, useRef, useState } from 'react';
import { captionIssues, ISSUE_LABELS } from '../../lib/captions/issues';
import { joinWords } from '../../lib/captions/text';
import type { Caption, LineRules } from '../../lib/captions/types';
import { formatPreciseClock } from '../../lib/util/format';
import {
  deleteCaption,
  editText,
  mergeNext,
  selectCaption,
  splitCaption,
  useEditor,
} from '../../state/editor';
import { seek, usePlayback } from '../../state/playback';
import { useAppStore } from '../../state/store';
import { FindReplace } from './FindReplace';

/**
 * Editable caption list. Click a word to jump to it, Alt+click to split the caption before it,
 * double-click (or Enter) to edit the text. Text edits keep word timings via editCaptionText.
 */
export function CaptionEditor() {
  const captions = useAppStore((s) => s.doc?.captions ?? []);
  const rules = useAppStore((s) => s.doc?.rules);
  const activeId = usePlayback((s) => s.activeCaptionId);
  const selectedId = useEditor((s) => s.selectedId);
  const editingId = useEditor((s) => s.editingId);
  const findOpen = useEditor((s) => s.findOpen);
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the active (or selected) caption visible while playing / navigating.
  const focusId = selectedId ?? activeId;
  useEffect(() => {
    if (!focusId) return;
    const element = listRef.current?.querySelector<HTMLElement>(`[data-caption-id="${focusId}"]`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [focusId]);

  if (!rules) return null;
  if (captions.length === 0) {
    return (
      <p className="text-sm text-muted">No quedan subtítulos. Usa Deshacer para recuperarlos.</p>
    );
  }

  return (
    <div className="space-y-3">
      {findOpen && <FindReplace />}
      <ol
        ref={listRef}
        className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1"
        data-testid="caption-list"
      >
        {captions.map((caption, index) => (
          <CaptionRow
            key={caption.id}
            caption={caption}
            rules={rules}
            active={caption.id === activeId}
            selected={caption.id === selectedId}
            editing={caption.id === editingId}
            isLast={index === captions.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}

interface RowProps {
  caption: Caption;
  rules: LineRules;
  active: boolean;
  selected: boolean;
  editing: boolean;
  isLast: boolean;
}

const CaptionRow = memo(function CaptionRow({
  caption,
  rules,
  active,
  selected,
  editing,
  isLast,
}: RowProps) {
  const issues = captionIssues(caption, rules);
  const border = selected
    ? 'border-brand bg-brand/10'
    : active
      ? 'border-violet/60 bg-violet/10'
      : 'border-line bg-surface-2/40';

  return (
    <li
      data-testid="caption-item"
      data-caption-id={caption.id}
      className={`group rounded-lg border px-3 py-2 transition ${border}`}
      onClick={() => selectCaption(caption.id)}
      onDoubleClick={() => useEditor.setState({ editingId: caption.id, selectedId: caption.id })}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => seek(caption.start + 0.001)}
          className="font-mono text-[11px] text-muted hover:text-fg"
          aria-label={`Ir a ${formatPreciseClock(caption.start)}`}
        >
          {formatPreciseClock(caption.start)} → {formatPreciseClock(caption.end)}
        </button>
        <span className="flex items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
          {issues.length > 0 && (
            <span title={issues.map((i) => ISSUE_LABELS[i]).join(' · ')} className="mr-1 text-warn">
              <TriangleAlert
                className="size-3.5"
                aria-label={issues.map((i) => ISSUE_LABELS[i]).join(', ')}
              />
            </span>
          )}
          <RowButton
            label="Dividir a la mitad"
            onClick={() => splitCaption(caption.id, Math.ceil(caption.words.length / 2))}
            disabled={caption.words.length < 2}
          >
            <Scissors className="size-3.5" />
          </RowButton>
          <RowButton
            label="Unir con el siguiente"
            onClick={() => mergeNext(caption.id)}
            disabled={isLast}
          >
            <Combine className="size-3.5" />
          </RowButton>
          <RowButton label="Eliminar subtítulo" onClick={() => deleteCaption(caption.id)}>
            <Trash2 className="size-3.5" />
          </RowButton>
        </span>
      </div>
      {editing ? (
        <TextEditor caption={caption} />
      ) : (
        <p className="mt-0.5 text-sm leading-relaxed">
          {caption.words.map((word, index) => (
            <Fragment key={word.id}>
              {index > 0 && ' '}
              <button
                type="button"
                title="Clic: ir a esta palabra · Alt+clic: dividir aquí"
                onClick={(event) => {
                  event.stopPropagation();
                  selectCaption(caption.id);
                  if (event.altKey) splitCaption(caption.id, index);
                  else seek(word.start + 0.001);
                }}
                className="rounded px-px hover:bg-surface"
              >
                {word.text}
              </button>
            </Fragment>
          ))}
        </p>
      )}
    </li>
  );
});

function RowButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="rounded p-1 text-muted hover:bg-surface hover:text-fg disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function TextEditor({ caption }: { caption: Caption }) {
  const [value, setValue] = useState(() => joinWords(caption.words));
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (save: boolean) => {
    if (save && value !== joinWords(caption.words)) editText(caption.id, value);
    useEditor.setState({ editingId: null });
  };

  return (
    <textarea
      ref={ref}
      aria-label="Texto del subtítulo"
      data-testid="caption-textarea"
      value={value}
      rows={2}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          finish(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
      }}
      className="mt-1 w-full resize-none rounded-md border border-brand/60 bg-ink px-2 py-1 text-sm outline-none"
    />
  );
}
