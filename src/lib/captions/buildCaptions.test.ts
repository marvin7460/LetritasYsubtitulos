import { describe, expect, it } from 'vitest';
import { SPANISH_SPEECH, words } from '../../test/fixtures';
import { sequentialIds } from '../util/id';
import { applyTimingRules, buildCaptions } from './buildCaptions';
import { splitIntoLines } from './lines';
import { HORIZONTAL_RULES, VERTICAL_RULES } from './rules';
import { joinWords } from './text';
import type { LineRules } from './types';

const build = (
  input = SPANISH_SPEECH,
  rules: LineRules = HORIZONTAL_RULES,
  mediaDuration?: number,
) =>
  buildCaptions(input, rules, {
    makeId: sequentialIds('c'),
    ...(mediaDuration ? { mediaDuration } : {}),
  });

describe('buildCaptions', () => {
  it('returns no captions for no words', () => {
    expect(build([])).toEqual([]);
  });

  it('keeps every word exactly once, in order', () => {
    const captions = build();
    expect(captions.flatMap((c) => c.words)).toEqual(SPANISH_SPEECH);
  });

  it('respects the line rules', () => {
    for (const rules of [HORIZONTAL_RULES, VERTICAL_RULES]) {
      for (const caption of build(SPANISH_SPEECH, rules)) {
        expect(splitIntoLines(caption.words, rules.maxCharsPerLine, rules.maxLines)).not.toBeNull();
        expect(caption.words.at(-1)!.end - caption.words[0]!.start).toBeLessThanOrEqual(
          rules.maxDuration,
        );
      }
    }
  });

  it('breaks at sentence ends', () => {
    const texts = build().map((c) => joinWords(c.words));
    expect(texts.some((t) => t.endsWith('Letritas.'))).toBe(true);
    expect(texts.some((t) => t.endsWith('segundos.'))).toBe(true);
  });

  it('always breaks on long pauses', () => {
    const captions = build(words('Primero@0-0.4 algo@0.5-0.9 después@3-3.4 otra@3.5-3.9'));
    expect(captions.map((c) => joinWords(c.words))).toEqual(['Primero algo', 'después otra']);
  });

  it('caps words per caption for word-by-word styles', () => {
    const rules = { ...VERTICAL_RULES, maxWordsPerCaption: 3, maxLines: 1 };
    for (const caption of build(SPANISH_SPEECH, rules))
      expect(caption.words.length).toBeLessThanOrEqual(3);
  });

  it('never ends a caption on a function word when avoidable', () => {
    for (const caption of build(SPANISH_SPEECH, VERTICAL_RULES)) {
      expect(caption.words.at(-1)!.text).not.toMatch(/^(a|de|la|el|en|y)$/);
    }
  });

  it('allows a single word longer than the line limit', () => {
    const captions = build(words('Supercalifragilisticoespialidoso'), {
      ...HORIZONTAL_RULES,
      maxCharsPerLine: 10,
    });
    expect(captions).toHaveLength(1);
  });

  it('matches the snapshot for vertical video', () => {
    expect(
      build(SPANISH_SPEECH, VERTICAL_RULES, 20).map((c) => ({
        text: joinWords(c.words),
        start: c.start,
        end: Number(c.end.toFixed(3)),
      })),
    ).toMatchSnapshot();
  });
});

describe('applyTimingRules', () => {
  const caption = (id: string, spec: string) => {
    const w = words(spec);
    return { id, start: w[0]!.start, end: w.at(-1)!.end, words: w };
  };

  it('extends short captions to the minimum duration', () => {
    const [c] = applyTimingRules([caption('a', 'Sí@1-1.2')], HORIZONTAL_RULES, 10);
    expect(c!.end).toBeCloseTo(1 + HORIZONTAL_RULES.minDuration, 3);
  });

  it('never overlaps the next caption and keeps the minimum gap', () => {
    const result = applyTimingRules(
      [caption('a', 'Sí@1-1.2'), caption('b', 'No@1.5-1.7')],
      HORIZONTAL_RULES,
    );
    expect(result[0]!.end).toBeCloseTo(1.5 - HORIZONTAL_RULES.minGap, 3);
  });

  it('chains captions separated by a tiny gap to avoid flicker', () => {
    const result = applyTimingRules(
      [caption('a', 'una@0-0.5 frase@0.5-1.2 larga@1.2-2'), caption('b', 'otra@2.3-2.8')],
      HORIZONTAL_RULES,
    );
    expect(result[0]!.end).toBeCloseTo(2.3 - HORIZONTAL_RULES.minGap, 3);
  });

  it('does not extend past the media duration', () => {
    const [c] = applyTimingRules([caption('a', 'Fin@4.9-5')], HORIZONTAL_RULES, 5.2);
    expect(c!.end).toBeLessThanOrEqual(5.2);
  });

  it('never ends before its last word', () => {
    const [c] = applyTimingRules([caption('a', 'larga@0-9')], HORIZONTAL_RULES);
    expect(c!.end).toBe(9);
  });
});
