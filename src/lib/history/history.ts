/**
 * Undo/redo as immutable snapshots: `past` ← `present` → `future`.
 *
 * Snapshots are cheap because the document is immutable: an edit replaces only the caption it
 * touches and every other caption object is shared between versions (structural sharing).
 *
 * Coalescing: continuous gestures (typing, dragging a color picker) produce many updates;
 * updates with the same `coalesceKey` within `coalesceMs` merge into a single undo step.
 */
export interface History<T> {
  past: readonly T[];
  present: T;
  future: readonly T[];
  lastKey: string | null;
  lastTime: number;
}

export interface PushOptions {
  coalesceKey?: string;
  now?: number;
  coalesceMs?: number;
  limit?: number;
}

export const HISTORY_LIMIT = 200;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastTime: 0 };
}

export function pushHistory<T>(
  history: History<T>,
  next: T,
  options: PushOptions = {},
): History<T> {
  if (Object.is(next, history.present)) return history;
  const now = options.now ?? Date.now();
  const key = options.coalesceKey ?? null;
  const coalesce =
    key !== null &&
    key === history.lastKey &&
    now - history.lastTime <= (options.coalesceMs ?? 1000) &&
    history.past.length > 0;

  if (coalesce) {
    return { ...history, present: next, future: [], lastTime: now };
  }
  const limit = options.limit ?? HISTORY_LIMIT;
  const past = [...history.past, history.present];
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    present: next,
    future: [],
    lastKey: key,
    lastTime: now,
  };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastKey: null,
    lastTime: 0,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
    lastKey: null,
    lastTime: 0,
  };
}

export const canUndo = (history: History<unknown>) => history.past.length > 0;
export const canRedo = (history: History<unknown>) => history.future.length > 0;
