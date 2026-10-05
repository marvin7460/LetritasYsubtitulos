import { describe, expect, it } from 'vitest';
import { SPANISH_SPEECH } from '../../test/fixtures';
import { buildCaptions } from '../captions/buildCaptions';
import { VERTICAL_RULES } from '../captions/rules';
import { PRESETS } from '../render/presets';
import { CLASSIC_STYLE } from '../render/style';
import { sequentialIds } from '../util/id';
import { assColor, parseColor, toAss } from './ass';
import { toJson, toPlainText } from './text';

const captions = buildCaptions(SPANISH_SPEECH.slice(0, 7), VERTICAL_RULES, {
  makeId: sequentialIds('c'),
  mediaDuration: 10,
});
const size = { width: 1080, height: 1920 };

describe('assColor', () => {
  it('converts CSS colors to &HAABBGGRR', () => {
    expect(assColor('#ffffff')).toBe('&H00FFFFFF');
    expect(assColor('#ff0000')).toBe('&H000000FF');
    expect(assColor('#0f0')).toBe('&H0000FF00');
    expect(assColor('rgba(0,0,0,0.5)')).toBe('&H80000000');
  });

  it('parses hex with alpha and rgb()', () => {
    expect(parseColor('#00000080').a).toBeCloseTo(0.5, 1);
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
  });
});

describe('toAss', () => {
  it.each(PRESETS.map((p) => [p.id, p]))(
    'matches the snapshot for the %s preset',
    (_id, preset) => {
      expect(toAss(captions, VERTICAL_RULES, preset.style, size)).toMatchSnapshot();
    },
  );

  it('declares the video resolution so sizes scale correctly', () => {
    const ass = toAss(captions, VERTICAL_RULES, CLASSIC_STYLE, size);
    expect(ass).toContain('PlayResX: 1080');
    expect(ass).toContain('PlayResY: 1920');
    // 5% of 1920 px
    expect(ass).toMatch(/Style: Default,Inter,96,/);
  });

  it('uses karaoke fill tags for the karaoke style', () => {
    const ass = toAss(captions, VERTICAL_RULES, { ...CLASSIC_STYLE, highlight: 'karaoke' }, size);
    expect(ass).toMatch(/\{\\kf\d+\}Hola/);
  });

  it('emits one event per word for word highlighting', () => {
    const ass = toAss(captions, VERTICAL_RULES, { ...CLASSIC_STYLE, highlight: 'color' }, size);
    const events = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
    expect(events).toHaveLength(captions.flatMap((c) => c.words).length);
  });

  it('escapes braces that would be read as override tags', () => {
    const tricky = [
      { id: 'x', start: 0, end: 1, words: [{ id: 'w', text: '{hola}', start: 0, end: 1 }] },
    ];
    expect(toAss(tricky, VERTICAL_RULES, CLASSIC_STYLE, size)).toContain(',(hola)');
  });
});

describe('plain text and JSON', () => {
  it('joins captions into paragraphs at long pauses', () => {
    const text = toPlainText([
      { id: 'a', start: 0, end: 1, words: [{ id: '1', text: 'Hola.', start: 0, end: 1 }] },
      { id: 'b', start: 1.2, end: 2, words: [{ id: '2', text: 'Sigo.', start: 1.2, end: 2 }] },
      { id: 'c', start: 6, end: 7, words: [{ id: '3', text: 'Nuevo.', start: 6, end: 7 }] },
    ]);
    expect(text).toBe('Hola. Sigo.\n\nNuevo.\n');
  });

  it('exports words with their timings', () => {
    const data = JSON.parse(toJson(captions, VERTICAL_RULES, CLASSIC_STYLE, 'es')) as {
      language: string;
      captions: { words: { start: number }[] }[];
    };
    expect(data.language).toBe('es');
    expect(data.captions[0]?.words[0]?.start).toBe(0);
  });
});
