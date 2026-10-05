import { describe, expect, it } from 'vitest';
import { words } from '../../test/fixtures';
import { breakPenalty, layoutLines, splitIntoLines } from './lines';
import { joinWords } from './text';

const text = (lines: { text: string }[][] | null) => lines?.map((l) => joinWords(l));

describe('splitIntoLines', () => {
  it('keeps short text on one line', () => {
    expect(text(splitIntoLines(words('Hola mundo'), 42, 2))).toEqual(['Hola mundo']);
  });

  it('balances two lines', () => {
    const result = text(
      splitIntoLines(words('Hoy les muestro cómo crear subtítulos animados en segundos'), 32, 2),
    );
    expect(result).toHaveLength(2);
    const [a = '', b = ''] = result ?? [];
    expect(Math.abs(a.length - b.length)).toBeLessThanOrEqual(10);
  });

  it('prefers breaking after punctuation', () => {
    expect(text(splitIntoLines(words('Hola a todos, bienvenidos a Letritas'), 24, 2))).toEqual([
      'Hola a todos,',
      'bienvenidos a Letritas',
    ]);
  });

  it('avoids ending a line on a function word', () => {
    const result = text(splitIntoLines(words('el gato de la casa de mi abuela'), 20, 2));
    expect(result?.[0]?.split(' ').at(-1)).not.toMatch(/^(de|la|el|mi)$/);
  });

  it('returns null when text does not fit', () => {
    expect(
      splitIntoLines(words('una frase demasiado larga para dos lineas cortas'), 10, 2),
    ).toBeNull();
    expect(splitIntoLines(words('supercalifragilístico'), 10, 2)).toBeNull();
  });

  it('never exceeds the character limit', () => {
    const lines =
      splitIntoLines(words('uno dos tres cuatro cinco seis siete ocho nueve diez'), 26, 2) ?? [];
    for (const line of lines) expect(joinWords(line).length).toBeLessThanOrEqual(26);
  });
});

describe('layoutLines', () => {
  it('falls back to greedy wrapping when the balanced split is impossible', () => {
    const lines = layoutLines(words('una frase demasiado larga para dos lineas'), 12, 2);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.flat()).toHaveLength(7);
  });
});

describe('breakPenalty', () => {
  it('ranks break points', () => {
    expect(breakPenalty('Letritas.', 'Hoy')).toBe(0);
    expect(breakPenalty('todos,', 'bienvenidos')).toBeLessThan(breakPenalty('gato', 'negro'));
    expect(breakPenalty('de', 'la')).toBeGreaterThan(breakPenalty('gato', 'negro'));
  });
});
