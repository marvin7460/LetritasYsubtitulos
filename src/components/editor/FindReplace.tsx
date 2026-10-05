import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { findMatches } from '../../lib/captions/search';
import { replaceInDoc, useEditor } from '../../state/editor';
import { useAppStore } from '../../state/store';
import { Button } from '../ui/Button';

export function FindReplace() {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const captions = useAppStore((s) => s.doc?.captions ?? []);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const options = { matchCase, wholeWord };
  const count = findMatches(captions, query, options).length;
  const close = () => useEditor.setState({ findOpen: false });

  return (
    <form
      role="search"
      className="space-y-2 rounded-xl border border-line bg-surface-2/60 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const replaced = replaceInDoc(query, replacement, options);
        setMessage(
          replaced > 0 ? `${replaced} reemplazo(s). Ctrl+Z para deshacer.` : 'Sin coincidencias.',
        );
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <div className="flex items-center justify-between text-sm font-medium">
        Buscar y reemplazar
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar búsqueda"
          className="text-muted hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setMessage(null);
        }}
        placeholder="Buscar…"
        aria-label="Buscar"
        className="h-9 w-full rounded-md border border-line bg-ink px-2 text-sm"
      />
      <input
        value={replacement}
        onChange={(e) => setReplacement(e.target.value)}
        placeholder="Reemplazar con…"
        aria-label="Reemplazar con"
        className="h-9 w-full rounded-md border border-line bg-ink px-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={matchCase}
            onChange={(e) => setMatchCase(e.target.checked)}
          />{' '}
          Mayúsculas
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(e) => setWholeWord(e.target.checked)}
          />{' '}
          Palabra completa
        </label>
        <span className="ml-auto" aria-live="polite" data-testid="find-count">
          {query ? `${count} coincidencia(s)` : ''}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!query || count === 0}>
          Reemplazar todo
        </Button>
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
    </form>
  );
}
