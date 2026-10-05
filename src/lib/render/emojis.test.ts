import { describe, expect, it } from 'vitest';
import { words } from '../../test/fixtures';
import { computeEmojiMap, pickEmoji } from './emojis';

describe('pickEmoji', () => {
  it('finds exact keywords regardless of case (baseline)', () => {
    expect(pickEmoji('dinero')).toBe('💰');
    expect(pickEmoji('Dinero')).toBe('💰');
    expect(pickEmoji('mesa')).toBeNull();
  });

  // TODO(Marvin): make these pass by improving pickEmoji.
  it.todo('ignores surrounding punctuation: "¡Fuego!" → 🔥');
  it.todo('ignores accents: "increible" → 🤯');
  it.todo('handles simple plurals: "ideas" → 💡 and "corazones" → ❤️');
  it.todo('works with uppercase TikTok text: "DINERO," → 💰');
});

describe('computeEmojiMap', () => {
  it('maps at most one emoji per caption, by word id', () => {
    const w = words('dinero y amor');
    const map = computeEmojiMap([{ id: 'c', start: 0, end: 1, words: w }]);
    expect([...map.entries()]).toEqual([['w1', '💰']]);
  });
});
