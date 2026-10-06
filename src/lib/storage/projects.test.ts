import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CLASSIC_STYLE } from '../render/style';
import { HORIZONTAL_RULES } from '../captions/rules';
import {
  deleteProject,
  getProject,
  listProjects,
  loadProjectMedia,
  resetProjectsDbForTests,
  saveProject,
} from './projects';

const info = {
  duration: 8,
  hasVideo: true,
  hasAudio: true,
  width: 360,
  height: 640,
  videoCodec: 'vp9',
  audioCodec: 'opus',
};

const record = (id: string, name: string) => ({
  id,
  name,
  media: { name: `${name}.webm`, type: 'video/webm', size: 4, info },
  doc: {
    captions: [
      { id: 'c1', start: 0, end: 1, words: [{ id: 'w1', text: 'Hola', start: 0, end: 1 }] },
    ],
    rules: HORIZONTAL_RULES,
    style: CLASSIC_STYLE,
    language: 'es',
  },
});

describe('projects storage (IndexedDB)', () => {
  beforeEach(async () => {
    await resetProjectsDbForTests();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('letritas');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('could not delete test database'));
    });
  });

  it('saves, lists (newest first) and loads projects', async () => {
    await saveProject(record('a', 'Primero'));
    await new Promise((r) => setTimeout(r, 5));
    await saveProject(record('b', 'Segundo'));
    const list = await listProjects();
    expect(list.map((p) => p.name)).toEqual(['Segundo', 'Primero']);
    expect(list[0]?.captionCount).toBe(1);
    expect((await getProject('a'))?.doc.captions[0]?.words[0]?.text).toBe('Hola');
  });

  it('keeps createdAt and bumps updatedAt on re-save', async () => {
    const first = await saveProject(record('a', 'Uno'));
    await new Promise((r) => setTimeout(r, 5));
    const second = await saveProject({ ...record('a', 'Uno editado') });
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
    expect(await listProjects()).toHaveLength(1);
  });

  it('stores the media (IndexedDB fallback when OPFS is unavailable) and deletes it', async () => {
    const saved = await saveProject(
      record('a', 'Video'),
      new Blob(['data'], { type: 'video/webm' }),
    );
    expect(saved.mediaStorage).toBe('idb');
    const file = await loadProjectMedia(saved);
    expect(await file?.text()).toBe('data');
    await deleteProject('a');
    expect(await listProjects()).toEqual([]);
  });
});
