import { Download, FileText } from 'lucide-react';
import { toSrt } from '../../lib/export/srt';
import { toVtt } from '../../lib/export/vtt';
import { baseName, downloadText } from '../../lib/util/download';
import { useAppStore } from '../../state/store';
import { Button } from '../ui/Button';

export function ExportPanel() {
  const doc = useAppStore((s) => s.doc);
  const name = useAppStore((s) => (s.media ? baseName(s.media.name) : 'subtitulos'));
  if (!doc) return null;

  const formats = [
    {
      id: 'srt',
      label: 'SRT',
      hint: 'YouTube, Premiere, DaVinci, CapCut',
      run: () =>
        downloadText(toSrt(doc.captions, doc.rules), `${name}.srt`, 'application/x-subrip'),
    },
    {
      id: 'vtt',
      label: 'VTT',
      hint: 'Web (<track>), Vimeo',
      run: () => downloadText(toVtt(doc.captions, doc.rules), `${name}.vtt`, 'text/vtt'),
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
            <span className="text-xs text-muted">{format.hint}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
