import { Captions, Download, Palette, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { formatBytes, formatDuration } from '../lib/media/validate';
import { closeMedia } from '../state/actions';
import { useAppStore, type MediaState } from '../state/store';
import { CaptionEditor } from './editor/CaptionEditor';
import { EditorToolbar } from './editor/EditorToolbar';
import { useEditorShortcuts } from './editor/shortcuts';
import { Timeline } from './editor/Timeline';
import { ExportPanel } from './panels/ExportPanel';
import { StylePanel } from './panels/StylePanel';
import { TranscribePanel } from './panels/TranscribePanel';
import { Preview } from './preview/Preview';
import { Tabs } from './ui/Tabs';

type PanelId = 'transcribe' | 'captions' | 'style' | 'export';

export function Workspace({ media }: { media: MediaState }) {
  const hasDoc = useAppStore((s) => s.doc !== null);
  const [selected, setSelected] = useState<PanelId>('transcribe');
  // Jump to the captions once a transcription exists, unless the user picked a tab already.
  const [autoSwitched, setAutoSwitched] = useState(false);
  if (hasDoc && !autoSwitched) {
    setAutoSwitched(true);
    setSelected('captions');
  }
  const panel: PanelId = !hasDoc ? 'transcribe' : selected;
  useEditorShortcuts(hasDoc);

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 space-y-3" aria-label="Vista previa">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="min-w-0 truncate text-muted">
              <span className="font-medium text-fg">{media.name}</span> ·{' '}
              {formatDuration(media.info.duration)} · {formatBytes(media.file.size)}
              {media.info.width > 0 && ` · ${media.info.width}×${media.info.height}`}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {hasDoc && <EditorToolbar />}
              <button
                type="button"
                onClick={closeMedia}
                className="flex items-center gap-1 text-muted hover:text-fg"
              >
                <X className="size-4" aria-hidden /> Cerrar
              </button>
            </div>
          </div>
          <Preview key={media.url} media={media} />
        </section>

        <aside
          className="min-w-0 space-y-4 rounded-2xl border border-line bg-surface p-4"
          aria-label="Panel de edición"
        >
          <Tabs<PanelId>
            label="Secciones"
            value={panel}
            onChange={setSelected}
            items={[
              {
                id: 'transcribe',
                label: 'Transcribir',
                icon: <Wand2 className="size-4" aria-hidden />,
              },
              {
                id: 'captions',
                label: 'Texto',
                icon: <Captions className="size-4" aria-hidden />,
                disabled: !hasDoc,
              },
              {
                id: 'style',
                label: 'Estilo',
                icon: <Palette className="size-4" aria-hidden />,
                disabled: !hasDoc,
              },
              {
                id: 'export',
                label: 'Exportar',
                icon: <Download className="size-4" aria-hidden />,
                disabled: !hasDoc,
              },
            ]}
          />
          <div role="tabpanel" id={`panel-${panel}`} aria-labelledby={`tab-${panel}`}>
            {panel === 'transcribe' && <TranscribePanel />}
            {panel === 'captions' && <CaptionEditor />}
            {panel === 'style' && <StylePanel />}
            {panel === 'export' && <ExportPanel />}
          </div>
        </aside>
      </div>
      {hasDoc && <Timeline />}
    </div>
  );
}
