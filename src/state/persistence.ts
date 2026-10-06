import { toAppError, AppError } from '../lib/errors';
import {
  getProject,
  loadProjectMedia,
  requestPersistentStorage,
  saveProject,
} from '../lib/storage/projects';
import { baseName } from '../lib/util/download';
import { createId } from '../lib/util/id';
import { loadMediaFile } from './actions';
import { loadDoc } from './editor';
import { setTranscription, useAppStore } from './store';

const AUTOSAVE_DELAY = 800;
let timer: ReturnType<typeof setTimeout> | null = null;
let askedForPersistence = false;

/**
 * Autosaves committed changes (not every frame of a drag: transient docs aren't in history).
 * The media file is written once, on the first save.
 */
export function startAutosave(): () => void {
  const unsubscribe = useAppStore.subscribe((state, prev) => {
    if (state.history?.present === prev.history?.present) return;
    if (!state.history || !state.media || state.isDemo) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void saveNow(), AUTOSAVE_DELAY);
  });
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

export async function saveNow(): Promise<void> {
  const { media, history, isDemo } = useAppStore.getState();
  if (!media || !history || isDemo) return;
  const id = useAppStore.getState().projectId ?? createId('prj');
  useAppStore.setState({ projectId: id, saveStatus: 'saving' });
  try {
    await saveProject(
      {
        id,
        name: baseName(media.name),
        media: { name: media.name, type: media.file.type, size: media.file.size, info: media.info },
        doc: history.present,
      },
      media.file,
    );
    // The user may have closed the project while we were saving.
    if (useAppStore.getState().projectId === id) useAppStore.setState({ saveStatus: 'saved' });
    if (!askedForPersistence) {
      askedForPersistence = true;
      void requestPersistentStorage();
    }
  } catch (error) {
    useAppStore.setState({ saveStatus: 'error', error: toAppError(error, 'storage-failed') });
  }
}

export async function openProject(id: string): Promise<void> {
  try {
    const record = await getProject(id);
    if (!record) throw new AppError('project-media-missing', 'project not found');
    const file = await loadProjectMedia(record);
    if (!file) throw new AppError('project-media-missing');
    await loadMediaFile(file);
    if (useAppStore.getState().stage !== 'workspace') return;
    loadDoc(record.doc);
    useAppStore.setState({ projectId: record.id, saveStatus: 'saved' });
    setTranscription({ status: 'done', progress: 1 });
  } catch (error) {
    useAppStore.setState({ error: toAppError(error, 'storage-failed') });
  }
}
