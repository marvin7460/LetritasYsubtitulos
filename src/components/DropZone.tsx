import { Upload } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { ACCEPT_ATTRIBUTE } from '../lib/media/validate';

export interface DropZoneProps {
  onFile: (file: File) => void;
}

export function DropZone({ onFile }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition ${
        dragging ? 'border-brand bg-brand/10' : 'border-line bg-surface/60 hover:border-muted'
      }`}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-ink">
        <Upload className="size-7" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-semibold">Arrastra tu video o audio aquí</p>
        <p className="mt-1 text-sm text-muted">
          MP4, MOV, WEBM, MP3, WAV o M4A · se procesa en tu navegador
        </p>
      </div>
      <label
        htmlFor={inputId}
        className="inline-flex h-11 cursor-pointer items-center rounded-xl bg-fg px-5 text-sm font-semibold text-ink transition hover:bg-white"
      >
        Elegir archivo
      </label>
      <input
        ref={inputRef}
        id={inputId}
        data-testid="file-input"
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}
