import { buildCaptions } from '../lib/captions/buildCaptions';
import { defaultRulesFor, orientationOf } from '../lib/captions/rules';
import { AppError, toAppError } from '../lib/errors';
import { getPreset } from '../lib/render/presets';
import { CLASSIC_STYLE } from '../lib/render/style';
import { createId } from '../lib/util/id';
import { loadMediaFile } from './actions';
import { loadDoc } from './editor';
import { setTranscription, useAppStore } from './store';

interface DemoTranscript {
  language: string;
  duration: number;
  words: { text: string; start: number; end: number }[];
}

/** Browsers without H.264 (e.g. some Linux Chromium builds) get the WebM version. */
function demoVideoUrl(): string {
  const video = document.createElement('video');
  return video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
    ? '/samples/demo.mp4'
    : '/samples/demo.webm';
}

/**
 * "Probar con un video de ejemplo": loads a short clip plus a precomputed transcript, so a
 * recruiter sees the editor in two seconds without downloading a 100+ MB model. The clip still
 * goes through the real pipeline (audio extraction, waveform, line building, styles, export),
 * and "Volver a transcribir" runs the real Whisper model on it.
 */
export async function loadDemo(): Promise<void> {
  try {
    const url = demoVideoUrl();
    const [videoResponse, transcriptResponse] = await Promise.all([
      fetch(url),
      fetch('/samples/demo.words.json'),
    ]);
    if (!videoResponse.ok || !transcriptResponse.ok) {
      throw new AppError('unknown', 'demo files missing');
    }
    const blob = await videoResponse.blob();
    const transcript = (await transcriptResponse.json()) as DemoTranscript;
    const file = new File(
      [blob],
      url.endsWith('.mp4') ? 'demo-letritas.mp4' : 'demo-letritas.webm',
      {
        type: blob.type || (url.endsWith('.mp4') ? 'video/mp4' : 'video/webm'),
      },
    );

    await loadMediaFile(file);
    const { media, stage } = useAppStore.getState();
    if (stage !== 'workspace' || !media) return;
    // Mark it before creating the document so autosave never stores the demo as a project.
    useAppStore.setState({ isDemo: true });

    const tiktok = getPreset('tiktok');
    const rules = {
      ...defaultRulesFor(orientationOf(media.info.width, media.info.height)),
      ...tiktok?.rules,
    };
    const words = transcript.words.map((w) => ({ ...w, id: createId('w') }));
    loadDoc({
      captions: buildCaptions(words, rules, { mediaDuration: media.info.duration }),
      rules,
      style: tiktok?.style ?? CLASSIC_STYLE,
      language: transcript.language,
    });
    setTranscription({ status: 'done', progress: 1 });
  } catch (error) {
    useAppStore.setState({ error: toAppError(error) });
  }
}
