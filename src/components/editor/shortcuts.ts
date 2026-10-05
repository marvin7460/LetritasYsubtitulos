import { useEffect } from 'react';
import {
  deleteCaption,
  mergeNext,
  redoDoc,
  selectAdjacent,
  splitAtPlayhead,
  undoDoc,
  useEditor,
} from '../../state/editor';
import { seek, togglePlay, usePlayback } from '../../state/playback';
import { useAppStore } from '../../state/store';

export const SHORTCUTS: readonly { keys: string; description: string }[] = [
  { keys: 'Espacio', description: 'Reproducir / pausar' },
  { keys: '← / →', description: 'Retroceder / avanzar 1 s (Shift: 5 s)' },
  { keys: '↑ / ↓', description: 'Subtítulo anterior / siguiente' },
  { keys: 'Enter', description: 'Editar el texto del subtítulo seleccionado' },
  { keys: 'S', description: 'Dividir el subtítulo en la posición actual' },
  { keys: 'M', description: 'Unir con el siguiente' },
  { keys: 'Supr', description: 'Eliminar el subtítulo seleccionado' },
  { keys: 'Ctrl/⌘ + Z', description: 'Deshacer' },
  { keys: 'Ctrl/⌘ + Shift + Z · Ctrl + Y', description: 'Rehacer' },
  { keys: 'Ctrl/⌘ + F', description: 'Buscar y reemplazar' },
  { keys: 'Alt + clic en palabra', description: 'Dividir antes de esa palabra' },
  { keys: '?', description: 'Mostrar esta ayuda' },
];

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Global editor shortcuts. Disabled while typing in a field, except undo/redo/find. */
export function useEditorShortcuts(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === 'f') {
        event.preventDefault();
        useEditor.setState({ findOpen: true });
        return;
      }
      if (isTyping(event.target)) return;
      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoDoc();
        else undoDoc();
        return;
      }
      if (mod && key === 'y') {
        event.preventDefault();
        redoDoc();
        return;
      }
      if (mod || event.altKey) return;

      const selected = useEditor.getState().selectedId ?? usePlayback.getState().activeCaptionId;
      const { currentTime } = usePlayback.getState();
      switch (event.key) {
        case ' ':
          event.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          event.preventDefault();
          const step = (event.shiftKey ? 5 : 1) * (event.key === 'ArrowLeft' ? -1 : 1);
          seek(currentTime + step);
          break;
        }
        case 'ArrowUp':
        case 'ArrowDown': {
          event.preventDefault();
          const id = selectAdjacent(event.key === 'ArrowUp' ? -1 : 1);
          const caption = useAppStore.getState().doc?.captions.find((c) => c.id === id);
          if (caption) seek(caption.start + 0.001);
          break;
        }
        case 'Enter':
          if (selected) {
            event.preventDefault();
            useEditor.setState({ editingId: selected, selectedId: selected });
          }
          break;
        case 's':
        case 'S':
          event.preventDefault();
          splitAtPlayhead();
          break;
        case 'm':
        case 'M':
          if (selected) mergeNext(selected);
          break;
        case 'Delete':
        case 'Backspace':
          if (selected) {
            event.preventDefault();
            deleteCaption(selected);
          }
          break;
        case '?':
          useEditor.setState((s) => ({ helpOpen: !s.helpOpen }));
          break;
        case 'Escape':
          useEditor.setState({ selectedId: null, helpOpen: false, findOpen: false });
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
