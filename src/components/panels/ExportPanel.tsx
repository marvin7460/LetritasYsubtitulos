import { Download, FileText } from 'lucide-react';
import { toAss } from '../../lib/export/ass';
import { toSrt } from '../../lib/export/srt';
import { toJson, toPlainText } from '../../lib/export/text';
import { toVtt } from '../../lib/export/vtt';
import { baseName, downloadText } from '../../lib/util/download';
import { useAppStore } from '../../state/store';
import { Button } from '../ui/Button';

export function ExportPanel() {
  const doc = useAppStore((s) => s.doc);
  const media = useAppStore((s) => s.media);
  if (!doc) return null;
  const name = media ? baseName(media.name) : 'subtitulos';
  const { captions, rules, style, language } = doc;
  // Audio-only files have no frame: default to vertical 1080×1920.
  const frameSize =
    media && media.info.width > 0 && media.info.height > 0
      ? { width: media.info.width, height: media.info.height }
      : { width: 1080, height: 1920 };

  const formats = [
    {
      id: 'srt',
      label: 'SRT',
      hint: 'YouTube, Premiere, DaVinci, CapCut',
      run: () => downloadText(toSrt(captions, rules), `${name}.srt`, 'application/x-subrip'),
    },
    {
      id: 'vtt',
      label: 'VTT',
      hint: 'Web (<track>), Vimeo',
      run: () => downloadText(toVtt(captions, rules), `${name}.vtt`, 'text/vtt'),
    },
    {
      id: 'ass',
      label: 'ASS',
      hint: 'Con estilos: FFmpeg, VLC, Aegisub, Kdenlive',
      run: () =>
        downloadText(
          toAss(captions, rules, style, { ...frameSize, title: name }),
          `${name}.ass`,
          'text/x-ssa',
        ),
    },
    {
      id: 'txt',
      label: 'Texto',
      hint: 'Transcripción en párrafos',
      run: () => downloadText(toPlainText(captions), `${name}.txt`),
    },
    {
      id: 'json',
      label: 'JSON',
      hint: 'Con tiempos por palabra',
      run: () =>
        downloadText(toJson(captions, rules, style, language), `${name}.json`, 'application/json'),
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <FileText className="size-4" aria-hidden /> Archivos de subtítulos
      </h3>
      <div className="grid gap-2">
        {formats.map((format) => (
          <Button
            key={format.id}
            onClick={format.run}
            className="justify-between"
            data-testid={`export-${format.id}`}
          >
            <span className="flex items-center gap-2">
              <Download className="size-4" aria-hidden />
              {format.label}
            </span>
            <span className="truncate text-xs text-muted">{format.hint}</span>
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted">
        Premiere y DaVinci importan SRT (texto y tiempos). Para conservar el estilo animado, exporta
        el video con los subtítulos quemados.
      </p>
    </div>
  );
}
