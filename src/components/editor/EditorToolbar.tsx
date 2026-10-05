import { Keyboard, Redo2, Scissors, Search, Undo2, X } from 'lucide-react';
import { canRedo, canUndo } from '../../lib/history/history';
import { redoDoc, splitAtPlayhead, undoDoc, useEditor } from '../../state/editor';
import { useAppStore } from '../../state/store';
import { SHORTCUTS } from './shortcuts';

export function EditorToolbar() {
  const history = useAppStore((s) => s.history);
  const helpOpen = useEditor((s) => s.helpOpen);
  return (
    <>
      <div className="flex items-center gap-1" role="toolbar" aria-label="Herramientas de edición">
        <ToolButton
          label="Deshacer (Ctrl+Z)"
          onClick={undoDoc}
          disabled={!history || !canUndo(history)}
        >
          <Undo2 className="size-4" />
        </ToolButton>
        <ToolButton
          label="Rehacer (Ctrl+Shift+Z)"
          onClick={redoDoc}
          disabled={!history || !canRedo(history)}
        >
          <Redo2 className="size-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-line" />
        <ToolButton label="Dividir en la posición actual (S)" onClick={splitAtPlayhead}>
          <Scissors className="size-4" />
        </ToolButton>
        <ToolButton
          label="Buscar y reemplazar (Ctrl+F)"
          onClick={() => useEditor.setState({ findOpen: true })}
        >
          <Search className="size-4" />
        </ToolButton>
        <ToolButton
          label="Atajos de teclado (?)"
          onClick={() => useEditor.setState({ helpOpen: !helpOpen })}
        >
          <Keyboard className="size-4" />
        </ToolButton>
      </div>
      {helpOpen && <ShortcutsHelp />}
    </>
  );
}

function ToolButton({
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
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-2 text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ShortcutsHelp() {
  return (
    <div
      role="dialog"
      aria-label="Atajos de teclado"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => useEditor.setState({ helpOpen: false })}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Atajos de teclado</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => useEditor.setState({ helpOpen: false })}
            className="text-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="contents">
              <dt>
                <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
                  {s.keys}
                </kbd>
              </dt>
              <dd className="text-muted">{s.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
