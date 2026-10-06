import { useEffect } from 'react';
import { ErrorBanner } from './components/ErrorBanner';
import { Header } from './components/Header';
import { Landing } from './components/Landing';
import { LoadingMedia } from './components/LoadingMedia';
import { Workspace } from './components/Workspace';
import { closeMedia, probeCapabilities } from './state/actions';
import { startAutosave } from './state/persistence';
import { useAppStore } from './state/store';

export function App() {
  const stage = useAppStore((s) => s.stage);
  const media = useAppStore((s) => s.media);

  useEffect(() => {
    void probeCapabilities();
    return startAutosave();
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header onHome={closeMedia} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        <ErrorBanner />
        {stage === 'empty' && <Landing />}
        {stage === 'loading-media' && <LoadingMedia />}
        {stage === 'workspace' && media && <Workspace media={media} />}
      </main>
      <footer className="border-t border-line/60 py-6 text-center text-xs text-muted">
        Letritas · Hecho con Whisper, Transformers.js y WebCodecs · Tus archivos se procesan solo en
        tu navegador.
      </footer>
    </div>
  );
}
