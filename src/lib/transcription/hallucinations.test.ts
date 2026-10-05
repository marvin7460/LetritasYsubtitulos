import { describe, expect, it } from 'vitest';
import { cleanHallucinations } from './hallucinations';

describe('cleanHallucinations', () => {
  it('keeps normal speech untouched (baseline)', () => {
    const words = [
      { id: 'w1', text: 'Hola', start: 0, end: 0.4 },
      { id: 'w2', text: 'mundo.', start: 0.5, end: 0.9 },
    ];
    expect(cleanHallucinations(words, 2)).toEqual(words);
  });

  // TODO(Marvin): turn these into real tests once you implement cleanHallucinations.
  it.todo('removes "Subtítulos realizados por la comunidad de Amara.org" at the end of the media');
  it.todo('removes a known phrase surrounded by more than 1 s of silence');
  it.todo('keeps "gracias por ver" when it is part of continuous speech');
  it.todo('matches regardless of case and punctuation ("¡Gracias por ver!")');
});
