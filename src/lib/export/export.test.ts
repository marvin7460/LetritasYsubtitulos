import { describe, expect, it } from 'vitest';
import { SPANISH_SPEECH } from '../../test/fixtures';
import { buildCaptions } from '../captions/buildCaptions';
import { HORIZONTAL_RULES, VERTICAL_RULES } from '../captions/rules';
import { sequentialIds } from '../util/id';
import { toSrt } from './srt';
import { formatTimestamp } from './time';
import { toVtt } from './vtt';

const captions = buildCaptions(SPANISH_SPEECH, VERTICAL_RULES, {
  makeId: sequentialIds('c'),
  mediaDuration: 20,
});

describe('formatTimestamp', () => {
  it.each([
    [0, '00:00:00,000', '00:00:00.000', '0:00:00.00'],
    [1.5, '00:00:01,500', '00:00:01.500', '0:00:01.50'],
    [83.456, '00:01:23,456', '00:01:23.456', '0:01:23.46'],
    [3723.004, '01:02:03,004', '01:02:03.004', '1:02:03.00'],
    [59.9999, '00:01:00,000', '00:01:00.000', '0:01:00.00'],
  ])('%s s', (seconds, srt, vtt, ass) => {
    expect(formatTimestamp(seconds, 'srt')).toBe(srt);
    expect(formatTimestamp(seconds, 'vtt')).toBe(vtt);
    expect(formatTimestamp(seconds, 'ass')).toBe(ass);
  });

  it('clamps invalid values to zero', () => {
    expect(formatTimestamp(-3, 'srt')).toBe('00:00:00,000');
    expect(formatTimestamp(Number.NaN, 'vtt')).toBe('00:00:00.000');
  });
});

describe('toSrt', () => {
  it('matches the snapshot', () => {
    expect(toSrt(captions, VERTICAL_RULES)).toMatchSnapshot();
  });

  it('numbers cues from 1 and uses comma milliseconds', () => {
    const srt = toSrt(captions, VERTICAL_RULES);
    expect(srt.startsWith('1\n00:00:00,000 --> ')).toBe(true);
    expect(srt).toMatch(/\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}/);
  });

  it('wraps lines with the same rules as the captions', () => {
    for (const line of toSrt(captions, HORIZONTAL_RULES).split('\n')) {
      if (!line.includes('-->') && !/^\d+$/.test(line)) expect(line.length).toBeLessThanOrEqual(42);
    }
  });
});

describe('toVtt', () => {
  it('matches the snapshot', () => {
    expect(toVtt(captions, VERTICAL_RULES)).toMatchSnapshot();
  });

  it('starts with the WEBVTT header and escapes HTML', () => {
    const vtt = toVtt(
      [{ id: 'x', start: 0, end: 1, words: [{ id: 'w', text: 'a<b>&c', start: 0, end: 1 }] }],
      HORIZONTAL_RULES,
    );
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('a&lt;b&gt;&amp;c');
  });
});
