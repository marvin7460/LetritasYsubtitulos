import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, pushHistory, redo, undo } from './history';

describe('history', () => {
  it('undoes and redoes in order', () => {
    let h = createHistory('a');
    h = pushHistory(h, 'b');
    h = pushHistory(h, 'c');
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe('c');
    expect(canRedo(h)).toBe(false);
  });

  it('a new edit clears the redo stack', () => {
    let h = pushHistory(pushHistory(createHistory(1), 2), 3);
    h = pushHistory(undo(h), 4);
    expect(h.present).toBe(4);
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe(2);
  });

  it('ignores no-op pushes', () => {
    const h = createHistory({ x: 1 });
    expect(pushHistory(h, h.present)).toBe(h);
  });

  it('undo/redo at the edges are no-ops', () => {
    const h = createHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('coalesces rapid edits with the same key into one step', () => {
    let h = createHistory('');
    h = pushHistory(h, 'h', { coalesceKey: 'text', now: 0 });
    h = pushHistory(h, 'ho', { coalesceKey: 'text', now: 300 });
    h = pushHistory(h, 'hol', { coalesceKey: 'text', now: 600 });
    expect(h.present).toBe('hol');
    expect(undo(h).present).toBe('');
  });

  it('does not coalesce across keys or after a pause', () => {
    let h = createHistory(0);
    h = pushHistory(h, 1, { coalesceKey: 'a', now: 0 });
    h = pushHistory(h, 2, { coalesceKey: 'b', now: 100 });
    h = pushHistory(h, 3, { coalesceKey: 'b', now: 5000 });
    expect(h.past).toEqual([0, 1, 2]);
  });

  it('undo breaks coalescing', () => {
    let h = createHistory(0);
    h = pushHistory(h, 1, { coalesceKey: 'k', now: 0 });
    h = pushHistory(h, 2, { coalesceKey: 'k', now: 10 });
    h = pushHistory(undo(h), 5, { coalesceKey: 'k', now: 20 });
    expect(h.past).toEqual([0]);
  });

  it('caps the number of undo steps', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = pushHistory(h, i, { limit: 3 });
    expect(h.past).toEqual([7, 8, 9]);
  });
});
