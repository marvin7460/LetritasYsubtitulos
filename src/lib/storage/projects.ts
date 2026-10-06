import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { MediaInfo } from '../audio/types';
import type { Caption, LineRules } from '../captions/types';
import { AppError } from '../errors';
import type { CaptionStyle } from '../render/style';

/**
 * Projects live entirely in the browser:
 * - IndexedDB: project metadata and the caption document (small, structured, queryable).
 * - OPFS (Origin Private File System): the media file. It's built for large files; storing
 *   hundreds of MB as IndexedDB blobs is slower and some browsers handle it badly.
 *   Falls back to an IndexedDB blob where OPFS writing isn't available.
 */
export interface ProjectDocData {
  captions: Caption[];
  rules: LineRules;
  style: CaptionStyle;
  language: string | null;
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  media: { name: string; type: string; size: number; info: MediaInfo };
  mediaStorage: 'opfs' | 'idb' | 'none';
  doc: ProjectDocData;
}

export type ProjectSummary = Omit<ProjectRecord, 'doc'> & { captionCount: number };

interface LetritasDB extends DBSchema {
  projects: { key: string; value: ProjectRecord; indexes: { updatedAt: number } };
  media: { key: string; value: { id: string; blob: Blob } };
}

const DB_NAME = 'letritas';
let dbPromise: Promise<IDBPDatabase<LetritasDB>> | null = null;

function db(): Promise<IDBPDatabase<LetritasDB>> {
  dbPromise ??= openDB<LetritasDB>(DB_NAME, 1, {
    upgrade(database) {
      const projects = database.createObjectStore('projects', { keyPath: 'id' });
      projects.createIndex('updatedAt', 'updatedAt');
      database.createObjectStore('media', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

/** Test helper: close and forget the cached connection so the database can be deleted. */
export async function resetProjectsDbForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const all = await (await db()).getAllFromIndex('projects', 'updatedAt');
  return all.reverse().map(({ doc, ...rest }) => ({ ...rest, captionCount: doc.captions.length }));
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  return (await db()).get('projects', id);
}

/** Saves the document. The media file is written only the first time (`file` provided). */
export async function saveProject(
  record: Omit<ProjectRecord, 'mediaStorage' | 'createdAt' | 'updatedAt'> & { createdAt?: number },
  file?: Blob,
): Promise<ProjectRecord> {
  const database = await db();
  const existing = await database.get('projects', record.id);
  let mediaStorage = existing?.mediaStorage ?? 'none';
  if (file && mediaStorage === 'none') mediaStorage = await storeMedia(record.id, file);
  const now = Date.now();
  const saved: ProjectRecord = {
    ...record,
    createdAt: existing?.createdAt ?? record.createdAt ?? now,
    updatedAt: now,
    mediaStorage,
  };
  try {
    await database.put('projects', saved);
  } catch (error) {
    throw new AppError('storage-failed', error instanceof Error ? error.message : String(error));
  }
  return saved;
}

export async function deleteProject(id: string): Promise<void> {
  const database = await db();
  const record = await database.get('projects', id);
  await database.delete('projects', id);
  await database.delete('media', id);
  if (record?.mediaStorage === 'opfs') {
    try {
      const dir = await mediaDirectory();
      await dir.removeEntry(id);
    } catch {
      // Already gone.
    }
  }
}

export async function loadProjectMedia(record: ProjectRecord): Promise<File | null> {
  try {
    let blob: Blob | null = null;
    if (record.mediaStorage === 'opfs') {
      const dir = await mediaDirectory();
      blob = await (await dir.getFileHandle(record.id)).getFile();
    } else if (record.mediaStorage === 'idb') {
      blob = (await (await db()).get('media', record.id))?.blob ?? null;
    }
    return blob ? new File([blob], record.media.name, { type: record.media.type }) : null;
  } catch {
    return null;
  }
}

async function mediaDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('media', { create: true });
}

async function storeMedia(id: string, file: Blob): Promise<ProjectRecord['mediaStorage']> {
  try {
    const dir = await mediaDirectory();
    const handle = await dir.getFileHandle(id, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    return 'opfs';
  } catch {
    try {
      await (await db()).put('media', { id, blob: file });
      return 'idb';
    } catch {
      // Quota exceeded: keep the captions anyway; the user re-selects the file to reopen it.
      return 'none';
    }
  }
}

/** Asks the browser not to evict our data (models + projects) under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}
