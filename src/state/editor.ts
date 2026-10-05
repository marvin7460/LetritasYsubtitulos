import { create } from 'zustand';
import {
  mergeWithNext,
  removeCaption,
  setCaptionTiming,
  splitCaptionAt,
  updateCaptionText,
} from '../lib/captions/docOps';
import { splitIndexAt } from '../lib/captions/edit';
import { replaceAll, type SearchOptions } from '../lib/captions/search';
import { createHistory, pushHistory, redo, undo, type PushOptions } from '../lib/history/history';
import { usePlayback } from './playback';
import { useAppStore, type ProjectDoc } from './store';

/** Editor UI state that is not part of the document (and therefore not undoable). */
interface EditorState {
  selectedId: string | null;
  editingId: string | null;
  findOpen: boolean;
  helpOpen: boolean;
}

export const useEditor = create<EditorState>()(() => ({
  selectedId: null,
  editingId: null,
  findOpen: false,
  helpOpen: false,
}));

/** Starts a fresh history (new transcription or opened project). */
export function loadDoc(doc: ProjectDoc): void {
  useAppStore.setState({ doc, history: createHistory(doc) });
  useEditor.setState({ selectedId: null, editingId: null });
}

/** Replaces the document as one undoable step (e.g. re-transcribing). */
export function replaceDoc(doc: ProjectDoc): void {
  const { history } = useAppStore.getState();
  if (!history) {
    loadDoc(doc);
    return;
  }
  const next = pushHistory(history, doc);
  useAppStore.setState({ history: next, doc: next.present });
}

/** Applies an undoable change to the document. */
export function commitDoc(update: (doc: ProjectDoc) => ProjectDoc, options?: PushOptions): void {
  const { history, doc } = useAppStore.getState();
  if (!history || !doc) return;
  const nextDoc = update(doc);
  if (nextDoc === doc && doc === history.present) return;
  const next = pushHistory(history, nextDoc, options);
  useAppStore.setState({ history: next, doc: next.present });
}

/** Shows a change without recording it (live dragging). Call `commitTransient` at the end. */
export function setTransientDoc(update: (doc: ProjectDoc) => ProjectDoc): void {
  const { doc } = useAppStore.getState();
  if (doc) useAppStore.setState({ doc: update(doc) });
}

export function commitTransient(): void {
  const { history, doc } = useAppStore.getState();
  if (!history || !doc || doc === history.present) return;
  const next = pushHistory(history, doc);
  useAppStore.setState({ history: next, doc: next.present });
}

export function undoDoc(): void {
  const { history } = useAppStore.getState();
  if (!history) return;
  const next = undo(history);
  useAppStore.setState({ history: next, doc: next.present });
  keepSelectionValid();
}

export function redoDoc(): void {
  const { history } = useAppStore.getState();
  if (!history) return;
  const next = redo(history);
  useAppStore.setState({ history: next, doc: next.present });
  keepSelectionValid();
}

function keepSelectionValid(): void {
  const { doc } = useAppStore.getState();
  const { selectedId } = useEditor.getState();
  if (selectedId && !doc?.captions.some((c) => c.id === selectedId)) {
    useEditor.setState({ selectedId: null, editingId: null });
  }
}

const withCaptions =
  (fn: (captions: ProjectDoc['captions']) => ProjectDoc['captions']) => (doc: ProjectDoc) => {
    const captions = fn(doc.captions);
    return captions.length === doc.captions.length &&
      captions.every((c, i) => c === doc.captions[i])
      ? doc
      : { ...doc, captions };
  };

export function editText(id: string, text: string): void {
  commitDoc(withCaptions((captions) => updateCaptionText(captions, id, text)));
}

export function splitCaption(id: string, wordIndex: number): void {
  commitDoc(withCaptions((captions) => splitCaptionAt(captions, id, wordIndex)));
}

/** Splits the selected (or active) caption at the playhead. */
export function splitAtPlayhead(): void {
  const { doc } = useAppStore.getState();
  const { currentTime, activeCaptionId } = usePlayback.getState();
  const id = useEditor.getState().selectedId ?? activeCaptionId;
  const caption = doc?.captions.find((c) => c.id === id);
  if (!caption || caption.words.length < 2) return;
  splitCaption(caption.id, splitIndexAt(caption, currentTime));
}

export function mergeNext(id: string): void {
  commitDoc(withCaptions((captions) => mergeWithNext(captions, id)));
}

export function deleteCaption(id: string): void {
  commitDoc(withCaptions((captions) => removeCaption(captions, id)));
  keepSelectionValid();
}

export function timingUpdater(id: string, start: number, end: number) {
  return (doc: ProjectDoc): ProjectDoc => {
    const mediaDuration = useAppStore.getState().media?.info.duration;
    return withCaptions((captions) =>
      setCaptionTiming(captions, id, start, end, {
        minGap: doc.rules.minGap,
        ...(mediaDuration ? { mediaDuration } : {}),
      }),
    )(doc);
  };
}

export function replaceInDoc(query: string, replacement: string, options: SearchOptions): number {
  let count = 0;
  commitDoc(
    withCaptions((captions) => {
      const result = replaceAll(captions, query, replacement, options);
      count = result.count;
      return result.captions;
    }),
  );
  return count;
}

export function selectCaption(id: string | null): void {
  useEditor.setState({ selectedId: id });
}

/** Selects the previous/next caption and moves the playhead to it. */
export function selectAdjacent(direction: 1 | -1): string | null {
  const { doc } = useAppStore.getState();
  if (!doc || doc.captions.length === 0) return null;
  const { selectedId } = useEditor.getState();
  const current = doc.captions.findIndex(
    (c) => c.id === (selectedId ?? usePlayback.getState().activeCaptionId),
  );
  const index =
    current === -1
      ? direction === 1
        ? 0
        : doc.captions.length - 1
      : Math.min(doc.captions.length - 1, Math.max(0, current + direction));
  const caption = doc.captions[index];
  if (!caption) return null;
  useEditor.setState({ selectedId: caption.id });
  return caption.id;
}
