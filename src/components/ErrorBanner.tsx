import { TriangleAlert, X } from 'lucide-react';
import { ERROR_MESSAGES, type RecoveryAction } from '../lib/errors';
import { closeMedia, dismissError, startTranscription, updateSettings } from '../state/actions';
import { useAppStore } from '../state/store';
import { Button } from './ui/Button';

const ACTION_LABELS: Record<RecoveryAction, string> = {
  'choose-another-file': 'Elegir otro archivo',
  'use-wasm': 'Usar WASM',
  'smaller-model': 'Usar un modelo más pequeño',
  retry: 'Reintentar',
  'download-subtitles': 'Ir a exportar subtítulos',
  'export-webm': 'Probar WebM',
  'go-online': 'Entendido',
  'trim-media': 'Entendido',
  dismiss: 'Cerrar',
};

export interface ErrorBannerProps {
  onAction?: (action: RecoveryAction) => void;
}

/** Every error shows what happened in plain Spanish and at least one way forward. */
export function ErrorBanner({ onAction }: ErrorBannerProps) {
  const error = useAppStore((s) => s.error);
  if (!error) return null;
  const message = ERROR_MESSAGES[error.code];

  const run = (action: RecoveryAction) => {
    dismissError();
    switch (action) {
      case 'choose-another-file':
        closeMedia();
        break;
      case 'use-wasm':
        updateSettings({ device: 'wasm' });
        void startTranscription();
        break;
      case 'smaller-model':
        updateSettings({ model: 'tiny' });
        void startTranscription();
        break;
      case 'retry':
        if (useAppStore.getState().audio) void startTranscription();
        break;
      default:
        break;
    }
    onAction?.(action);
  };

  return (
    <div
      role="alert"
      data-testid="error-banner"
      className="mx-auto mb-4 flex max-w-[1400px] items-start gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{message.title}</p>
        <p className="mt-1 text-sm text-muted">{message.description}</p>
        {error.detail && (
          <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer">Detalle técnico</summary>
            <code className="mt-1 block break-all">{error.detail}</code>
          </details>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {message.actions.map((action) => (
            <Button
              key={action}
              size="sm"
              variant={action === message.actions[0] ? 'primary' : 'secondary'}
              onClick={() => run(action)}
            >
              {ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={dismissError}
        className="text-muted hover:text-fg"
        aria-label="Cerrar aviso"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
