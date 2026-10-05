/** Short random ids for words, captions and projects. */
export function createId(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`;
}

/** Deterministic ids, used by tests so snapshots stay stable. */
export function sequentialIds(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export type IdFactory = () => string;
